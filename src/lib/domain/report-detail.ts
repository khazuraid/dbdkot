import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import {
    foggingCycles,
    institutions,
    kelurahan,
    reportsPE,
    reportsRS,
    waDispatches,
} from '@/db/schema';
import { decryptPii, encryptPii, hashPii } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import {
    enqueueAssign,
    enqueueClusterDetector,
    enqueuePeSla,
    enqueueSla,
    enqueueWhatsAppDispatch,
} from '@/lib/queue';
import { insertNotifications } from './notify';
import { assignReportByKelurahan } from './assignment';
import { scopeToInstitution, type Actor } from '@/lib/session';
import type { ReportStatus } from './reports';
import type { CreateReportInput } from './form-contracts';

export type ReportDetail = {
    id: string;
    reportNumber: string;
    status: ReportStatus;
    caseType: string;
    sourceType: string;
    kelurahan: string | null;
    kecamatan: string | null;
    kota: string | null;
    provinsi: string | null;
    rt: string | null;
    rw: string | null;
    latitude: number | null;
    longitude: number | null;
    clusterId: string | null;
    crossBorderTargetCity: string | null;
    crossBorderNotes: string | null;
    institutionId: string;
    institutionName: string | null;
    institutionType?: string | null;
    assignedPuskesmasId: string | null;
    assignedPuskesmasName: string | null;
    assignedAt: Date | null;
    acceptedAt: Date | null;
    puskesmasReviewedAt: Date | null;
    patient: {
        name: string;
        nik: string;
        address: string;
        phone: string;
        age: number;
        gender: string;
    };
    admissionDate: Date;
    symptomOnsetDate: Date | null;
    diagnosisDate: Date | null;
    plateletCount: number | null;
    hematocrit: string | null;
    dengueBlot: string | null;
    igm: string | null;
    igg: string | null;
    diagnosis: string | null;
    rejectionReason: string | null;
    createdAt: Date;
    pe: {
        id: string;
        peDate: Date;
        officerName: string;
        officerNip: string | null;
        headOfPuskesmasName: string | null;
        headOfPuskesmasNip: string | null;
        respondentName: string | null;
        respondentRelation: string | null;
        travelHistory14d: string | null;
        otherFeverCasesCount: number;
        housesInspected: number;
        housesPositive: number;
        containersInspected: number;
        containersPositive: number;
        abj: string | null;
        houseIndex: string | null;
        containerIndex: string | null;
        breteauIndex: string | null;
        transmissionRisk: string | null;
        foggingRecommended: boolean;
        conclusion: string | null;
        recommendation: string | null;
        formData: Record<string, unknown> | null;
        status: string;
    } | null;
    clusterSiblings: Array<{
        id: string;
        reportNumber: string;
        kelurahan: string | null;
        status: ReportStatus;
        createdAt: Date;
    }>;
    foggingCycles: Array<{
        id: string;
        cycleNumber: number;
        status: string;
        scheduledDate: Date;
        executedAt: Date | null;
        totalBudget: number;
    }>;
    waDispatches: Array<{
        id: string;
        eventKind: string;
        recipientPhone: string;
        status: string;
        createdAt: Date;
    }>;
};

const decryptOrHide = (payload: string | null) => {
    if (!payload) return '—';
    try {
        return decryptPii(payload);
    } catch {
        return '[TIDAK DAPAT DIDEKRIPSI]';
    }
};

/**
 * One report, scoped to the caller's institution.
 */
