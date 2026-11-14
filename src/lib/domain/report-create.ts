import { and, asc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { institutions, kelurahan, reportsRS } from '@/db/schema';
import { encryptPii, hashPii } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { scopeToInstitution, type Actor } from '@/lib/session';
import {
    enqueueAssign,
    enqueueClusterDetector,
    enqueueSla,
    enqueueWhatsAppDispatch,
} from '@/lib/queue';
import { insertNotifications } from './notify';
import { assignReportByKelurahan } from './assignment';

// Re-exported so server callers keep importing from the domain module while
// client forms import the same schema without the DB client (form-contracts.ts).
export { createReportSchema, type CreateReportInput } from './form-contracts';
import type { CreateReportInput } from './form-contracts';

export type CreateReportResult =
    | { ok: true; id: string; reportNumber: string; crossBorder?: boolean }
    | { ok: false; error: string };

/**
 * Sequence from the highest existing number of the day, not from count(*):
 * a deleted report or a rejected insert leaves a gap, and count(*) would hand
 * the same number out twice until the unique index rejects it.
 */
async function nextReportNumber(prefix: 'RS' | 'PKM' = 'RS'): Promise<string> {
    const stamp = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    })
        .format(new Date())
        .replace(/-/g, '');
    const [row] = await getDb()
        .select({
            last: sql<string | null>`max(${reportsRS.reportNumber})`,
        })
        .from(reportsRS)
        .where(sql`${reportsRS.reportNumber} like ${`${prefix}-${stamp}-%`}`);

    const tail = row?.last?.split('-').pop();
    const lastSeq = tail && /^\d+$/.test(tail) ? Number(tail) : 0;

    return `${prefix}-${stamp}-${String(lastSeq + 1).padStart(4, '0')}`;
}

/**
 * Creates a report in SUBMITTED, then hands assignment to the worker rather
 * than resolving the Puskesmas inline: the prototype did assignment in the
 * browser (reports-rs.service.ts:213), so a closed tab meant an unassigned case.
 */
