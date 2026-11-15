import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { BetterAuthRateLimitStorage } from '@better-auth/core';
import Redis from 'ioredis';
import { headers } from 'next/headers';

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_WINDOW_SECONDS = 15 * 60;
export const LOGIN_LOCK_SECONDS = 15 * 60;

type MemBucket = {
    count: number;
    expiresAt: number;
};

const memBuckets = new Map<string, MemBucket>();
const MEM_MAX_KEYS = 20_000;

function pruneMemBuckets(now: number) {
    for (const [k, v] of memBuckets) {
        if (now >= v.expiresAt) memBuckets.delete(k);
    }
    if (memBuckets.size <= MEM_MAX_KEYS) return;
    const overflow = memBuckets.size - MEM_MAX_KEYS;
    let deleted = 0;
    for (const k of memBuckets.keys()) {
        memBuckets.delete(k);
        if (++deleted >= overflow) break;
    }
}

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
    if (redisClient !== undefined) return redisClient;
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
        redisClient = null;
        return null;
    }
    const client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 1500,
    });
    client.on('error', () => {
        // Handled per-operation via try/catch fallback to memory store.
    });
    redisClient = client;
    return client;
}

const CONSUME_LUA = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
    redis.call("EXPIRE", KEYS[1], tonumber(ARGV[1]))
end
local ttl = redis.call("TTL", KEYS[1])
if ttl < 0 then
    redis.call("EXPIRE", KEYS[1], tonumber(ARGV[1]))
    ttl = tonumber(ARGV[1])
