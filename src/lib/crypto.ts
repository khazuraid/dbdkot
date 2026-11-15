import {
    createCipheriv,
    createDecipheriv,
    createHmac,
    randomBytes,
} from 'node:crypto';

/**
 * PII at rest (C5). The legacy prototype wrote plaintext into columns named
 * `*_encrypted`; encryption there did not exist. This module is the real thing.
 *
 * Format: `v1.<iv-b64>.<tag-b64>.<ciphertext-b64>`, AES-256-GCM.
 * The version prefix lets a future key/algorithm change migrate lazily.
 */

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_BYTES = 12;

function key(): Buffer {
    const raw = process.env.PII_ENCRYPTION_KEY;
    const secret = raw?.trim().replace(/^['"]|['"]$/g, '');

    if (!secret) {
        throw new Error('PII_ENCRYPTION_KEY is not set');
    }

    // 1. Standard Base64 or URL-safe Base64 decoding to 32 bytes (e.g. `openssl rand -base64 32`)
    const b64Normalized = secret.replace(/-/g, '+').replace(/_/g, '/');
    const b64Buf = Buffer.from(b64Normalized, 'base64');
    if (b64Buf.length === 32 && /^[A-Za-z0-9+/]+=*$/.test(b64Normalized)) {
        return b64Buf;
    }

    // 2. 64-character hex encoding (e.g. `openssl rand -hex 32`)
    if (/^[0-9a-fA-F]{64}$/.test(secret)) {
        return Buffer.from(secret, 'hex');
    }

    // 3. Raw 32-byte UTF-8 secret
    if (Buffer.byteLength(secret, 'utf8') === 32) {
        return Buffer.from(secret, 'utf8');
    }

    throw new Error(
        `PII_ENCRYPTION_KEY must be 32 bytes (base64/hex/utf8), got ${secret.length} chars (${b64Buf.length} base64 bytes)`,
    );
}

export function encryptPii(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key(), iv);
    const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);

    return [
        VERSION,
        iv.toString('base64'),
        cipher.getAuthTag().toString('base64'),
        ciphertext.toString('base64'),
    ].join('.');
}

export function decryptPii(payload: string): string {
    const parts = payload.split('.');

    if (parts.length !== 4 || parts[0] !== VERSION) {
        throw new Error('Malformed encrypted PII payload');
    }

    const [, ivB64, tagB64, dataB64] = parts;
    const decipher = createDecipheriv(
        ALGORITHM,
        key(),
        Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

    return Buffer.concat([
        decipher.update(Buffer.from(dataB64, 'base64')),
        decipher.final(),
    ]).toString('utf8');
}

/**
 * Keyed hash so a NIK can still be looked up exactly without storing it in
 * plaintext. Plain SHA-256 would be reversible by brute force over the small
 * NIK space, so this must stay keyed.
 */
export function hashPii(value: string): string {
    const secret = process.env.PII_HASH_KEY;

    if (!secret) {
        throw new Error('PII_HASH_KEY is not set');
    }

    return createHmac('sha256', secret)
        .update(value.trim().toLowerCase())
        .digest('hex');
}
