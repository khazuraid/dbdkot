import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import {
    foggingCycles,
    institutions,
    reportsPE,
    reportsRS,
    waDispatches,
} from '@/db/schema';
import { decryptPii } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { enqueuePeSla, enqueueWhatsAppDispatch } from '@/lib/queue';
import { insertNotifications } from './notify';
import { scopeToInstitution, type Actor } from '@/lib/session';
import type { ReportStatus } from './reports';

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
