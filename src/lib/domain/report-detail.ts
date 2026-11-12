import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { institutions, reportsRS } from '@/db/schema';
import { decryptPii } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { insertNotifications } from './notify';
import { scopeToInstitution, type Actor } from '@/lib/session';
import type { ReportStatus } from './reports';

export type ReportDetail = {
    id: string;
    reportNumber: string;
    status: ReportStatus;
    caseType: string;
    kelurahan: string | null;
    kecamatan: string | null;
    kota: string | null;
    provinsi: string | null;
    institutionId: string;
    institutionName: string | null;
    assignedPuskesmasId: string | null;
    assignedPuskesmasName: string | null;
    patient: {
        name: string;
        nik: string;
        address: string;
        age: number;
        gender: string;
    };
    admissionDate: Date;
    diagnosisDate: Date | null;
    plateletCount: number | null;
    hematocrit: string | null;
    diagnosis: string | null;
    rejectionReason: string | null;
    createdAt: Date;
};

const decryptOrHide = (payload: string | null) => {
    if (!payload) return '—';
    try {
        return decryptPii(payload);
    } catch {
        // Never let a key mismatch turn the page into a 500, and never fall
        // back to showing the ciphertext as if it were the value.
        return '[TIDAK DAPAT DIDEKRIPSI]';
    }
};

/**
 * One report, scoped to the caller's institution. The prototype's `findOne(id)`
 * had no scope (C6), so any Puskesmas could read any hospital's patient data by
 * guessing a uuid. Decrypting PII is itself an audited event (C9).
 */
export async function getReport(
    actor: Actor,
    id: string,
): Promise<ReportDetail | null> {
    const institutionId = scopeToInstitution(actor);

    const rows = await getDb()
        .select({
            r: reportsRS,
            institutionName: institutions.name,
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
        const [p] = await getDb()
            .select({ name: institutions.name })
            .from(institutions)
            .where(eq(institutions.id, row.r.assignedPuskesmasId))
            .limit(1);
        puskesmasName = p?.name ?? null;
    }

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
        kelurahan: row.r.kelurahan,
        kecamatan: row.r.kecamatan,
        kota: row.r.kota,
        provinsi: row.r.provinsi,
        institutionId: row.r.institutionId,
        institutionName: row.institutionName,
        assignedPuskesmasId: row.r.assignedPuskesmasId,
        assignedPuskesmasName: puskesmasName,
        patient: {
            name: decryptOrHide(row.r.patientNameEncrypted),
            nik: decryptOrHide(row.r.patientNikEncrypted),
            address: decryptOrHide(row.r.patientAddressEncrypted),
            age: row.r.patientAge,
            gender: row.r.patientGender,
        },
        admissionDate: row.r.admissionDate,
        diagnosisDate: row.r.diagnosisDate,
        plateletCount: row.r.plateletCount,
        hematocrit: row.r.hematocrit,
        diagnosis: row.r.diagnosis,
        rejectionReason: row.r.rejectionReason,
        createdAt: row.r.createdAt,
    };
}

export type Transition = 'ACCEPT' | 'REJECT' | 'VERIFY' | 'REJECT_BY_DINKES';

export type TransitionResult =
    | { ok: true; status: ReportStatus }
    | { ok: false; reason: 'NOT_FOUND' | 'FORBIDDEN' | 'ILLEGAL_STATE' };

/** Which transitions each role may make, and from which states. */
const ALLOWED: Record<
    Transition,
    { from: ReportStatus[]; to: ReportStatus; roles: Actor['role'][] }
> = {
    ACCEPT: {
        from: ['ASSIGNED'],
        to: 'ASSIGNED_ACCEPTED',
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

    // The status is part of the WHERE clause, so two officers clicking at once
    // cannot both "win" a state their rule no longer allows.
    const updated = await getDb()
        .update(reportsRS)
        .set({
            status: rule.to,
            updatedById: actor.userId,
            updatedAt: new Date(),
            ...(transition === 'ACCEPT'
                ? {
                      puskesmasReviewedAt: new Date(),
                      assignedToId: actor.userId,
                  }
                : {}),
            ...(transition === 'REJECT' || transition === 'REJECT_BY_DINKES'
                ? {
                      rejectionReason: note ?? null,
                      rejectedBy: actor.userId,
                      puskesmasReviewedAt:
                          transition === 'REJECT'
                              ? new Date()
                              : current.admissionDate,
                  }
                : {}),
        })
        .where(
            and(
                eq(reportsRS.id, id),
                eq(reportsRS.status, current.status),
                // Puskesmas may only act on reports assigned to it: the scope
                // must be in the write itself, not only in the read above.
                actor.role === 'PUSKESMAS'
                    ? eq(
                          reportsRS.assignedPuskesmasId,
                          actor.institutionId ?? '',
                      )
                    : // Dinkes may verify only a report that is still assigned
                      // to the puskesmas that investigated it.
                      eq(
                          reportsRS.assignedPuskesmasId,
                          current.assignedPuskesmasId ?? '',
                      ),
            ),
        )
        .returning({ status: reportsRS.status });

    if (!updated[0]) {
        return { ok: false, reason: 'ILLEGAL_STATE' };
    }

    // The hospital filed the report and otherwise hears nothing: a rejection
    // left it with no signal to re-submit or follow up. Dinkes' decision goes
    // to the same place.
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
        changes: { status: { from: current.status, to: rule.to } },
    });

    return { ok: true, status: updated[0].status };
}
