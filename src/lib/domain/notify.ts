import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { institutions, notifications, reportsRS, users } from '@/db/schema';
import { audit } from '@/lib/audit';
import {
    enqueueClusterDetector,
    enqueueSla,
    enqueueWhatsAppDispatch,
    type WhatsAppDispatchJob,
} from '@/lib/queue';
import { isValidUuid } from '@/lib/security';
import { scopeToInstitution, type Actor } from '@/lib/session';
import { dispatchWhatsApp, normalizeIndonesianPhone } from '@/lib/whatsapp';
import {
    assignReportByKelurahan,
    findPuskesmasByKelurahan,
} from './assignment';
import {
    buildDefaultManualNotifyMessage,
    buildManualNotifyTargets,
    type ManualNotifyContext,
    type ManualNotifyTarget,
    type ManualNotifyTargetOption,
} from './report-labels';

export type {
    ManualNotifyContext,
    ManualNotifyTarget,
    ManualNotifyTargetOption,
};
export { buildDefaultManualNotifyMessage, buildManualNotifyTargets };

export type NotifyTarget =
    | { kind: 'USER'; userId: string }
    | { kind: 'INSTITUTION'; institutionId: string }
    | { kind: 'ROLE'; role: 'ADMIN' | 'DINKES' | 'PUSKESMAS' | 'RUMAH_SAKIT' };

export type ManualNotifyResult =
    | {
          ok: true;
          inAppCount: number;
          waOptInCount: number;
          waQueuedCount: number;
          waDirectCount: number;
          targetLabel: string;
      }
    | { ok: false; error: string };

/**
 * In-app notification fan-out. C8 in the audit: the prototype's realtime
 * channel was unauthenticated and clients could join any user's room. Rows are
 * written here, per recipient, and read through an authenticated route — so a
 * client can only ever receive its own notifications.
 */
export async function insertNotifications(
    target: NotifyTarget,
    payload: {
        title: string;
        message: string;
        type: string;
        entityType?: string;
        entityId?: string;
    },
): Promise<number> {
    const db = getDb();

    const recipients = await (async () => {
        if (target.kind === 'USER') {
            return [{ id: target.userId }];
        }

        if (target.kind === 'INSTITUTION') {
            return db
                .select({ id: users.id })
                .from(users)
                .where(
                    and(
                        eq(users.institutionId, target.institutionId),
                        eq(users.isActive, true),
                    ),
                );
        }

        return db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.role, target.role), eq(users.isActive, true)));
    })();

    if (recipients.length === 0) {
        return 0;
    }

    // `onConflictDoNothing` covers the partial unique index on SLA_BREACH rows:
    // a second reminder for the same report and user on the same day is dropped
    // by the database, which is the only place the race can be settled.
    await db
        .insert(notifications)
        .values(
            recipients.map((r) => ({
                userId: r.id,
                title: payload.title,
                message: payload.message,
                type: payload.type,
                entityType: payload.entityType ?? null,
                entityId: payload.entityId ?? null,
            })),
        )
        .onConflictDoNothing();

    return recipients.length;
}

/**
 * Enqueues a WhatsApp dispatch safely: never broadcasts PUSKESMAS/RUMAH_SAKIT
 * without an institutionId or explicit phone, and never throws on Redis outage.
 */
export async function enqueueWaSafe(
    job: WhatsAppDispatchJob,
): Promise<boolean> {
    if (
        (job.recipientRole === 'PUSKESMAS' ||
            job.recipientRole === 'RUMAH_SAKIT') &&
        !job.recipientPhone &&
        !job.institutionId
    ) {
        console.error('[wa] blocked unscoped institution broadcast', {
            recipientRole: job.recipientRole,
            eventKind: job.eventKind,
            reportRSId: job.reportRSId,
        });
        return false;
    }
    try {
        await enqueueWhatsAppDispatch(job);
        return true;
    } catch (err) {
        console.error('[wa] gagal enqueue WhatsApp dispatch:', err);
        return false;
    }
}

/**
 * Shared post-submission fan-out for newly submitted reports and drafts
 * promoted to submitted: assigns Puskesmas by kelurahan, sends in-app + WA
 * notifications, and schedules SLA + spatial cluster jobs.
 */