export async function createReport(
    actor: Actor,
    input: CreateReportInput,
): Promise<CreateReportResult> {
    if (actor.role !== 'RUMAH_SAKIT' && actor.role !== 'PUSKESMAS') {
        return {
            ok: false,
            error: 'Hanya rumah sakit atau puskesmas yang dapat melaporkan kasus.',
        };
    }

    const institutionId = scopeToInstitution(actor);

    if (!institutionId) {
        return {
            ok: false,
            error: 'Akun Anda belum terhubung ke fasilitas kesehatan.',
        };
    }

    const [institution] = await getDb()
        .select({ type: institutions.type, city: institutions.city })
        .from(institutions)
        .where(eq(institutions.id, institutionId))
        .limit(1);

    if (
        institution?.type !== 'RUMAH_SAKIT' &&
        institution?.type !== 'PUSKESMAS'
    ) {
        return {
            ok: false,
            error: 'Fasilitas Anda bukan rumah sakit atau puskesmas.',
        };
    }

    // Cross-border check: does the patient's kota exist in local master kelurahan?
    const db = getDb();
    const [{ cnt: localKelurahanMatches }] = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(kelurahan)
        .where(
            sql`lower(btrim(${kelurahan.kota})) = lower(btrim(${input.kota}))`,
        );

    const [{ totalKelurahan }] = await db
        .select({ totalKelurahan: sql<number>`count(*)::int` })
        .from(kelurahan);

    // Only classify as cross-border when master kelurahan data exists and patient's kota is outside it.
    const isCrossBorder =
        totalKelurahan > 0 && localKelurahanMatches === 0;

    const isPuskesmasPoli =
        actor.role === 'PUSKESMAS' || input.sourceType === 'PUSKESMAS_POLI';
    const reportPrefix: 'PKM' | 'RS' = isPuskesmasPoli ? 'PKM' : 'RS';

    let reportNumber = await nextReportNumber(reportPrefix);
    const initialStatus = isCrossBorder
        ? ('CROSS_BORDER_PENDING' as const)
        : isPuskesmasPoli
          ? ('ASSIGNED_ACCEPTED' as const)
          : ('SUBMITTED' as const);

    const values = {
        reportNumber,
        patientNameEncrypted: encryptPii(input.patientName),
        patientNikEncrypted: encryptPii(input.patientNik),
        patientNikHash: hashPii(input.patientNik),
        patientAddressEncrypted: encryptPii(input.patientAddress),
        patientAge: input.patientAge,
        patientGender: input.patientGender,
        caseType: input.caseType,
        kelurahan: input.kelurahan,
        kecamatan: input.kecamatan,
        kota: input.kota,
        provinsi: input.provinsi,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        sourceType: isPuskesmasPoli ? 'PUSKESMAS_POLI' : 'RS',
        phoneNumberEncrypted: input.phoneNumber
            ? encryptPii(input.phoneNumber)
            : null,
        admissionDate: input.admissionDate,
        symptomOnsetDate: input.symptomOnsetDate ?? null,
        diagnosisDate: input.diagnosisDate ?? null,
        plateletCount: input.plateletCount ?? null,
        hematocrit:
            input.hematocrit !== undefined ? String(input.hematocrit) : null,
        dengueBlot: input.ns1Result ?? null,
        igm: input.igmResult ?? null,
        igg: input.iggResult ?? null,
        diagnosis: input.diagnosis || null,
        institutionId,
        assignedPuskesmasId:
            !isCrossBorder && isPuskesmasPoli ? institutionId : null,
        assignedToId:
            !isCrossBorder && isPuskesmasPoli ? actor.userId : null,
        assignedAt: !isCrossBorder && isPuskesmasPoli ? new Date() : null,
        acceptedAt: !isCrossBorder && isPuskesmasPoli ? new Date() : null,
        crossBorderTargetCity: isCrossBorder ? input.kota : null,
        createdById: actor.userId,
        status: initialStatus,
    };

    let inserted: { id: string } | undefined;

    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            [inserted] = await db
                .insert(reportsRS)
                .values({ ...values, reportNumber })
                .returning({ id: reportsRS.id });
            break;
        } catch (error) {
            if (!isUniqueViolation(error) || attempt === 4) throw error;
            reportNumber = await nextReportNumber(reportPrefix);
        }
    }

    if (!inserted) {
        return { ok: false, error: 'Laporan gagal disimpan.' };
    }

    await audit({
        actor,
        action: 'CREATE',
        entityType: 'REPORT_RS',
        entityId: inserted.id,
        changes: {
            reportNumber: { from: null, to: reportNumber },
            status: { from: null, to: initialStatus },
        },
    });

    if (isCrossBorder) {
        await insertNotifications(
            { kind: 'ROLE', role: 'DINKES' },
            {
                title: 'Kasus luar wilayah terdeteksi',
                message: `Laporan ${reportNumber} berdomisili di ${input.kota} dan menunggu disposisi Dinkes.`,
                type: 'CROSS_BORDER',
                entityType: 'REPORT_RS',
                entityId: inserted.id,
            },
        );
    } else if (!isPuskesmasPoli) {
        // Intra-city hospital report: auto-assign inline and notify Puskesmas & Dinkes immediately
        try {
            const assignRes = await assignReportByKelurahan(inserted.id);
            if (assignRes.assigned) {
                await insertNotifications(
                    {
                        kind: 'INSTITUTION',
                        institutionId: assignRes.puskesmasId,
                    },
                    {
                        title: 'Laporan kasus baru masuk',
                        message: `Laporan ${reportNumber} (${input.caseType}) di Kel. ${input.kelurahan} menunggu verifikasi Puskesmas (SLA 24 jam).`,
                        type: 'ASSIGNMENT',
                        entityType: 'REPORT_RS',
                        entityId: inserted.id,
                    },
                );
            }
        } catch (err) {
            console.error('[laporan] auto-assign inline error:', err);
        }

        // Notify Dinkes for city-wide surveillance monitoring
        try {
            await insertNotifications(
                { kind: 'ROLE', role: 'DINKES' },
                {
                    title: 'Laporan kasus DBD baru',
                    message: `Laporan ${reportNumber} (${input.caseType}) diterima dari faskes di Kel. ${input.kelurahan}, Kec. ${input.kecamatan}.`,
                    type: 'NEW_REPORT',
                    entityType: 'REPORT_RS',
                    entityId: inserted.id,
                },
            );
        } catch (err) {
            console.error('[laporan] dinkes notification error:', err);
        }
    } else {
        // Puskesmas poli report: notify Dinkes
        try {
            await insertNotifications(
                { kind: 'ROLE', role: 'DINKES' },
                {
                    title: 'Laporan kasus DBD dari Poli Puskesmas',
                    message: `Laporan ${reportNumber} (${input.caseType}) dicatat oleh Puskesmas di Kel. ${input.kelurahan}.`,
                    type: 'NEW_REPORT',
                    entityType: 'REPORT_RS',
                    entityId: inserted.id,
                },
            );
        } catch (err) {
            console.error('[laporan] poli dinkes notification error:', err);
        }
    }

    // Queued outside the request's critical path; a Redis outage must not lose
    // the report that was already committed.
    try {
        if (!isCrossBorder && !isPuskesmasPoli) {
            await enqueueAssign(inserted.id);
            await enqueueSla(inserted.id);
        }
        if (input.latitude !== undefined && input.longitude !== undefined) {
            await enqueueClusterDetector(inserted.id);
        }
        if (isCrossBorder) {
            await enqueueWhatsAppDispatch({
                recipientPhone: process.env.DINKES_ALERT_PHONE ?? '',
                recipientRole: 'DINKES',
                reportRSId: inserted.id,
                eventKind: 'CROSS_BORDER',
                message: `[WALI-EPI] Kasus luar wilayah ${reportNumber} (${input.kelurahan}, ${input.kota}) menunggu disposisi Dinkes di /laporan/lintas-wilayah.`,
            });
        }
    } catch (error) {
        console.error('[laporan] gagal enqueue ke Redis', {
            reportId: inserted.id,
            error,
        });
    }

    return {
        ok: true,
        id: inserted.id,
        reportNumber,
        crossBorder: isCrossBorder,
    };
}

/** Puskesmas that will receive a report for this kelurahan, for the preview hint. */
export async function resolvePuskesmas(kelurahan: string) {
    const [row] = await getDb()
        .select({ id: institutions.id, name: institutions.name })
        .from(institutions)
        .where(
            and(
                eq(institutions.type, 'PUSKESMAS'),
                eq(institutions.isActive, true),
                sql`exists (select 1 from unnest(${institutions.kelurahanList}) k where lower(btrim(k)) = lower(btrim(${kelurahan})))`,
            ),
        )
        .orderBy(asc(institutions.id))
        .limit(1);

    return row ?? null;
}

/** postgres.js surfaces the SQLSTATE on the error; 23505 is unique_violation. */
function isUniqueViolation(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === '23505'
    );
}