export async function getReport(
    actor: Actor,
    id: string,
): Promise<ReportDetail | null> {
    const db = getDb();
    const institutionId = scopeToInstitution(actor);

    const rows = await db
        .select({
            r: reportsRS,
            institutionName: institutions.name,
            institutionType: institutions.type,
        })
        .from(reportsRS)
        .leftJoin(institutions, eq(institutions.id, reportsRS.institutionId))
        .where(
            institutionId
                ? and(
                      eq(reportsRS.id, id),
                      sql`(${reportsRS.institutionId} = ${institutionId} or ${reportsRS.assignedPuskesmasId} = ${institutionId})`,
                  )
                : eq(reportsRS.id, id),
        )
        .limit(1);

    const row = rows[0];
    if (!row) return null;

    let puskesmasName: string | null = null;
    if (row.r.assignedPuskesmasId) {
        const [p] = await db
            .select({ name: institutions.name })
            .from(institutions)
            .where(eq(institutions.id, row.r.assignedPuskesmasId))
            .limit(1);
        puskesmasName = p?.name ?? null;
    }

    const [peRow] = await db
        .select({
            id: reportsPE.id,
            peDate: reportsPE.peDate,
            officerName: reportsPE.officerName,
            officerNip: reportsPE.officerNip,
            headOfPuskesmasName: reportsPE.headOfPuskesmasName,
            headOfPuskesmasNip: reportsPE.headOfPuskesmasNip,
            respondentName: reportsPE.respondentName,
            respondentRelation: reportsPE.respondentRelation,
            travelHistory14d: reportsPE.travelHistory14d,
            otherFeverCasesCount: reportsPE.otherFeverCasesCount,
            housesInspected: reportsPE.housesInspected,
            housesPositive: reportsPE.housesPositive,
            containersInspected: reportsPE.containersInspected,
            containersPositive: reportsPE.containersPositive,
            abj: reportsPE.abj,
            houseIndex: reportsPE.houseIndex,
            containerIndex: reportsPE.containerIndex,
            breteauIndex: reportsPE.breteauIndex,
            transmissionRisk: reportsPE.transmissionRisk,
            foggingRecommended: reportsPE.foggingRecommended,
            conclusion: reportsPE.conclusion,
            recommendation: reportsPE.recommendation,
            formData: reportsPE.formData,
            status: reportsPE.status,
        })
        .from(reportsPE)
        .where(eq(reportsPE.reportRSId, id))
        .limit(1);

    const clusterSiblings = row.r.clusterId
        ? await db
              .select({
                  id: reportsRS.id,
                  reportNumber: reportsRS.reportNumber,
                  kelurahan: reportsRS.kelurahan,
                  status: reportsRS.status,
                  createdAt: reportsRS.createdAt,
              })
              .from(reportsRS)
              .where(
                  and(
                      eq(reportsRS.clusterId, row.r.clusterId),
                      ne(reportsRS.id, id),
                      institutionId
                          ? sql`(${reportsRS.institutionId} = ${institutionId} or ${reportsRS.assignedPuskesmasId} = ${institutionId})`
                          : sql`true`,
                  ),
              )
              .orderBy(desc(reportsRS.createdAt))
              .limit(10)
        : [];

    const [cycles, waLogs] = await Promise.all([
        db
            .select({
                id: foggingCycles.id,
                cycleNumber: foggingCycles.cycleNumber,
                status: foggingCycles.status,
                scheduledDate: foggingCycles.scheduledDate,
                executedAt: foggingCycles.executedAt,
                totalBudget: foggingCycles.totalBudget,
            })
            .from(foggingCycles)
            .where(eq(foggingCycles.reportRSId, id)),
        db
            .select({
                id: waDispatches.id,
                eventKind: waDispatches.eventKind,
                recipientPhone: waDispatches.recipientPhone,
                status: waDispatches.deliveryStatus,
                createdAt: waDispatches.createdAt,
            })
            .from(waDispatches)
            .where(eq(waDispatches.reportRSId, id))
            .orderBy(desc(waDispatches.createdAt))
            .limit(10),
    ]);

    await audit({
        actor,
        action: 'READ_PII',
        entityType: 'REPORT_RS',
        entityId: id,
    });

    return {
        id: row.r.id,
        reportNumber: row.r.reportNumber,
        status: row.r.status,
        caseType: row.r.caseType,
        sourceType: row.r.sourceType,
        kelurahan: row.r.kelurahan,
        kecamatan: row.r.kecamatan,
        kota: row.r.kota,
        provinsi: row.r.provinsi,
        rt: row.r.rt,
        rw: row.r.rw,
        latitude: row.r.latitude,
        longitude: row.r.longitude,
        clusterId: row.r.clusterId,
        crossBorderTargetCity: row.r.crossBorderTargetCity,
        crossBorderNotes: row.r.crossBorderNotes,
        institutionId: row.r.institutionId,
        institutionName: row.institutionName,
        institutionType: row.institutionType,
        assignedPuskesmasId: row.r.assignedPuskesmasId,
        assignedPuskesmasName: puskesmasName,
        assignedAt: row.r.assignedAt,
        acceptedAt: row.r.acceptedAt,
        puskesmasReviewedAt: row.r.puskesmasReviewedAt,
        patient: {
            name: decryptOrHide(row.r.patientNameEncrypted),
            nik: decryptOrHide(row.r.patientNikEncrypted),
            address: decryptOrHide(row.r.patientAddressEncrypted),
            phone: decryptOrHide(row.r.phoneNumberEncrypted),
            age: row.r.patientAge,
            gender: row.r.patientGender,
        },
        admissionDate: row.r.admissionDate,
        symptomOnsetDate: row.r.symptomOnsetDate,
        diagnosisDate: row.r.diagnosisDate,
        plateletCount: row.r.plateletCount,
        hematocrit: row.r.hematocrit,
        dengueBlot: row.r.dengueBlot,
        igm: row.r.igm,
        igg: row.r.igg,
        diagnosis: row.r.diagnosis,
        rejectionReason: row.r.rejectionReason,
        createdAt: row.r.createdAt,
        pe: peRow
            ? {
                  ...peRow,
                  formData:
                      (peRow.formData as Record<string, unknown> | null) ?? null,
              }
            : null,
        clusterSiblings,
        foggingCycles: cycles.sort((a, b) => a.cycleNumber - b.cycleNumber),
        waDispatches: waLogs,
    };
}

