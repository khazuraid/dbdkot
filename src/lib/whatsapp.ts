import { and, eq, gte, isNull } from 'drizzle-orm';
import { getDb } from '../db';
import { systemSettings, waDispatches } from '../db/schema';
import { isValidUuid } from './security';
import {
    decryptSettingValue,
    getTrustedWhatsAppOrigins,
    safeFetch,
} from './security-server';

export type WaProvider = 'openwa' | 'generic';

export type WaEventKind =
    | 'ASSIGNMENT'
    | 'SLA_WARNING_6H'
    | 'SLA_ESCALATION_24H'
    | 'PE_SLA_WARNING'
    | 'FOGGING_REQUIRED'
    | 'FOGGING_H_MINUS_1'
    | 'FOGGING_DAY_0'
    | 'CROSS_BORDER'
    | 'TEST';

export type DispatchWhatsAppInput = {
    recipientPhone: string;
    recipientRole?: string | null;
    institutionId?: string | null;
    reportRSId?: string | null;
    eventKind: WaEventKind;
    message: string;
};

export type DispatchWhatsAppResult = {
    id: string;
    providerMode: 'WEBHOOK' | 'LOCAL_FALLBACK';
    deliveryStatus: 'SENT' | 'FALLBACK_LOGGED' | 'FAILED';
    detail?: string;
};

export type GatewayConfig = {
    provider: WaProvider;
    url: string;
    sessionId?: string;
    token?: string;
    enabled: boolean;
    envManaged?: boolean;
};

export type WhatsAppGatewaySummary = {
    provider: WaProvider;
    baseUrl: string;
    sessionId: string;
    enabled: boolean;
    hasToken: boolean;
    envManaged: boolean;
};

const SESSION_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const DISPATCH_TIMEOUT_MS = 15_000;

export function normalizeIndonesianPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) return `62${digits.slice(1)}`;
    if (digits.startsWith('62')) return digits;
    if (digits.startsWith('8')) return `62${digits}`;
    return digits;
}

export function getCooldownMs(eventKind: WaEventKind): number {
    if (eventKind === 'TEST') return 0;
    if (
        eventKind === 'SLA_WARNING_6H' ||
        eventKind === 'SLA_ESCALATION_24H' ||
        eventKind === 'PE_SLA_WARNING'
    ) {
        return 6 * 60 * 60 * 1000;
    }
    return 10 * 60 * 1000;
}

export function parseRateLimitMeta(
    status: number,
    bodyText: string,
    retryAfterHeader?: string | null,
): { rateLimited: boolean; code?: string; retryAfterSeconds?: number } {
    if (status !== 429) return { rateLimited: false };
    let code: string | undefined;
    let retryAfterSeconds: number | undefined;
    try {
        const parsed = JSON.parse(bodyText) as {
            code?: unknown;
            retryAfterSeconds?: unknown;
        };
        if (typeof parsed.code === 'string') code = parsed.code;
        if (
            typeof parsed.retryAfterSeconds === 'number' &&
            Number.isFinite(parsed.retryAfterSeconds)
        ) {
            retryAfterSeconds = parsed.retryAfterSeconds;
        }
    } catch {
        // Non-JSON 429 body
    }
    if (retryAfterSeconds === undefined && retryAfterHeader) {
        const n = Number(retryAfterHeader);
        if (Number.isFinite(n) && n >= 0) retryAfterSeconds = n;
    }
    return { rateLimited: true, code, retryAfterSeconds };
}

export function extractGatewayErrorDetail(
    status: number,
    bodyText: string,
): string {
    let msg = '';
    const trimmed = bodyText.trim();
    if (trimmed) {
        try {
            const parsed = JSON.parse(trimmed) as {
                message?: unknown;
                error?: unknown;
            };
            if (Array.isArray(parsed.message)) {
                msg = parsed.message
                    .filter((m): m is string => typeof m === 'string')
                    .join('; ')
                    .trim();
            } else if (typeof parsed.message === 'string') {
                msg = parsed.message.trim();
            } else if (typeof parsed.error === 'string') {
                msg = parsed.error.trim();
            }
        } catch {
            if (!/^\s*</.test(trimmed)) {
                msg = trimmed;
            }
        }
    }
    if (!msg) return `HTTP ${status}`;
    const clipped = msg.length > 200 ? `${msg.slice(0, 197)}...` : msg;
    return `HTTP ${status}: ${clipped}`;
}

