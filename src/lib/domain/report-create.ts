import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { institutions, reportsRS } from '@/db/schema';
import { encryptPii, hashPii } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { scopeToInstitution, type Actor } from '@/lib/session';
import { enqueueAssign, enqueueSla } from '@/lib/queue';

// Re-exported so server callers keep importing from the domain module while
// client forms import the same schema without the DB client (form-contracts.ts).
export { createReportSchema, type CreateReportInput } from './form-contracts';
import type { CreateReportInput } from './form-contracts';

export type CreateReportResult =
    | { ok: true; id: string; reportNumber: string }
    | { ok: false; error: string };

/**
 * Sequence from the highest existing number of the day, not from count(*):
 * a deleted report or a rejected insert leaves a gap, and count(*) would hand
 * the same number out twice until the unique index rejects it.
 */
async function nextReportNumber(): Promise<string> {
    const now = new Date();
    const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
    ].join('');
    const [row] = await getDb()
        .select({
            last: sql<string | null>`max(${reportsRS.reportNumber})`,
        })
        .from(reportsRS)
        .where(sql`${reportsRS.reportNumber} like ${`RS-${stamp}-%`}`);

    const lastSeq = row?.last ? Number(row.last.slice(-4)) : 0;

    return `RS-${stamp}-${String(lastSeq + 1).padStart(4, '0')}`;
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
    // Admin has no institution of its own and scopeToInstitution throws for it,
    // so it cannot file a report; the old check admitted it and then failed.
    if (actor.role !== 'RUMAH_SAKIT') {
        return {
            ok: false,
            error: 'Hanya rumah sakit yang dapat melaporkan kasus.',
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
        .select({ type: institutions.type })
        .from(institutions)
        .where(eq(institutions.id, institutionId))
        .limit(1);

    if (institution?.type !== 'RUMAH_SAKIT') {
        return { ok: false, error: 'Fasilitas Anda bukan rumah sakit.' };
    }

    let reportNumber = await nextReportNumber();
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
        phoneNumberEncrypted: input.phoneNumber
            ? encryptPii(input.phoneNumber)
            : null,
        admissionDate: input.admissionDate,
        symptomOnsetDate: input.symptomOnsetDate ?? null,
        diagnosisDate: input.diagnosisDate ?? null,
        plateletCount: input.plateletCount ?? null,
        diagnosis: input.diagnosis || null,
        institutionId,
        createdById: actor.userId,
        status: 'SUBMITTED' as const,
    };

    let inserted: { id: string } | undefined;

    try {
        [inserted] = await getDb()
            .insert(reportsRS)
            .values(values)
            .returning({ id: reportsRS.id });
    } catch (error) {
        // Retry only on a concurrent submit colliding on the unique report
        // number; any other failure (bad column, constraint, connection) must
        // surface as itself instead of being masked by a second insert.
        if (!isUniqueViolation(error)) throw error;
        reportNumber = await nextReportNumber();
        [inserted] = await getDb()
            .insert(reportsRS)
            .values({ ...values, reportNumber })
            .returning({ id: reportsRS.id });
    }

    if (!inserted) {
        return { ok: false, error: 'Laporan gagal disimpan.' };
    }

    await audit({
        actor,
        action: 'CREATE',
        entityType: 'REPORT_RS',
        entityId: inserted.id,
        changes: { reportNumber: { from: null, to: reportNumber } },
    });

    // Queued outside the request's critical path; a Redis outage must not lose
    // the report that was already committed.
    try {
        await enqueueAssign(inserted.id);
        await enqueueSla(inserted.id);
    } catch (error) {
        console.error('[laporan] gagal enqueue ke Redis', {
            reportId: inserted.id,
            error,
        });
    }

    return { ok: true, id: inserted.id, reportNumber };
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
                sql`exists (select 1 from unnest(${institutions.kelurahanList}) k where lower(k) = lower(${kelurahan}))`,
            ),
        )
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