export type Transition =
    | 'ACCEPT'
    | 'START_PE'
    | 'REJECT'
    | 'VERIFY'
    | 'REJECT_BY_DINKES'
    | 'MARK_CLOSED';

export type TransitionResult =
    | { ok: true; status: ReportStatus }
    | { ok: false; reason: 'FORBIDDEN' | 'NOT_FOUND' | 'ILLEGAL_STATE' };

const ALLOWED: Record<
    Transition,
    { from: ReportStatus[]; to: ReportStatus; roles: Actor['role'][] }
> = {
    ACCEPT: {
        from: ['ASSIGNED'],
        to: 'ASSIGNED_ACCEPTED',
        roles: ['PUSKESMAS'],
    },
    START_PE: {
        from: ['ASSIGNED_ACCEPTED'],
        to: 'PE_IN_PROGRESS',
        roles: ['PUSKESMAS'],
    },
    REJECT: {
        from: ['ASSIGNED'],
        to: 'PUSKESMAS_REJECTED',
        roles: ['PUSKESMAS'],
    },
    VERIFY: {
        from: ['PE_COMPLETED'],
        to: 'VERIFIED',
        roles: ['DINKES'],
    },
    REJECT_BY_DINKES: {
        from: ['PE_COMPLETED'],
        to: 'REJECTED',
        roles: ['DINKES'],
    },
    MARK_CLOSED: {
        from: ['VERIFIED', 'SIKLUS_2_DONE'],
        to: 'CLOSED',
        roles: ['DINKES', 'PUSKESMAS'],
    },
};

