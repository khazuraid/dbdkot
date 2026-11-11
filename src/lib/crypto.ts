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
    const secret = process.env.PII_ENCRYPTION_KEY;

    if (!secret) {
        throw new Error('PII_ENCRYPTION_KEY is not set');
    }

    const buf = Buffer.from(secret, 'base64');

    if (buf.length !== 32) {
        throw new Error(
            'PII_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)',
        );
    }

    return buf;
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