export async function notifySubmittedReport(params: {
    reportId: string;
    reportNumber: string;
    caseType: string;
    kelurahan: string | null;
    kecamatan: string | null;
    kota: string | null;
    isCrossBorder: boolean;
    isPuskesmasPoli: boolean;
    hasCoordinates: boolean;
}): Promise<void> {
    const kelLabel = params.kelurahan ?? '-';
    const kecLabel = params.kecamatan ?? '-';

    if (params.isCrossBorder) {
        await insertNotifications(
            { kind: 'ROLE', role: 'DINKES' },
            {
                title: 'Kasus luar wilayah terdeteksi',
                message: `Laporan ${params.reportNumber} berdomisili di ${params.kota ?? '-'} dan menunggu disposisi Dinkes.`,
                type: 'CROSS_BORDER',
                entityType: 'REPORT_RS',
                entityId: params.reportId,
            },
        );
        await enqueueWaSafe({
            recipientPhone: process.env.DINKES_ALERT_PHONE ?? '',
            recipientRole: 'DINKES',
            reportRSId: params.reportId,
            eventKind: 'CROSS_BORDER',
            message: `[WALI-EPI] Kasus luar wilayah ${params.reportNumber} (${kelLabel}, ${params.kota ?? '-'}) menunggu disposisi Dinkes di /laporan/lintas-wilayah.`,
        });
    } else if (!params.isPuskesmasPoli) {
        try {
            const assignRes = await assignReportByKelurahan(params.reportId);
            if (assignRes.assigned) {
                await insertNotifications(
                    {
                        kind: 'INSTITUTION',
                        institutionId: assignRes.puskesmasId,
                    },
                    {
                        title: 'Laporan kasus baru masuk',
                        message: `Laporan ${params.reportNumber} (${params.caseType}) di Kel. ${kelLabel} menunggu verifikasi Puskesmas (SLA 24 jam).`,
                        type: 'ASSIGNMENT',
                        entityType: 'REPORT_RS',
                        entityId: params.reportId,
                    },
                );
                await enqueueWaSafe({
                    recipientPhone: '',
                    recipientRole: 'PUSKESMAS',
                    institutionId: assignRes.puskesmasId,
                    reportRSId: params.reportId,
                    eventKind: 'ASSIGNMENT',
                    message: `[WALI-EPI] Kasus DBD baru ${params.reportNumber} (${params.caseType}) di Kel. ${kelLabel} ditugaskan ke Puskesmas Anda. Mohon verifikasi sebelum batas SLA 24 jam.`,
                });
            } else if (assignRes.reason !== 'ALREADY_ASSIGNED') {
                await insertNotifications(
                    { kind: 'ROLE', role: 'DINKES' },
                    {
                        title: 'Laporan perlu disposisi manual',
                        message: `Laporan ${params.reportNumber} di Kel. ${kelLabel} belum terpetakan ke Puskesmas aktif (${assignRes.reason}).`,
                        type: 'ASSIGNMENT',
                        entityType: 'REPORT_RS',
                        entityId: params.reportId,
                    },
                );
                await enqueueWaSafe({
                    recipientPhone: '',
                    recipientRole: 'DINKES',
                    reportRSId: params.reportId,
                    eventKind: 'ASSIGNMENT',
                    message: `[WALI-EPI] Laporan ${params.reportNumber} (Kel. ${kelLabel}) belum terpetakan ke Puskesmas aktif dan perlu disposisi Dinkes.`,
                });
            }
        } catch (err) {
            console.error('[laporan] auto-assign inline error:', err);
        }

        try {
            await insertNotifications(
                { kind: 'ROLE', role: 'DINKES' },
                {
                    title: 'Laporan kasus DBD baru',
                    message: `Laporan ${params.reportNumber} (${params.caseType}) diterima dari faskes di Kel. ${kelLabel}, Kec. ${kecLabel}.`,
                    type: 'NEW_REPORT',
                    entityType: 'REPORT_RS',
                    entityId: params.reportId,
                },
            );
        } catch (err) {
            console.error('[laporan] dinkes notification error:', err);
        }

        try {
            await enqueueSla(params.reportId);
        } catch (err) {
            console.error('[laporan] gagal enqueue SLA:', err);
        }
    } else {
        try {
            await insertNotifications(
                { kind: 'ROLE', role: 'DINKES' },
                {
                    title: 'Laporan kasus DBD dari Poli Puskesmas',
                    message: `Laporan ${params.reportNumber} (${params.caseType}) dicatat oleh Puskesmas di Kel. ${kelLabel}.`,
                    type: 'NEW_REPORT',
                    entityType: 'REPORT_RS',
                    entityId: params.reportId,
                },
            );
            await enqueueWaSafe({
                recipientPhone: '',
                recipientRole: 'DINKES',
                reportRSId: params.reportId,
                eventKind: 'NEW_REPORT',
                message: `[WALI-EPI] Laporan kasus baru ${params.reportNumber} (${params.caseType}) dicatat oleh Poli Puskesmas di Kel. ${kelLabel}.`,
            });
        } catch (err) {
            console.error('[laporan] poli dinkes notification error:', err);
        }
    }

    if (params.hasCoordinates) {
        try {
            await enqueueClusterDetector(params.reportId);
        } catch (err) {
            console.error('[laporan] gagal enqueue cluster detector:', err);
        }
    }
}