export async function transitionReport(
    actor: Actor,
    id: string,
    transition: Transition,
    note?: string,
): Promise<TransitionResult> {
    const rule = ALLOWED[transition];

    if (!rule.roles.includes(actor.role)) {
        return { ok: false, reason: 'FORBIDDEN' };
    }

    const current = await getReport(actor, id);

    if (!current) {
        return { ok: false, reason: 'NOT_FOUND' };
    }

    if (!rule.from.includes(current.status)) {
        return { ok: false, reason: 'ILLEGAL_STATE' };
    }

    const db = getDb();
    const now = new Date();
    let targetStatus: ReportStatus = rule.to;

    if (transition === 'VERIFY' && current.pe?.foggingRecommended) {
        targetStatus = 'FOGGING_REQUIRED';
    }

    const updated = await db
        .update(reportsRS)
        .set({
            status: targetStatus,
            updatedById: actor.userId,
            updatedAt: now,
            ...(transition === 'ACCEPT'
                ? {
                      puskesmasReviewedAt: now,
                      acceptedAt: now,
                      assignedToId: actor.userId,
                  }
                : {}),
            ...(transition === 'REJECT' || transition === 'REJECT_BY_DINKES'
                ? {
                      rejectionReason: note ?? null,
                      rejectedBy: actor.userId,
                      puskesmasReviewedAt: now,
                  }
                : {}),
        })
        .where(
            and(
                eq(reportsRS.id, id),
                eq(reportsRS.status, current.status),
                actor.role === 'PUSKESMAS'
                    ? eq(
                          reportsRS.assignedPuskesmasId,
                          actor.institutionId ?? '',
                      )
                    : sql`true`,
            ),
        )
        .returning({ status: reportsRS.status });

    if (!updated[0]) {
        return { ok: false, reason: 'ILLEGAL_STATE' };
    }

    if (transition === 'ACCEPT') {
        try {
            await enqueuePeSla(id);
        } catch (err) {
            console.error('[transition] gagal enqueue PE SLA', err);
        }
    }

    if (transition === 'REJECT') {
        await insertNotifications(
            { kind: 'INSTITUTION', institutionId: current.institutionId },
            {
                title: 'Laporan ditolak puskesmas',
                message: `Laporan ${current.reportNumber} ditolak. Lihat alasan dan kirim ulang bila perlu.`,
                type: 'REJECTED',
                entityType: 'REPORT_RS',
                entityId: id,
            },
        );
    }

    if (transition === 'REJECT_BY_DINKES') {
        await insertNotifications(
            { kind: 'INSTITUTION', institutionId: current.institutionId },
            {
                title: 'Laporan ditolak Dinas Kesehatan',
                message: `Hasil PE untuk ${current.reportNumber} ditolak Dinkes.`,
                type: 'REJECTED',
                entityType: 'REPORT_RS',
                entityId: id,
            },
        );
    }

    if (transition === 'VERIFY' || transition === 'REJECT_BY_DINKES') {
        await db
            .update(reportsPE)
            .set({
                status: transition === 'VERIFY' ? 'VERIFIED' : 'REJECTED',
                updatedById: actor.userId,
                updatedAt: now,
            })
            .where(eq(reportsPE.reportRSId, id));
    }

    if (
        transition === 'VERIFY' &&
        targetStatus === 'FOGGING_REQUIRED' &&
        current.assignedPuskesmasId
    ) {
        const scheduledDate = new Date(now.getTime() + 24 * 3600 * 1000);
        await db
            .insert(foggingCycles)
            .values({
                reportRSId: id,
                reportPEId: current.pe?.id ?? null,
                institutionId: current.assignedPuskesmasId,
                cycleNumber: 1,
                status: 'SCHEDULED',
                scheduledDate,
            })
            .onConflictDoNothing();

        await insertNotifications(
            {
                kind: 'INSTITUTION',
                institutionId: current.assignedPuskesmasId,
            },
            {
                title: 'Wajib Fogging Fokus — Siklus 1',
                message: `PE ${current.reportNumber} terverifikasi positif penularan. Laksanakan Fogging Siklus 1.`,
                type: 'FOGGING_REQUIRED',
                entityType: 'REPORT_RS',
                entityId: id,
            },
        );

        try {
            await enqueueWhatsAppDispatch({
                recipientPhone: '',
                recipientRole: 'PUSKESMAS',
                reportRSId: id,
                eventKind: 'FOGGING_REQUIRED',
                message: `[WALI-EPI] PE ${current.reportNumber} (${current.kelurahan ?? '-'}) terverifikasi POSITIF PENULARAN. Segera laksanakan Fogging Fokus Siklus 1.`,
            });
        } catch {
            // Non-blocking
        }
    }

    await audit({
        actor,
        action:
            transition === 'VERIFY'
                ? 'VERIFY'
                : transition === 'ACCEPT'
                  ? 'ASSIGN'
                  : 'UPDATE',
        entityType: 'REPORT_RS',
        entityId: id,
        changes: { status: { from: current.status, to: targetStatus } },
    });

    return { ok: true, status: updated[0].status };
}

