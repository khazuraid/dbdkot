import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    escapeHtml,
    escapeLike,
    isSafeBrandingUrl,
    isSecretSettingKey,
    isValidUuid,
    isValidWilayahCode,
    maskPhone,
    sanitizeExcelCell,
    sanitizeWorkbookStrings,
} from '../security';
import {
    assertSafeExternalUrl,
    decryptSettingValue,
    encryptSettingValue,
    isPrivateIp,
} from '../security-server';
import { assertInsideUploadRoot } from '../attachments';
import { hashOtp } from '../rate-limit';

describe('security client-safe helpers', () => {
    it('escapes HTML meta-characters against stored XSS', () => {
        expect(escapeHtml(`<img src=x onerror="alert('xss')">&`)).toBe(
            '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;&amp;',
        );
        expect(escapeHtml(null)).toBe('');
    });

    it('escapes SQL LIKE wildcards', () => {
        expect(escapeLike('100%_test\\path')).toBe('100\\%\\_test\\\\path');
    });

    it('validates strict UUID format', () => {
        expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        expect(isValidUuid('not-a-uuid')).toBe(false);
        expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000;DROP')).toBe(false);
    });

    it('neutralizes Excel formula injection (CWE-1236) while keeping safe text', () => {
        expect(sanitizeExcelCell('=CMD|\' /C calc\'!A0')).toBe("'=CMD|' /C calc'!A0");
        expect(sanitizeExcelCell('+1+1')).toBe("'+1+1");
        expect(sanitizeExcelCell('-2+3')).toBe("'-2+3");
        expect(sanitizeExcelCell('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");
        expect(sanitizeExcelCell('  =1+1')).toBe("'  =1+1");
        expect(sanitizeExcelCell('Budi Santoso')).toBe('Budi Santoso');
        expect(sanitizeExcelCell(null)).toBeNull();
    });

    it('sanitizes workbook string cells without touching formula objects or numbers', () => {
        const cells = [
            { value: '=HYPERLINK("http://evil")' as unknown },
            { value: { formula: 'SUM(B1:B5)' } as unknown },
            { value: 42 as unknown },
            { value: 'Normal' as unknown },
        ];
        const fakeWb = {
            eachSheet(cb: (ws: { eachRow: (r: (row: { eachCell: (c: (cell: { value: unknown }) => void) => void }) => void) => void }) => void) {
                cb({
                    eachRow(rcb) {
                        rcb({
                            eachCell(ccb) {
                                cells.forEach(ccb);
                            },
                        });
                    },
                });
            },
        };
        sanitizeWorkbookStrings(fakeWb);
        expect(cells[0].value).toBe('\'=HYPERLINK("http://evil")');
        expect(cells[1].value).toEqual({ formula: 'SUM(B1:B5)' });
        expect(cells[2].value).toBe(42);
        expect(cells[3].value).toBe('Normal');
    });

    it('validates branding URLs and wilayah codes', () => {
        expect(isSafeBrandingUrl('')).toBe(true);
        expect(isSafeBrandingUrl('/logo.png')).toBe(true);
        expect(isSafeBrandingUrl('https://cdn.example.org/logo.png')).toBe(true);
        expect(isSafeBrandingUrl('javascript:alert(1)')).toBe(false);
        expect(isSafeBrandingUrl('http://insecure.example.org/a.png')).toBe(false);
        expect(isSafeBrandingUrl('//evil.example/x.png')).toBe(false);

        expect(isValidWilayahCode('32')).toBe(true);
        expect(isValidWilayahCode('32.73.01')).toBe(true);
        expect(isValidWilayahCode('../admin')).toBe(false);
        expect(isValidWilayahCode('32/../../etc')).toBe(false);
    });

    it('masks phone numbers and detects secret setting keys', () => {
        expect(maskPhone('081234567890')).toBe('0812••••890');
        expect(isSecretSettingKey('SMTP_PASS')).toBe(true);
        expect(isSecretSettingKey('REGIONAL_API_KEY')).toBe(true);
        expect(isSecretSettingKey('whatsapp_gateway')).toBe(true);
        expect(isSecretSettingKey('APP_TITLE')).toBe(false);
    });

    it('enforces attachment upload root containment', () => {
        expect(assertInsideUploadRoot('attachments/abc/file.pdf')).toBe(
            'attachments/abc/file.pdf',
        );
        expect(() => assertInsideUploadRoot('../etc/passwd')).toThrow();
        expect(() => assertInsideUploadRoot('attachments/../secret')).toThrow();
        expect(() => assertInsideUploadRoot('/etc/passwd')).toThrow();
        expect(() => assertInsideUploadRoot('attachments/a\0b.pdf')).toThrow();
    });
});

describe('security server-only helpers', () => {
    const origKey = process.env.PII_ENCRYPTION_KEY;
    const origAuthSecret = process.env.BETTER_AUTH_SECRET;

    beforeEach(() => {
        process.env.PII_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    });

    afterEach(() => {
        if (origKey === undefined) delete process.env.PII_ENCRYPTION_KEY;
        else process.env.PII_ENCRYPTION_KEY = origKey;
        if (origAuthSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
        else process.env.BETTER_AUTH_SECRET = origAuthSecret;
    });

    it('blocks private, loopback, link-local, IMDS, and IPv6 local addresses', () => {
        expect(isPrivateIp('127.0.0.1')).toBe(true);
        expect(isPrivateIp('10.0.0.1')).toBe(true);
        expect(isPrivateIp('172.16.0.5')).toBe(true);
        expect(isPrivateIp('192.168.1.1')).toBe(true);
        expect(isPrivateIp('169.254.169.254')).toBe(true);
        expect(isPrivateIp('100.64.0.1')).toBe(true);
        expect(isPrivateIp('::1')).toBe(true);
        expect(isPrivateIp('fc00::1')).toBe(true);
        expect(isPrivateIp('fe80::1')).toBe(true);
        expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
        expect(isPrivateIp('8.8.8.8')).toBe(false);
        expect(isPrivateIp('1.1.1.1')).toBe(false);
    });

    it('rejects SSRF URLs (http, localhost, metadata IP, embedded creds)', async () => {
        await expect(assertSafeExternalUrl('http://example.com')).rejects.toThrow();
        await expect(assertSafeExternalUrl('https://localhost/api')).rejects.toThrow();
        await expect(assertSafeExternalUrl('https://169.254.169.254/latest')).rejects.toThrow();
        await expect(assertSafeExternalUrl('https://user:pass@example.com')).rejects.toThrow();
    });

    it('encrypts and decrypts secret settings with plaintext fallback', () => {
        const cipher = encryptSettingValue('super-secret-token');
        expect(cipher.startsWith('v1.')).toBe(true);
        expect(decryptSettingValue(cipher)).toBe('super-secret-token');
        expect(decryptSettingValue('legacy-plaintext')).toBe('legacy-plaintext');
    });

    it('refuses to hash OTP when BETTER_AUTH_SECRET is missing', () => {
        delete process.env.BETTER_AUTH_SECRET;
        expect(() => hashOtp('reset-otp:a@b.com', '123456')).toThrow(/BETTER_AUTH_SECRET/);

        process.env.BETTER_AUTH_SECRET = 'test-secret-key-at-least-32-chars';
        const d1 = hashOtp('reset-otp:a@b.com', '123456');
        const d2 = hashOtp('reset-otp:a@b.com', '123456');
        expect(d1).toBe(d2);
        expect(d1).toHaveLength(64);
    });
});