function roleForInstitutionType(
    type: string | null | undefined,
): 'DINKES' | 'PUSKESMAS' | 'RUMAH_SAKIT' {
    if (type === 'PUSKESMAS') return 'PUSKESMAS';
    if (type === 'DINAS_KESEHATAN') return 'DINKES';
    return 'RUMAH_SAKIT';
}

export async function sendManualNotification(
    actor: Actor,
    input: {
        reportId: string;
        context: ManualNotifyContext;
        target: ManualNotifyTarget;
        message?: string;
        sendInApp?: boolean;
        sendWhatsApp?: boolean;
    },
): Promise<ManualNotifyResult> {
    if (!isValidUuid(input.reportId)) {
        return { ok: false, error: 'ID laporan tidak valid.' };
    }

    const sendInApp = input.sendInApp ?? true;
    const sendWhatsApp = input.sendWhatsApp ?? true;
    if (!sendInApp && !sendWhatsApp) {
        return {
            ok: false,
            error: 'Pilih minimal satu kanal (In-App atau WhatsApp).',
        };
    }

    const db = getDb();
    const institutionId = scopeToInstitution(actor);

    const [row] = await db
        .select({
            id: reportsRS.id,
            reportNumber: reportsRS.reportNumber,
            kelurahan: reportsRS.kelurahan,
            latitude: reportsRS.latitude,
            longitude: reportsRS.longitude,
            institutionId: reportsRS.institutionId,
            assignedPuskesmasId: reportsRS.assignedPuskesmasId,
            institutionName: institutions.name,
            institutionType: institutions.type,
        })
        .from(reportsRS)
        .leftJoin(institutions, eq(institutions.id, reportsRS.institutionId))
        .where(
            institutionId
                ? and(
                      eq(reportsRS.id, input.reportId),
                      sql`(${reportsRS.institutionId} = ${institutionId} or ${reportsRS.assignedPuskesmasId} = ${institutionId})`,
                  )
                : eq(reportsRS.id, input.reportId),
        )
        .limit(1);

    if (!row) {
        return {
            ok: false,
            error: 'Laporan tidak ditemukan atau tidak berwenang.',
        };
    }

    let puskesmas: { id: string; name: string } | null = null;
    if (row.assignedPuskesmasId) {
        const [pkm] = await db
            .select({ id: institutions.id, name: institutions.name })
            .from(institutions)
            .where(eq(institutions.id, row.assignedPuskesmasId))
            .limit(1);
        puskesmas = pkm ?? { id: row.assignedPuskesmasId, name: 'Puskesmas' };
    } else {
        puskesmas = await findPuskesmasByKelurahan(row.kelurahan);
    }

    const allowed = buildManualNotifyTargets({
        actorRole: actor.role,
        actorInstitutionId: actor.institutionId,
        reportInstitutionId: row.institutionId,
        reportInstitutionName: row.institutionName,
        puskesmasId: puskesmas?.id ?? null,
        puskesmasName: puskesmas?.name ?? null,
    });

    const selectedOption = allowed.find((o) => o.value === input.target);
    if (!selectedOption) {
        return {
            ok: false,
            error: 'Target notifikasi tidak tersedia untuk laporan atau peran Anda.',
        };
    }

    const locationUnconfirmed = row.latitude === null || row.longitude === null;
    const defaultMessage = buildDefaultManualNotifyMessage({
        context: input.context,
        reportId: row.id,
        reportNumber: row.reportNumber,
        kelurahan: row.kelurahan,
        locationUnconfirmed,
    });

    const finalMessage = input.message?.trim() || defaultMessage;
    const title =
        input.context === 'PE'
            ? `Pengingat PE · ${row.reportNumber}`
            : input.context === 'FOGGING'
              ? `Pengingat Fogging · ${row.reportNumber}`
              : locationUnconfirmed
                ? `Konfirmasi Lokasi · ${row.reportNumber}`
                : `Pengingat Laporan · ${row.reportNumber}`;
    const notifType =
        input.context === 'PE'
            ? 'PE_MANUAL'
            : input.context === 'FOGGING'
              ? 'FOGGING_MANUAL'
              : 'MANUAL_ALERT';

    const targets: Array<{
        notifyTarget: NotifyTarget;
        waRole: 'DINKES' | 'PUSKESMAS' | 'RUMAH_SAKIT';
        waInstitutionId: string | null;
    }> = [];

    if (
        input.target === 'PUSKESMAS' ||
        input.target === 'PUSKESMAS_AND_DINKES'
    ) {
        if (!puskesmas) {
            return {
                ok: false,
                error: 'Puskesmas wilayah belum terpetakan untuk kelurahan laporan ini.',
            };
        }
        targets.push({
            notifyTarget: { kind: 'INSTITUTION', institutionId: puskesmas.id },
            waRole: 'PUSKESMAS',
            waInstitutionId: puskesmas.id,
        });
    }
    if (input.target === 'DINKES' || input.target === 'PUSKESMAS_AND_DINKES') {
        targets.push({
            notifyTarget: { kind: 'ROLE', role: 'DINKES' },
            waRole: 'DINKES',
            waInstitutionId: null,
        });
    }
    if (input.target === 'FASKES') {
        targets.push({
            notifyTarget: {
                kind: 'INSTITUTION',
                institutionId: row.institutionId,
            },
            waRole: roleForInstitutionType(row.institutionType),
            waInstitutionId: row.institutionId,
        });
    }

    let inAppCount = 0;
    let waOptInCount = 0;
    let waQueuedCount = 0;
    let waDirectCount = 0;

    for (const t of targets) {
        if (sendInApp) {
            inAppCount += await insertNotifications(t.notifyTarget, {
                title,
                message: finalMessage,
                type: notifType,
                entityType: 'REPORT_RS',
                entityId: row.id,
            });
        }

        if (sendWhatsApp) {
            const phoneRows = await db
                .select({ phone: users.whatsappPhone })
                .from(users)
                .where(
                    and(
                        eq(users.role, t.waRole),
                        ...(t.waInstitutionId
                            ? [eq(users.institutionId, t.waInstitutionId)]
                            : []),
                        eq(users.whatsappOptIn, true),
                        eq(users.isActive, true),
                        isNotNull(users.whatsappPhone),
                    ),
                )
                .limit(10);

            let phones = phoneRows
                .map((r) => r.phone)
                .filter((p): p is string => Boolean(p));
            if (phones.length === 0 && t.waRole === 'DINKES') {
                const fallbackDinkes = process.env.DINKES_ALERT_PHONE?.trim();
                if (fallbackDinkes) phones = [fallbackDinkes];
            }
            const uniquePhones = Array.from(
                new Set(
                    phones
                        .map((p) => normalizeIndonesianPhone(p))
                        .filter(Boolean),
                ),
            );
            waOptInCount += uniquePhones.length;

            const queued = await enqueueWaSafe({
                recipientPhone: '',
                recipientRole: t.waRole,
                institutionId: t.waInstitutionId,
                reportRSId: row.id,
                eventKind: 'MANUAL_ALERT',
                message: finalMessage,
            });

            if (queued) {
                waQueuedCount += 1;
            } else {
                const directTargets =
                    uniquePhones.length > 0 ? uniquePhones : ['UNCONFIGURED'];
                for (const phone of directTargets) {
                    await dispatchWhatsApp({
                        recipientPhone: phone,
                        recipientRole: t.waRole,
                        institutionId: t.waInstitutionId,
                        reportRSId: row.id,
                        eventKind: 'MANUAL_ALERT',
                        message: finalMessage,
                    });
                    waDirectCount += 1;
                }
            }
        }
    }

    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'REPORT_RS',
        entityId: row.id,
        changes: {
            manualNotification: {
                from: null,
                to: {
                    context: input.context,
                    target: input.target,
                    inAppCount,
                    waOptInCount,
                    waQueuedCount,
                    waDirectCount,
                },
            },
        },
    });

    return {
        ok: true,
        inAppCount,
        waOptInCount,
        waQueuedCount,
        waDirectCount,
        targetLabel: selectedOption.label,
    };
}