export async function disposeCrossBorder(
    actor: Actor,
    id: string,
    notes: string,
): Promise<TransitionResult> {
    if (actor.role !== 'DINKES') {
        return { ok: false, reason: 'FORBIDDEN' };
    }

    const db = getDb();
    const now = new Date();
    const [updated] = await db
        .update(reportsRS)
        .set({
            status: 'ARCHIVED_CROSS_BORDER',
            crossBorderNotes: notes,
            updatedById: actor.userId,
            updatedAt: now,
        })
        .where(
            and(
                eq(reportsRS.id, id),
                eq(reportsRS.status, 'CROSS_BORDER_PENDING'),
            ),
        )
        .returning({ status: reportsRS.status });

    if (!updated) {
        return { ok: false, reason: 'ILLEGAL_STATE' };
    }

    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'REPORT_RS',
        entityId: id,
        changes: {
            status: {
                from: 'CROSS_BORDER_PENDING',
                to: 'ARCHIVED_CROSS_BORDER',
            },
            crossBorderNotes: { from: null, to: notes },
        },
    });

    return { ok: true, status: updated.status };
}

export async function deleteReport(
    actor: Actor,
    id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const db = getDb();
    const [row] = await db
        .select({
            id: reportsRS.id,
            reportNumber: reportsRS.reportNumber,
            status: reportsRS.status,
            institutionId: reportsRS.institutionId,
        })
        .from(reportsRS)
        .where(eq(reportsRS.id, id))
        .limit(1);

    if (!row) {
        return { ok: false, error: 'Laporan tidak ditemukan.' };
    }

    const isAuthorized =
        actor.role === 'ADMIN' ||
        actor.role === 'DINKES' ||
        (actor.institutionId && actor.institutionId === row.institutionId);

    if (!isAuthorized) {
        return {
            ok: false,
            error: 'Anda tidak memiliki hak untuk menghapus laporan faskes lain.',
        };
    }

    await db.delete(reportsRS).where(eq(reportsRS.id, id));

    await audit({
        actor,
        action: 'DELETE',
        entityType: 'REPORT_RS',
        entityId: id,
        changes: {
            reportNumber: { from: row.reportNumber, to: null },
            status: { from: row.status, to: null },
        },
    });

    return { ok: true };
}

export const deleteDraftReport = deleteReport;