end
return { current, ttl }
`;

export type RateLimitResult = {
    allowed: boolean;
    retryAfter: number | null;
    remaining: number;
    count: number;
};

function consumeMemory(
    key: string,
    windowSeconds: number,
    max: number,
): RateLimitResult {
    const now = Date.now();
    if (memBuckets.size > 1000) pruneMemBuckets(now);

    const existing = memBuckets.get(key);
    if (!existing || now >= existing.expiresAt) {
        const expiresAt = now + windowSeconds * 1000;
        memBuckets.set(key, { count: 1, expiresAt });
        return {
            allowed: true,
            retryAfter: null,
            remaining: Math.max(0, max - 1),
            count: 1,
        };
    }

    if (existing.count >= max) {
        const retryAfter = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
        return {
            allowed: false,
            retryAfter,
            remaining: 0,
            count: existing.count,
        };
    }

    existing.count += 1;
    return {
        allowed: true,
        retryAfter: null,
        remaining: Math.max(0, max - existing.count),
        count: existing.count,
    };
}

export async function consumeRateLimit(
    key: string,
    windowSeconds: number,
    max: number,
): Promise<RateLimitResult> {
    const redis = getRedis();
    if (redis) {
        try {
            if (redis.status === 'wait') {
                await redis.connect();
            }
            if (redis.status === 'ready') {
                const res = (await redis.eval(
                    CONSUME_LUA,
                    1,
                    key,
                    String(windowSeconds),
                )) as [number, number];
                const count = Number(res[0] ?? 1);
                const ttl = Math.max(1, Number(res[1] ?? windowSeconds));
                const allowed = count <= max;
                return {
                    allowed,
                    retryAfter: allowed ? null : ttl,
                    remaining: Math.max(0, max - count),
                    count,
                };
            }
        } catch {
            // Fall through to in-memory limiter if Redis is temporarily unavailable.
        }
    }

    return consumeMemory(key, windowSeconds, max);
}

export const betterAuthRateLimitStorage: BetterAuthRateLimitStorage = {
    async consume(key, rule) {
        const res = await consumeRateLimit(`ba:rl:${key}`, rule.window, rule.max);
        return {
            allowed: res.allowed,
            retryAfter: res.retryAfter,
        };
    },
};

function emailKeyHash(email: string): string {
    return createHash('sha256')
        .update(email.toLowerCase().trim())
        .digest('hex')
        .slice(0, 32);
}

async function getKeyTtlSeconds(key: string): Promise<number | null> {
    const redis = getRedis();
    if (redis) {
        try {
            if (redis.status === 'wait') await redis.connect();
            if (redis.status === 'ready') {
                const ttl = await redis.ttl(key);
                if (ttl > 0) return ttl;
                if (ttl === -1) return LOGIN_LOCK_SECONDS;
                return null;
            }
        } catch {
            // Fallback to memory
        }
    }
    const entry = memBuckets.get(key);
    if (!entry) return null;
    const now = Date.now();
    if (now >= entry.expiresAt) {
        memBuckets.delete(key);
        return null;
    }
    return Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
}

async function setLockKey(key: string, seconds: number): Promise<void> {
    const redis = getRedis();
    if (redis) {
        try {
            if (redis.status === 'wait') await redis.connect();
            if (redis.status === 'ready') {
                await redis.set(key, '1', 'EX', seconds);
                return;
            }
        } catch {
            // Fallback to memory
        }
    }
    memBuckets.set(key, { count: 1, expiresAt: Date.now() + seconds * 1000 });
}

export async function deleteRateLimitKeys(...keys: string[]): Promise<void> {
    for (const k of keys) memBuckets.delete(k);
    const redis = getRedis();
    if (redis && keys.length > 0) {
        try {
            if (redis.status === 'wait') await redis.connect();
            if (redis.status === 'ready') {
                await redis.del(...keys);
            }
        } catch {
            // Ignore Redis delete errors on fallback
        }
    }
}

export async function isLoginLocked(
    email: string,
): Promise<{ locked: boolean; retryAfterSeconds: number }> {
    const hash = emailKeyHash(email);
    const ttl = await getKeyTtlSeconds(`login:lock:${hash}`);
    if (ttl !== null && ttl > 0) {
        return { locked: true, retryAfterSeconds: ttl };
    }
    return { locked: false, retryAfterSeconds: 0 };
}

export async function recordLoginFailure(
    email: string,
): Promise<{ locked: boolean; retryAfterSeconds: number; attempts: number }> {
    const hash = emailKeyHash(email);
    const failKey = `login:fail:${hash}`;
    const lockKey = `login:lock:${hash}`;

    const res = await consumeRateLimit(
        failKey,
        LOGIN_WINDOW_SECONDS,
        LOGIN_MAX_ATTEMPTS,
    );

    if (res.count >= LOGIN_MAX_ATTEMPTS) {
        await setLockKey(lockKey, LOGIN_LOCK_SECONDS);
        await deleteRateLimitKeys(failKey);
        return {
            locked: true,
            retryAfterSeconds: LOGIN_LOCK_SECONDS,
            attempts: res.count,
        };
    }

    return {
        locked: false,
        retryAfterSeconds: 0,
        attempts: res.count,
    };
}

export async function clearLoginFailures(email: string): Promise<void> {
    const hash = emailKeyHash(email);
    await deleteRateLimitKeys(`login:fail:${hash}`, `login:lock:${hash}`);
}

export async function getClientIpFromHeaders(): Promise<string> {
    try {
        const h = await headers();
        const cf = h.get('cf-connecting-ip')?.trim();
        if (cf) return cf;
        const real = h.get('x-real-ip')?.trim();
        if (real) return real;
        const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
        if (forwarded) return forwarded;
    } catch {
        // Outside request context
    }
    return 'unknown';
}

export const OTP_MAX_VERIFY_ATTEMPTS = 5;

export function generateOtpCode(): string {
    return randomInt(100_000, 1_000_000).toString();
}

export function hashOtp(identifier: string, otp: string): string {
    const secret = process.env.BETTER_AUTH_SECRET || 'wali-epi-otp-fallback';
    return createHmac('sha256', secret)
        .update(`${identifier}:${otp}`)
        .digest('hex');
}

export function verifyOtpDigest(
    storedHex: string,
    identifier: string,
    candidateOtp: string,
): boolean {
    if (!/^[0-9a-f]{64}$/i.test(storedHex)) return false;
    const expected = Buffer.from(storedHex, 'hex');
    const actual = Buffer.from(hashOtp(identifier, candidateOtp), 'hex');
    return (
        expected.length === actual.length && timingSafeEqual(expected, actual)
    );
}

export async function checkOtpSendRateLimit(
    scope: 'register' | 'reset',
    email: string,
): Promise<{ allowed: boolean; error?: string }> {
    const ip = await getClientIpFromHeaders();
    const ipLimit = await consumeRateLimit(`otp:send:ip:${ip}`, 600, 10);
    if (!ipLimit.allowed) {
        return {
            allowed: false,
            error: `Terlalu banyak permintaan OTP dari jaringan ini. Coba lagi dalam ${Math.ceil((ipLimit.retryAfter ?? 60) / 60)} menit.`,
        };
    }

    const hash = emailKeyHash(email);
    const cd = await consumeRateLimit(`otp:cd:${scope}:${hash}`, 55, 1);
    if (!cd.allowed) {
        return {
            allowed: false,
            error: `Harap tunggu ${cd.retryAfter ?? 60} detik sebelum meminta kode OTP baru.`,
        };
    }

    const emailLimit = await consumeRateLimit(
        `otp:send:${scope}:${hash}`,
        600,
        5,
    );
    if (!emailLimit.allowed) {
        return {
            allowed: false,
            error: 'Batas pengiriman OTP ke email ini tercapai. Coba lagi dalam 10 menit.',
        };
    }

    return { allowed: true };
}

export async function recordOtpVerifyAttempt(
    identifier: string,
): Promise<{ exhausted: boolean; remaining: number }> {
    const res = await consumeRateLimit(
        `otp:vfail:${emailKeyHash(identifier)}`,
        600,
        OTP_MAX_VERIFY_ATTEMPTS,
    );
    return {
        exhausted: res.count >= OTP_MAX_VERIFY_ATTEMPTS,
        remaining: Math.max(0, OTP_MAX_VERIFY_ATTEMPTS - res.count),
    };
}

export async function clearOtpVerifyAttempts(identifier: string): Promise<void> {
    await deleteRateLimitKeys(`otp:vfail:${emailKeyHash(identifier)}`);
}