export function matchOpenWaSessionId(
    sessions: unknown,
    rawSessionId: string,
): string | undefined {
    const raw = rawSessionId.trim();
    if (!raw || !Array.isArray(sessions)) return undefined;
    const rows = sessions.filter(
        (s): s is { id: string; name?: unknown } =>
            Boolean(s) &&
            typeof s === 'object' &&
            typeof (s as { id?: unknown }).id === 'string' &&
            (s as { id: string }).id.length > 0,
    );
    const byId = rows.find((s) => s.id === raw);
    if (byId) return byId.id;
    const byName = rows.find((s) => s.name === raw);
    if (byName) return byName.id;
    const byPrefix = rows.filter((s) => s.id.startsWith(raw));
    return byPrefix.length === 1 ? byPrefix[0].id : undefined;
}

async function resolveOpenWaSessionId(
    gateway: GatewayConfig,
): Promise<GatewayConfig> {
    const raw = gateway.sessionId?.trim() ?? '';
    if (gateway.provider !== 'openwa' || !raw || isValidUuid(raw)) {
        return gateway;
    }
    const base = gateway.url.trim().replace(/\/+$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
        const res = await safeFetch(
            `${base}/api/sessions`,
            {
                method: 'GET',
                headers: gateway.token ? { 'X-API-Key': gateway.token } : {},
                signal: controller.signal,
            },
            { allowedInternalOrigins: getTrustedWhatsAppOrigins() },
        );
        if (!res.ok) return gateway;
        const data: unknown = await res.json().catch(() => null);
        const resolved = matchOpenWaSessionId(data, raw);
        return resolved ? { ...gateway, sessionId: resolved } : gateway;
    } catch {
        return gateway;
    } finally {
        clearTimeout(timer);
    }
}

export function buildWhatsAppRequest(
    gateway: Pick<GatewayConfig, 'provider' | 'url' | 'sessionId' | 'token'>,
    phone: string,
    input: Pick<DispatchWhatsAppInput, 'message' | 'eventKind' | 'reportRSId'>,
): { url: string; headers: Record<string, string>; body: string } {
    if (gateway.provider === 'openwa') {
        const sessionId = gateway.sessionId?.trim() ?? '';
        if (!SESSION_ID_RE.test(sessionId)) {
            throw new Error('Session ID OpenWA tidak valid atau belum diisi.');
        }
        const base = gateway.url.trim().replace(/\/+$/, '');
        return {
            url: `${base}/api/sessions/${encodeURIComponent(sessionId)}/messages/send-text`,
            headers: {
                'Content-Type': 'application/json',
                ...(gateway.token ? { 'X-API-Key': gateway.token } : {}),
            },
            body: JSON.stringify({
                chatId: `${phone}@c.us`,
                text: input.message,
            }),
        };
    }

    return {
        url: gateway.url.trim(),
        headers: {
            'Content-Type': 'application/json',
            ...(gateway.token
                ? { Authorization: `Bearer ${gateway.token}` }
                : {}),
        },
        body: JSON.stringify({
            target: phone,
            phone,
            message: input.message,
            eventKind: input.eventKind,
            reportRSId: input.reportRSId ?? null,
        }),
    };
}

type StoredGatewayJson = {
    provider?: string;
    baseUrl?: string;
    webhookUrl?: string;
    sessionId?: string;
    token?: string;
    enabled?: boolean;
};

