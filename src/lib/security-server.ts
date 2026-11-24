import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { decryptPii, encryptPii } from './crypto';
import { MASKED_SECRET } from './security';

const BLOCKED_HOSTNAMES = new Set([
    'localhost',
    'metadata.google.internal',
    'metadata.goog',
    'instance-data',
]);

function ipv4ToInt(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    let out = 0;
    for (const p of parts) {
        if (!/^\d+$/.test(p)) return null;
        const n = Number(p);
        if (n < 0 || n > 255) return null;
        out = (out << 8) | n;
    }
    return out >>> 0;
}

function inCidr4(ipInt: number, base: string, prefix: number): boolean {
    const baseInt = ipv4ToInt(base);
    if (baseInt === null) return false;
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipInt & mask) === (baseInt & mask);
}

/** Returns true if an IPv4 or IPv6 address is loopback, private, link-local, metadata, or reserved. */
export function isPrivateIp(address: string): boolean {
    const clean = address.trim().toLowerCase().replace(/^\[|\]$/g, '');
    const version = isIP(clean);
    if (version === 4) {
        const n = ipv4ToInt(clean);
        if (n === null) return true;
        return (
            inCidr4(n, '0.0.0.0', 8) ||
            inCidr4(n, '10.0.0.0', 8) ||
            inCidr4(n, '100.64.0.0', 10) ||
            inCidr4(n, '127.0.0.0', 8) ||
            inCidr4(n, '169.254.0.0', 16) ||
            inCidr4(n, '172.16.0.0', 12) ||
            inCidr4(n, '192.0.0.0', 24) ||
            inCidr4(n, '192.0.2.0', 24) ||
            inCidr4(n, '192.168.0.0', 16) ||
            inCidr4(n, '198.18.0.0', 15) ||
            inCidr4(n, '198.51.100.0', 24) ||
            inCidr4(n, '203.0.113.0', 24) ||
            inCidr4(n, '224.0.0.0', 4) ||
            inCidr4(n, '240.0.0.0', 4)
        );
    }
    if (version === 6) {
        if (clean === '::' || clean === '::1') return true;
        // IPv4-mapped IPv6 (`::ffff:127.0.0.1` or `::ffff:7f00:1`)
        const mapped = clean.match(/^::ffff:([0-9.]+)$/);
        if (mapped) return isPrivateIp(mapped[1]);
        const mappedHex = clean.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
        if (mappedHex) {
            const hi = parseInt(mappedHex[1], 16);
            const lo = parseInt(mappedHex[2], 16);
            return isPrivateIp(
                `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`,
            );
        }
        // fc00::/7 (ULA), fe80::/10 (link-local), fec0::/10, ff00::/8 (multicast), 100::/64
        const firstHextet = parseInt(clean.split(':')[0] || '0', 16);
        if (
            (firstHextet & 0xfe00) === 0xfc00 ||
            (firstHextet & 0xffc0) === 0xfe80 ||
            (firstHextet & 0xffc0) === 0xfec0 ||
            (firstHextet & 0xff00) === 0xff00
        ) {
            return true;
        }
        return false;
    }
    return true;
}

export type ExternalUrlOptions = {
    allowHttp?: boolean;
    skipDnsLookup?: boolean;
};

/**
 * Validates that an outbound URL targets a public HTTPS host and does not
 * resolve to loopback, RFC1918, link-local, or cloud metadata addresses (SSRF guard).
 */
export async function assertSafeExternalUrl(
    raw: string,
    opts: ExternalUrlOptions = {},
): Promise<URL> {
    let parsed: URL;
    try {
        parsed = new URL(raw.trim());
    } catch {
        throw new Error('URL tidak valid.');
    }

    const allowedProtocols = opts.allowHttp ? ['https:', 'http:'] : ['https:'];
    if (!allowedProtocols.includes(parsed.protocol)) {
        throw new Error('URL eksternal wajib menggunakan protokol HTTPS.');
    }

    if (parsed.username || parsed.password) {
        throw new Error('URL tidak boleh mengandung kredensial.');
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
        !hostname ||
        BLOCKED_HOSTNAMES.has(hostname) ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal')
    ) {
        throw new Error('Host internal atau lokal tidak diizinkan.');
    }

    if (isIP(hostname) !== 0) {
        if (isPrivateIp(hostname)) {
            throw new Error('Alamat IP privat atau internal tidak diizinkan.');
        }
        return parsed;
    }

    if (!opts.skipDnsLookup) {
        let records: Array<{ address: string }>;
        try {
            records = await lookup(hostname, { all: true });
        } catch {
            throw new Error('Host tujuan tidak dapat di-resolve.');
        }
        if (records.length === 0) {
            throw new Error('Host tujuan tidak memiliki alamat IP.');
        }
        for (const rec of records) {
            if (isPrivateIp(rec.address)) {
                throw new Error(
                    'Host tujuan mengarah ke alamat IP privat atau internal.',
                );
            }
        }
    }

    return parsed;
}

/** Outbound fetch with SSRF validation and redirects disabled (`redirect: 'error'`). */
export async function safeFetch(
    rawUrl: string,
    init?: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } },
    opts?: ExternalUrlOptions,
): Promise<Response> {
    const safeUrl = await assertSafeExternalUrl(rawUrl, opts);
    return fetch(safeUrl.toString(), {
        ...init,
        redirect: 'error',
    });
}

/** Encrypts a secret setting value at rest using AES-256-GCM (`v1.*`). */
export function encryptSettingValue(plaintext: string): string {
    const trimmed = plaintext.trim();
    if (!trimmed || trimmed === MASKED_SECRET) return '';
    if (trimmed.startsWith('v1.')) return trimmed;
    return encryptPii(trimmed);
}

/** Decrypts a secret setting value, supporting legacy plaintext rows seamlessly. */
export function decryptSettingValue(stored: string | null | undefined): string {
    if (!stored) return '';
    const trimmed = stored.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('v1.')) {
        try {
            return decryptPii(trimmed);
        } catch {
            return '';
        }
    }
    return trimmed;
}
