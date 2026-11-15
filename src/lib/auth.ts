import { betterAuth, APIError } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware, isAPIError } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { account, session, user, users, verification } from '@/db/schema';
import {
    betterAuthRateLimitStorage,
    clearLoginFailures,
    isLoginLocked,
    recordLoginFailure,
} from './rate-limit';
import { ROLES } from './roles';

export const auth = betterAuth({
    // Without this, better-auth falls back to an internal default: sessions
    // signed with one value become invalid the moment the fallback shifts, and
    // a known default lets anyone forge a cookie in production. Passed
    // explicitly so the value is owned by the deployment, not the library.
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
        provider: 'pg',
        schema: { user, session, account, verification },
    }),
    // Self-registration is open again, but an account it creates cannot be used
    // until an administrator approves it: `disableSignUp` used to be the only
    // thing standing between a public POST and a live session, so the gate now
    // lives in the database (`status = PENDING`) and in the hook below, and the
    // sign-up path is safe to expose.
    emailAndPassword: {
        enabled: true,
        autoSignIn: false,
        minPasswordLength: 7,
        requireEmailVerification: false,
    },
    // Rejects cross-site POSTs with a valid-looking Origin; the cookie is
    // SameSite anyway, but auth endpoints are the one place worth both.
    trustedOrigins: [
        process.env.BETTER_AUTH_URL,
        process.env.NEXT_PUBLIC_APP_URL,
        'http://localhost:3000',
    ].filter((v): v is string => Boolean(v)),
    rateLimit: {
        enabled: true,
        window: 60,
        max: 30,
        customStorage: betterAuthRateLimitStorage,
        customRules: {
            // Credential stuffing: IP-level burst cap paired with per-account
            // lockout in `hooks` below so shared clinic NATs aren't disrupted.
            '/sign-in/email': { window: 60, max: 10 },
            '/sign-up/email': { window: 60, max: 5 },
        },
    },
    user: {
        additionalFields: {
            role: {
                type: [...ROLES],
                required: false,
                defaultValue: 'PUSKESMAS',
                // Server-owned: registration must never pick its own role (C1).
                input: false,
            },
            institutionId: {
                type: 'string',
                required: false,
                input: false,
            },
            isActive: {
                type: 'boolean',
                required: false,
                defaultValue: true,
                input: false,
            },
            status: {
                type: ['PENDING', 'APPROVED', 'REJECTED'],
                required: false,
                defaultValue: 'APPROVED',
                // Server-owned. A request that could name its own status would
                // approve itself, which is the whole point of the approval.
                input: false,
            },
        },
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
    },
    advanced: {
        // IDs come from the Drizzle schema's uuid().defaultRandom(), so
        // better-auth must generate a UUID, not its default 32-char string.
        database: { generateId: 'uuid' },
        ipAddress: {
            ipAddressHeaders: ['cf-connecting-ip', 'x-real-ip', 'x-forwarded-for'],
        },
    },
    hooks: {
        before: createAuthMiddleware(async (ctx) => {
            if (ctx.path === '/sign-up/email' && ctx.request) {
                throw new APIError('FORBIDDEN', {
                    message:
                        'Pendaftaran akun wajib melalui verifikasi OTP di halaman /daftar.',
                });
            }

            if (ctx.path === '/sign-in/email') {
                const rawEmail = (ctx.body as { email?: unknown } | undefined)
                    ?.email;
                const email =
                    typeof rawEmail === 'string'
                        ? rawEmail.toLowerCase().trim()
                        : '';
                if (email) {
                    const lock = await isLoginLocked(email);
                    if (lock.locked) {
                        const mins = Math.max(
                            1,
                            Math.ceil(lock.retryAfterSeconds / 60),
                        );
                        throw new APIError('TOO_MANY_REQUESTS', {
                            code: 'TOO_MANY_REQUESTS',
                            message: `Terlalu banyak percobaan masuk gagal. Coba lagi dalam ${mins} menit.`,
                        });
                    }
                }
            }
        }),
        after: createAuthMiddleware(async (ctx) => {
            if (ctx.path !== '/sign-in/email') return;

            const rawEmail = (ctx.body as { email?: unknown } | undefined)?.email;
            const email =
                typeof rawEmail === 'string'
                    ? rawEmail.toLowerCase().trim()
                    : '';
            if (!email) return;

            const returned = ctx.context.returned;
            if (isAPIError(returned)) {
                if (returned.statusCode !== 429) {
                    const result = await recordLoginFailure(email);
                    if (result.locked) {
                        const mins = Math.max(
                            1,
                            Math.ceil(result.retryAfterSeconds / 60),
                        );
                        throw new APIError('TOO_MANY_REQUESTS', {
                            code: 'TOO_MANY_REQUESTS',
                            message: `Terlalu banyak percobaan masuk gagal. Akun dikunci sementara selama ${mins} menit.`,
                        });
                    }
                }
                return;
            }

            if (returned) {
                await clearLoginFailures(email);
            }
        }),
    },
    databaseHooks: {
        session: {
            create: {
                /**
                 * The one gate every sign-in path passes through — email and
                 * password, and any future OAuth provider added to this config.
                 * Returning false aborts the session creation, so a PENDING or
                 * rejected account cannot hold a cookie even for one request.
                 * The message is the same for both states on purpose: it tells
                 * the person what to do without confirming to a stranger which
                 * addresses are registered.
                 */
                before: async (sessionData) => {
                    const [account] = await getDb()
                        .select({
                            status: users.status,
                            isActive: users.isActive,
                        })
                        .from(users)
                        .where(eq(users.id, sessionData.userId))
                        .limit(1);

                    if (
                        !account ||
                        account.status !== 'APPROVED' ||
                        !account.isActive
                    ) {
                        throw new APIError('FORBIDDEN', {
                            message:
                                'Akun belum disetujui administrator atau sedang dinonaktifkan. Hubungi Dinas Kesehatan.',
                        });
                    }

                    return { data: sessionData };
                },
            },
        },
        user: {
            create: {
                /**
                 * Server-owned for the same reason `role` is `input: false`:
                 * the request must not choose whether it is approved. Anyone
                 * who reaches the public endpoint lands as PENDING and inactive,
                 * so a self-registered account holds no session even if the
                 * sign-in gate were ever bypassed. better-auth's own
                 * `/admin/create-user` and the seed script run this hook too,
                 * so both flip it back once an administrator is the actor.
                 */
                before: async (created) => ({
                    data: {
                        ...created,
                        status: 'PENDING',
                        isActive: false,
                    },
                }),
            },
        },
    },
    plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