async function readStoredGatewayConfig(): Promise<GatewayConfig> {
    const envUrl = process.env.WHATSAPP_API_URL?.trim();
    const envToken = process.env.WHATSAPP_API_TOKEN?.trim();
    const envSession = process.env.WHATSAPP_SESSION_ID?.trim();
    const envProviderRaw = process.env.WHATSAPP_PROVIDER?.trim().toLowerCase();
    if (envUrl) {
        const provider: WaProvider =
            envProviderRaw === 'openwa' || envProviderRaw === 'generic'
                ? envProviderRaw
                : envSession
                  ? 'openwa'
                  : 'generic';
        return {
            provider,
            url: envUrl,
            sessionId: envSession || undefined,
            token: envToken || undefined,
            enabled: true,
            envManaged: true,
        };
    }

    try {
        const [setting] = await getDb()
            .select({ value: systemSettings.value })
            .from(systemSettings)
            .where(eq(systemSettings.key, 'whatsapp_gateway'))
            .limit(1);
        const rawStored = decryptSettingValue(setting?.value);
        let val: StoredGatewayJson | undefined;
        if (rawStored) {
            try {
                val = JSON.parse(rawStored) as StoredGatewayJson;
            } catch {
                val = undefined;
            }
        }
        const url = (val?.baseUrl ?? val?.webhookUrl ?? '').trim();
        const sessionId = val?.sessionId?.trim() || undefined;
        const provider: WaProvider =
            val?.provider === 'openwa' || val?.provider === 'generic'
                ? val.provider
                : sessionId
                  ? 'openwa'
                  : 'generic';
        return {
            provider,
            url,
            sessionId,
            token: val?.token?.trim() || undefined,
            enabled: Boolean(val?.enabled && url),
            envManaged: false,
        };
    } catch {
        // DB config optional; fallback logging remains available.
    }

    return { provider: 'openwa', url: '', enabled: false, envManaged: false };
}

async function resolveGatewayConfig(): Promise<GatewayConfig> {
    const cfg = await readStoredGatewayConfig();
    if (!cfg.enabled || !cfg.url) {
        return { ...cfg, url: '', enabled: false };
    }
    return cfg;
}

export async function getWhatsAppGatewaySummary(): Promise<WhatsAppGatewaySummary> {
    const cfg = await readStoredGatewayConfig();
    return {
        provider: cfg.provider,
        baseUrl: cfg.url,
        sessionId: cfg.sessionId ?? '',
        enabled: cfg.enabled,
        hasToken: Boolean(cfg.token),
        envManaged: Boolean(cfg.envManaged),
    };
}

/**
 * Sends a WhatsApp dispatch through OpenWA or a generic HTTP webhook adapter,
 * or falls back cleanly to a durable local audit row in `wa_dispatches`.
 */