export async function submitDraftReport(
    actor: Actor,
    id: string,
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
    const db = getDb();
    const [row] = await db
        .select()
        .from(reportsRS)
        .where(eq(reportsRS.id, id))
        .limit(1);

    if (!row) {
        return { ok: false, error: 'Laporan tidak ditemukan.' };
    }

    if (row.status !== 'DRAFT') {
        return {
            ok: false,
            error: 'Laporan ini sudah dikirim sebelumnya.',
        };
    }

    const isOwner =
        actor.role === 'ADMIN' ||
        (actor.institutionId && actor.institutionId === row.institutionId);

    if (!isOwner) {
        return {
            ok: false,
            error: 'Anda tidak memiliki hak untuk mengirim draf faskes lain.',
        };
    }

    const [{ localMatches }] = await db
        .select({ localMatches: sql<number>`count(*)::int` })
        .from(kelurahan)
        .where(
            and(
                sql`lower(${kelurahan.name}) = lower(${row.kelurahan ?? ''})`,
                sql`lower(${kelurahan.kota}) = lower(${row.kota ?? ''})`,
            ),
        );

    const [{ totalKelurahan }] = await db
        .select({ totalKelurahan: sql<number>`count(*)::int` })
        .from(kelurahan);

    const isCrossBorder = totalKelurahan > 0 && localMatches === 0;
    const isPuskesmasPoli =
        actor.role === 'PUSKESMAS' || row.sourceType === 'PUSKESMAS_POLI';

    const targetStatus = isCrossBorder
        ? ('CROSS_BORDER_PENDING' as const)
        : isPuskesmasPoli
          ? ('ASSIGNED_ACCEPTED' as const)
          : ('SUBMITTED' as const);

    const now = new Date();
    await db
        .update(reportsRS)
        .set({
            status: targetStatus,
            updatedById: actor.userId,
            updatedAt: now,
        })
        .where(eq(reportsRS.id, id));

    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'REPORT_RS',
        entityId: id,
        changes: {
            status: { from: 'DRAFT', to: targetStatus },
        },
    });

    if (isCrossBorder) {
        await insertNotifications(
            { kind: 'ROLE', role: 'DINKES' },
            {
                title: 'Kasus luar wilayah terdeteksi',
                message: `Laporan ${row.reportNumber} berdomisili di ${row.kota} dan menunggu disposisi Dinkes.`,
                type: 'CROSS_BORDER',
                entityType: 'REPORT_RS',
                entityId: id,
            },
        );
    } else if (!isPuskesmasPoli) {
        try {
            const assignRes = await assignReportByKelurahan(id);
            if (assignRes.assigned) {
                await insertNotifications(
                    {
                        kind: 'INSTITUTION',
                        institutionId: assignRes.puskesmasId,
                    },
                    {
                        title: 'Laporan kasus baru masuk',
                        message: `Laporan ${row.reportNumber} (${row.caseType}) di Kel. ${row.kelurahan} menunggu verifikasi Puskesmas (SLA 24 jam).`,
                        type: 'ASSIGNMENT',
                        entityType: 'REPORT_RS',
                        entityId: id,
                    },
                );
            }
        } catch (err) {
            console.error('[laporan] auto-assign inline error:', err);
        }

        try {
            await insertNotifications(
                { kind: 'ROLE', role: 'DINKES' },
                {
                    title: 'Laporan kasus DBD baru',
                    message: `Laporan ${row.reportNumber} (${row.caseType}) diterima dari faskes di Kel. ${row.kelurahan}, Kec. ${row.kecamatan}.`,
                    type: 'STATUS_CHANGE',
                    entityType: 'REPORT_RS',
                    entityId: id,
                },
            );
        } catch (err) {
            console.error('[laporan] dinkes notification error:', err);
        }
    } else {
        try {
            await insertNotifications(
                { kind: 'ROLE', role: 'DINKES' },
                {
                    title: 'Laporan kasus DBD baru (Puskesmas Poli)',
                    message: `Laporan ${row.reportNumber} (${row.caseType}) dibuat langsung oleh Puskesmas di Kel. ${row.kelurahan}.`,
                    type: 'STATUS_CHANGE',
                    entityType: 'REPORT_RS',
                    entityId: id,
                },
            );
        } catch (err) {
            console.error('[laporan] poli dinkes notification error:', err);
        }
    }

    try {
        if (!isCrossBorder && !isPuskesmasPoli) {
            await enqueueAssign(id);
            await enqueueSla(id);
        }
        if (row.latitude !== null && row.longitude !== null) {
            await enqueueClusterDetector(id);
        }
        if (isCrossBorder) {
            await enqueueWhatsAppDispatch({
                recipientPhone: process.env.DINKES_ALERT_PHONE ?? '',
                recipientRole: 'DINKES',
                reportRSId: id,
                eventKind: 'CROSS_BORDER',
                message: `[WALI-EPI] Kasus luar wilayah ${row.reportNumber} (${row.kelurahan}, ${row.kota}) menunggu disposisi Dinkes di /laporan/lintas-wilayah.`,
            });
        }
    } catch (error) {
        console.error('[laporan] gagal enqueue ke Redis', { reportId: id, error });
    }

    return { ok: true, status: targetStatus };
}

