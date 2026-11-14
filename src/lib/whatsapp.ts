import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { systemSettings, waDispatches } from '@/db/schema';

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

type GatewayConfig = {
    url: string;
    token?: string;
    enabled: boolean;
};

export function normalizeIndonesianPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) return `62${digits.slice(1)}`;
    if (digits.startsWith('62')) return digits;
    return digits;
}

async function resolveGatewayConfig(): Promise<GatewayConfig> {
    const envUrl = process.env.WHATSAPP_API_URL?.trim();
    const envToken = process.env.WHATSAPP_API_TOKEN?.trim();
    if (envUrl) {
        return { url: envUrl, token: envToken, enabled: true };
    }

    try {
        const [setting] = await getDb()
            .select({ value: systemSettings.value })
            .from(systemSettings)
            .where(eq(systemSettings.key, 'whatsapp_gateway'))
            .limit(1);
        const val = setting?.value as
            | { webhookUrl?: string; token?: string; enabled?: boolean }
            | undefined;
        if (val?.enabled && val.webhookUrl?.trim()) {
            return {
                url: val.webhookUrl.trim(),
                token: val.token?.trim(),
                enabled: true,
            };
        }
    } catch {
        // DB config optional; fallback logging remains available.
    }

    return { url: '', enabled: false };
}

/**
 * Sends a WhatsApp dispatch through a configured HTTP webhook adapter
 * (Fonnte / Wablas / Meta Cloud / custom gateway) or falls back cleanly to a
 * durable local audit row in `wa_dispatches` when no gateway URL is configured.
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

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8_000);
        const res = await fetch(gateway.url, {
            method: 'POST',
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
            signal: controller.signal,
        });
        clearTimeout(timer);

        const bodyText = await res.text().catch(() => '');
        const status = res.ok ? 'SENT' : 'FAILED';

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
                    httpStatus: res.status,
                    body: bodyText.slice(0, 500),
                },
            })
            .returning({ id: waDispatches.id });

        return {
            id: row.id,
            providerMode: 'WEBHOOK',
            deliveryStatus: status,
            detail: res.ok ? undefined : `HTTP ${res.status}`,
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
                responseMeta: { error: reason },
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
