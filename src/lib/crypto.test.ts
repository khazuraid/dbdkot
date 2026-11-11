import { describe, expect, it, beforeAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { decryptPii, encryptPii, hashPii } from './crypto';

beforeAll(() => {
    process.env.PII_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    process.env.PII_HASH_KEY = randomBytes(32).toString('hex');
});

describe('encryptPii / decryptPii', () => {
    it('round-trips a NIK', () => {
        const nik = '3273010101990001';
        expect(decryptPii(encryptPii(nik))).toBe(nik);
    });

    it('never stores the plaintext', () => {
        const nik = '3273010101990001';
        expect(encryptPii(nik)).not.toContain(nik);
    });

    it('produces a distinct ciphertext each time (random IV)', () => {
        expect(encryptPii('same')).not.toBe(encryptPii('same'));
    });

    it('rejects a tampered ciphertext', () => {
        const payload = encryptPii('3273010101990001');
        const parts = payload.split('.');
        const bytes = Buffer.from(parts[3], 'base64');
        bytes[0] ^= 0xff;
        parts[3] = bytes.toString('base64');

        expect(() => decryptPii(parts.join('.'))).toThrow();
    });

    it('rejects a malformed payload', () => {
        expect(() => decryptPii('plaintext')).toThrow('Malformed');
    });

    it('refuses to operate without a key', () => {
        const saved = process.env.PII_ENCRYPTION_KEY;
        delete process.env.PII_ENCRYPTION_KEY;
        expect(() => encryptPii('x')).toThrow('PII_ENCRYPTION_KEY');
        process.env.PII_ENCRYPTION_KEY = saved;
    });
});

describe('hashPii', () => {
    it('is stable for the same input regardless of surrounding whitespace', () => {
        expect(hashPii(' 3273010101990001 ')).toBe(hashPii('3273010101990001'));
    });

    it('differs between values', () => {
        expect(hashPii('3273010101990001')).not.toBe(
            hashPii('3273010101990002'),
        );
    });
});