export async function updateReport(
    actor: Actor,
    id: string,
    input: Partial<CreateReportInput>,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const db = getDb();
    const [row] = await db
        .select()
        .from(reportsRS)
        .where(eq(reportsRS.id, id))
        .limit(1);

    if (!row) {
        return { ok: false, error: 'Laporan tidak ditemukan.' };
    }

    const isAuthorized =
        actor.role === 'ADMIN' ||
        actor.role === 'DINKES' ||
        (actor.institutionId && actor.institutionId === row.institutionId);

    if (!isAuthorized) {
        return {
            ok: false,
            error: 'Anda tidak memiliki hak untuk mengubah laporan faskes lain.',
        };
    }

    const updates: Record<string, unknown> = {
        updatedById: actor.userId,
        updatedAt: new Date(),
    };

    if (input.patientName) updates.patientNameEncrypted = encryptPii(input.patientName);
    if (input.patientNik) {
        updates.patientNikEncrypted = encryptPii(input.patientNik);
        updates.patientNikHash = hashPii(input.patientNik);
    }
    if (input.patientAddress) updates.patientAddressEncrypted = encryptPii(input.patientAddress);
    if (input.phoneNumber !== undefined) {
        updates.phoneNumberEncrypted = input.phoneNumber ? encryptPii(input.phoneNumber) : null;
    }
    if (input.patientAge !== undefined) updates.patientAge = input.patientAge;
    if (input.patientGender) updates.patientGender = input.patientGender;
    if (input.caseType) updates.caseType = input.caseType;
    if (input.kelurahan) updates.kelurahan = input.kelurahan;
    if (input.kecamatan) updates.kecamatan = input.kecamatan;
    if (input.kota) updates.kota = input.kota;
    if (input.provinsi) updates.provinsi = input.provinsi;
    if (input.rt !== undefined) updates.rt = input.rt || null;
    if (input.rw !== undefined) updates.rw = input.rw || null;
    if (input.latitude !== undefined) updates.latitude = input.latitude;
    if (input.longitude !== undefined) updates.longitude = input.longitude;
    if (input.admissionDate) updates.admissionDate = input.admissionDate;
    if (input.symptomOnsetDate !== undefined) updates.symptomOnsetDate = input.symptomOnsetDate ?? null;
    if (input.diagnosisDate !== undefined) updates.diagnosisDate = input.diagnosisDate ?? null;
    if (input.plateletCount !== undefined) updates.plateletCount = input.plateletCount ?? null;
    if (input.hematocrit !== undefined) {
        updates.hematocrit = input.hematocrit !== null && input.hematocrit !== undefined ? String(input.hematocrit) : null;
    }
    if (input.ns1Result !== undefined) updates.dengueBlot = input.ns1Result ?? null;
    if (input.igmResult !== undefined) updates.igm = input.igmResult ?? null;
    if (input.iggResult !== undefined) updates.igg = input.iggResult ?? null;
    if (input.diagnosis !== undefined) updates.diagnosis = input.diagnosis ?? null;

    // Handle status toggling: kirim (terkirim) vs draf
    if (input.isDraft === true) {
        updates.status = 'DRAFT';
    } else if (input.isDraft === false && row.status === 'DRAFT') {
        const [{ localMatches }] = await db
            .select({ localMatches: sql<number>`count(*)::int` })
            .from(kelurahan)
            .where(
                and(
                    sql`lower(${kelurahan.name}) = lower(${input.kelurahan ?? row.kelurahan ?? ''})`,
                    sql`lower(${kelurahan.kota}) = lower(${input.kota ?? row.kota ?? ''})`,
                ),
            );
        const [{ totalKelurahan }] = await db
            .select({ totalKelurahan: sql<number>`count(*)::int` })
            .from(kelurahan);
        const isCrossBorder = totalKelurahan > 0 && localMatches === 0;
        const isPuskesmasPoli =
            actor.role === 'PUSKESMAS' || row.sourceType === 'PUSKESMAS_POLI';
        updates.status = isCrossBorder
            ? 'CROSS_BORDER_PENDING'
            : isPuskesmasPoli
              ? 'ASSIGNED_ACCEPTED'
              : 'SUBMITTED';
    }

    await db.update(reportsRS).set(updates).where(eq(reportsRS.id, id));

    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'REPORT_RS',
        entityId: id,
        changes: {
            reportNumber: { from: row.reportNumber, to: row.reportNumber },
            updatedFields: { from: null, to: Object.keys(updates) },
        },
    });

    return { ok: true };
}

export const updateDraftReport = updateReport;
