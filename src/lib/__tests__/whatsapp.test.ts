import { describe, it, expect } from 'vitest';
import {
    buildWhatsAppRequest,
    extractGatewayErrorDetail,
    getCooldownMs,
    matchOpenWaSessionId,
    normalizeIndonesianPhone,
    parseRateLimitMeta,
} from '../whatsapp';

describe('whatsapp OpenWA adapter & anti-ban helpers', () => {
    it('normalizes Indonesian phone numbers to 62 digits', () => {
        expect(normalizeIndonesianPhone('0812-3456-7890')).toBe(
            '6281234567890',
        );
        expect(normalizeIndonesianPhone('+62 812 3456 7890')).toBe(
            '6281234567890',
        );
        expect(normalizeIndonesianPhone('6281234567890')).toBe('6281234567890');
        expect(normalizeIndonesianPhone('81234567890')).toBe('6281234567890');
        expect(normalizeIndonesianPhone('UNCONFIGURED')).toBe('');
    });

    it('builds OpenWA send-text request with X-API-Key and @c.us chatId', () => {
        const req = buildWhatsAppRequest(
            {
                provider: 'openwa',
                url: 'http://openwa:2785/',
                sessionId: 'wali-epi',
                token: 'secret-key',
            },
            '6281234567890',
            {
                message: 'Halo petugas',
                eventKind: 'ASSIGNMENT',
                reportRSId: 'rep-1',
            },
        );

        expect(req.url).toBe(
            'http://openwa:2785/api/sessions/wali-epi/messages/send-text',
        );
        expect(req.headers['X-API-Key']).toBe('secret-key');
        expect(req.headers.Authorization).toBeUndefined();
        expect(JSON.parse(req.body)).toEqual({
            chatId: '6281234567890@c.us',
            text: 'Halo petugas',
        });
    });

    it('rejects invalid or missing OpenWA sessionId', () => {
        expect(() =>
            buildWhatsAppRequest(
                {
                    provider: 'openwa',
                    url: 'http://openwa:2785',
                    sessionId: '../bad',
                },
                '6281234567890',
                { message: 'hi', eventKind: 'TEST' },
            ),
        ).toThrow(/Session ID/);
    });

    it('preserves generic webhook Bearer payload contract', () => {
        const req = buildWhatsAppRequest(
            {
                provider: 'generic',
                url: 'https://wa.example.com/hook',
                token: 'bearer-tok',
            },
            '6281234567890',
            {
                message: 'Alert SLA',
                eventKind: 'SLA_WARNING_6H',
                reportRSId: 'rep-2',
            },
        );

        expect(req.url).toBe('https://wa.example.com/hook');
        expect(req.headers.Authorization).toBe('Bearer bearer-tok');
        expect(JSON.parse(req.body)).toEqual({
            target: '6281234567890',
            phone: '6281234567890',
            message: 'Alert SLA',
            eventKind: 'SLA_WARNING_6H',
            reportRSId: 'rep-2',
        });
    });

    it('computes deduplication cooldown windows per event kind', () => {
        expect(getCooldownMs('TEST')).toBe(0);
        expect(getCooldownMs('MANUAL_ALERT')).toBe(0);
        expect(getCooldownMs('ASSIGNMENT')).toBe(10 * 60 * 1000);
        expect(getCooldownMs('PE_COMPLETED')).toBe(10 * 60 * 1000);
        expect(getCooldownMs('FOGGING_COMPLETED')).toBe(10 * 60 * 1000);
        expect(getCooldownMs('SLA_WARNING_6H')).toBe(6 * 60 * 60 * 1000);
        expect(getCooldownMs('SLA_ESCALATION_24H')).toBe(6 * 60 * 60 * 1000);
        expect(getCooldownMs('PE_SLA_WARNING')).toBe(6 * 60 * 60 * 1000);
    });

    it('parses OpenWA HTTP 429 SEND_PACING_LIMITED metadata', () => {
        expect(parseRateLimitMeta(200, '{}')).toEqual({ rateLimited: false });
        expect(
            parseRateLimitMeta(
                429,
                JSON.stringify({
                    code: 'SEND_PACING_LIMITED',
                    retryAfterSeconds: 42,
                }),
            ),
        ).toEqual({
            rateLimited: true,
            code: 'SEND_PACING_LIMITED',
            retryAfterSeconds: 42,
        });
        expect(parseRateLimitMeta(429, 'Too Many Requests', '15')).toEqual({
            rateLimited: true,
            code: undefined,
            retryAfterSeconds: 15,
        });
    });

    it('extracts OpenWA JSON error messages and ignores HTML error pages', () => {
        expect(
            extractGatewayErrorDetail(
                400,
                JSON.stringify({
                    statusCode: 400,
                    message:
                        "Session 'wali-epi' is not active. Start the session first.",
                    error: 'Bad Request',
                }),
            ),
        ).toBe(
            "HTTP 400: Session 'wali-epi' is not active. Start the session first.",
        );
        expect(
            extractGatewayErrorDetail(
                400,
                JSON.stringify({ message: ['chatId invalid', 'text empty'] }),
            ),
        ).toBe('HTTP 400: chatId invalid; text empty');
        expect(
            extractGatewayErrorDetail(400, '<html><body>Bad</body></html>'),
        ).toBe('HTTP 400');
    });

    it('resolves OpenWA session UUID from exact id, name, or unique 12-char prefix', () => {
        const sessions = [
            { id: '8f3c2b1a-9d4e-4c7a-8b2f-1e6d5a4c3b2a', name: 'wali-epi' },
            { id: '8f3c2b1a-0000-4c7a-8b2f-1e6d5a4c3b2b', name: 'cadangan' },
        ];
        expect(
            matchOpenWaSessionId(
                sessions,
                '8f3c2b1a-9d4e-4c7a-8b2f-1e6d5a4c3b2a',
            ),
        ).toBe('8f3c2b1a-9d4e-4c7a-8b2f-1e6d5a4c3b2a');
        expect(matchOpenWaSessionId(sessions, 'wali-epi')).toBe(
            '8f3c2b1a-9d4e-4c7a-8b2f-1e6d5a4c3b2a',
        );
        expect(matchOpenWaSessionId(sessions, '8f3c2b1a-9d4')).toBe(
            '8f3c2b1a-9d4e-4c7a-8b2f-1e6d5a4c3b2a',
        );
        expect(matchOpenWaSessionId(sessions, '8f3c2b1a')).toBeUndefined();
    });
});