export async function dispatchWhatsApp(
    input: DispatchWhatsAppInput,
): Promise<DispatchWhatsAppResult> {
    const phone = normalizeIndonesianPhone(input.recipientPhone);
    const db = getDb();

    if (!phone) {
        const [row] = await db
            .insert(waDispatches)
            .values({
                recipientPhone: input.recipientPhone || '-',
                recipientRole: input.recipientRole ?? null,
                institutionId: input.institutionId ?? null,
                reportRSId: input.reportRSId ?? null,
                eventKind: input.eventKind,
                message: input.message,
                providerMode: 'LOCAL_FALLBACK',
                deliveryStatus: 'FAILED',
                responseMeta: { reason: 'Nomor WhatsApp kosong/tidak valid' },
            })
            .returning({ id: waDispatches.id });
        return {
            id: row.id,
            providerMode: 'LOCAL_FALLBACK',
            deliveryStatus: 'FAILED',
            detail: 'Nomor WhatsApp kosong/tidak valid',
        };
    }

    const gateway = await resolveGatewayConfig();
    if (!gateway.enabled) {
        const [row] = await db
            .insert(waDispatches)
            .values({
                recipientPhone: phone,
                recipientRole: input.recipientRole ?? null,
                institutionId: input.institutionId ?? null,
                reportRSId: input.reportRSId ?? null,
                eventKind: input.eventKind,
                message: input.message,
                providerMode: 'LOCAL_FALLBACK',
                deliveryStatus: 'FALLBACK_LOGGED',
                responseMeta: {
                    note: 'Gateway webhook belum dikonfigurasi; pesan dicatat pada log lokal.',
                },
            })
            .returning({ id: waDispatches.id });

        return {
            id: row.id,
            providerMode: 'LOCAL_FALLBACK',
            deliveryStatus: 'FALLBACK_LOGGED',
        };
    }

    const cooldownMs = getCooldownMs(input.eventKind);
    if (cooldownMs > 0) {
        const since = new Date(Date.now() - cooldownMs);
        const [recent] = await db
            .select({ id: waDispatches.id })
            .from(waDispatches)
            .where(
                and(
                    eq(waDispatches.recipientPhone, phone),
                    eq(waDispatches.eventKind, input.eventKind),
                    eq(waDispatches.deliveryStatus, 'SENT'),
                    gte(waDispatches.createdAt, since),
                    input.reportRSId
                        ? eq(waDispatches.reportRSId, input.reportRSId)
                        : isNull(waDispatches.reportRSId),
                ),
            )
            .limit(1);

        if (recent) {
            const [row] = await db
                .insert(waDispatches)
                .values({
                    recipientPhone: phone,
                    recipientRole: input.recipientRole ?? null,
                    institutionId: input.institutionId ?? null,
                    reportRSId: input.reportRSId ?? null,
                    eventKind: input.eventKind,
                    message: input.message,
                    providerMode: 'LOCAL_FALLBACK',
                    deliveryStatus: 'FALLBACK_LOGGED',
                    responseMeta: {
                        skipped: 'duplicate_cooldown',
                        cooldownMs,
                        previousDispatchId: recent.id,
                    },
                })
                .returning({ id: waDispatches.id });

            return {
                id: row.id,
                providerMode: 'LOCAL_FALLBACK',
                deliveryStatus: 'FALLBACK_LOGGED',
                detail: 'Dilewati (cooldown duplikat)',
            };
        }
    }

    try {
        const resolvedGateway = await resolveOpenWaSessionId(gateway);
        const req = buildWhatsAppRequest(resolvedGateway, phone, input);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);
        let res: Response;
        try {
            res = await safeFetch(
                req.url,
                {
                    method: 'POST',
                    headers: req.headers,
                    body: req.body,
                    signal: controller.signal,
                },
                { allowedInternalOrigins: getTrustedWhatsAppOrigins() },
            );
        } finally {
            clearTimeout(timer);
        }

        const bodyText = await res.text().catch(() => '');
        const status = res.ok ? 'SENT' : 'FAILED';
        const rateLimit = parseRateLimitMeta(
            res.status,
            bodyText,
            res.headers.get('retry-after'),
        );

        const [row] = await db
            .insert(waDispatches)
            .values({
                recipientPhone: phone,
                recipientRole: input.recipientRole ?? null,
                institutionId: input.institutionId ?? null,
                reportRSId: input.reportRSId ?? null,
                eventKind: input.eventKind,
                message: input.message,
                providerMode: 'WEBHOOK',
                deliveryStatus: status,
                responseMeta: {
                    provider: gateway.provider,
                    httpStatus: res.status,
                    ...(rateLimit.rateLimited ? rateLimit : {}),
                    body: bodyText.slice(0, 500),
                },
            })
            .returning({ id: waDispatches.id });

        return {
            id: row.id,
            providerMode: 'WEBHOOK',
            deliveryStatus: status,
            detail: res.ok
                ? undefined
                : rateLimit.rateLimited
                  ? `Rate limited (${rateLimit.code ?? 'HTTP 429'})`
                  : extractGatewayErrorDetail(res.status, bodyText),
        };
    } catch (err) {
        const reason = err instanceof Error ? err.message : 'Network error';
        const [row] = await db
            .insert(waDispatches)
            .values({
                recipientPhone: phone,
                recipientRole: input.recipientRole ?? null,
                institutionId: input.institutionId ?? null,
                reportRSId: input.reportRSId ?? null,
                eventKind: input.eventKind,
                message: input.message,
                providerMode: 'WEBHOOK',
                deliveryStatus: 'FAILED',
                responseMeta: { provider: gateway.provider, error: reason },
            })
            .returning({ id: waDispatches.id });

        return {
            id: row.id,
            providerMode: 'WEBHOOK',
            deliveryStatus: 'FAILED',
            detail: reason,
        };
    }
}
