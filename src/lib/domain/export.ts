import { and, count, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/db';
import { institutions, reportsPE, reportsRS } from '@/db/schema';
import { decryptPii } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { scopeToInstitution, type Actor } from '@/lib/session';

export type ExportKind = 'reports-rs' | 'reports-pe' | 'dashboard';

export type ExportRow = Record<string, string | number | null>;

/**
 * Most rows one workbook carries. The worker writes a note row when the
 * total exceeds it, so a truncated file never reads as the whole dataset.
 */
export const EXPORT_ROW_LIMIT = 50_000;

export type ExportResult = {
    columns: string[];
    rows: ExportRow[];
    total: number;
};

/**
 * Aggregation + row building for exports. Kept off the request path: the
 * prototype built these inline in the page, which is why the 41 screens were
 * both slow and impossible to test.
 *
 * The actor is mandatory. An export runs in the worker from a queued job, so
 * the job must carry a resolved actor — never `filters` alone — or the worker
 * would read every institution's patients (the same hole as C6).
 *
 * PII is decrypted only here, only for an authorised caller, and only the
 * columns the export actually needs. Each export is audited as one READ_PII.
 */
export async function buildReportExport(
    actor: Actor,
    kind: ExportKind,
    filters: Record<string, unknown> = {},
): Promise<ExportResult> {
    const db = getDb();
    const institutionId = scopeToInstitution(actor);

    // Tenant scope first, exactly like listReports: the Dinkes/Admin see
    // everything, a Puskesmas or hospital sees only what it is party to.
    const scope: SQL | undefined = institutionId
        ? sql`(${reportsRS.institutionId} = ${institutionId} or ${reportsRS.assignedPuskesmasId} = ${institutionId})`
        : undefined;

    if (kind === 'reports-rs' || kind === 'dashboard') {
        const conditions: SQL[] = scope ? [scope] : [];

        if (typeof filters.from === 'string') {
            conditions.push(gte(reportsRS.createdAt, new Date(filters.from)));
        }
        if (typeof filters.to === 'string') {
            conditions.push(lte(reportsRS.createdAt, new Date(filters.to)));
        }
        if (typeof filters.status === 'string') {
            // A job payload is not a typed argument: an unknown status would
            // otherwise fail the whole export with a Postgres enum error.
            const status = reportsRS.status.enumValues.find(
                (v) => v === filters.status,
            );
            if (status) {
                conditions.push(eq(reportsRS.status, status));
            }
        }

        const [totals] = await db
            .select({ n: count() })
            .from(reportsRS)
            .where(conditions.length ? and(...conditions) : undefined);

        const rows = await db
            .select({
                reportNumber: reportsRS.reportNumber,
                patientName: reportsRS.patientNameEncrypted,
                age: reportsRS.patientAge,
                gender: reportsRS.patientGender,
                caseType: reportsRS.caseType,
                kelurahan: reportsRS.kelurahan,
                kecamatan: reportsRS.kecamatan,
                kota: reportsRS.kota,
                status: reportsRS.status,
                admissionDate: reportsRS.admissionDate,
                hospital: institutions.name,
            })
            .from(reportsRS)
            .leftJoin(
                institutions,
                eq(reportsRS.institutionId, institutions.id),
            )
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(desc(reportsRS.createdAt))
            .limit(EXPORT_ROW_LIMIT);

        await audit({
            actor,
            action: 'READ_PII',
            entityType: 'REPORT_RS',
            entityId: `export:${kind}`,
            changes: { rows: { from: null, to: rows.length } },
        });

        return {
            columns: [
                'No. Laporan',
                'Nama Pasien',
                'Umur',
                'JK',
                'Klasifikasi',
                'Kelurahan',
                'Kecamatan',
                'Kota',
                'Status',
                'Tgl Masuk',
                'RS',
            ],
            rows: rows.map((r) => ({
                'No. Laporan': r.reportNumber,
                'Nama Pasien': safeDecrypt(r.patientName ?? ''),
                Umur: r.age,
                JK: r.gender,
                Klasifikasi: r.caseType,
                Kelurahan: r.kelurahan,
                Kecamatan: r.kecamatan,
                Kota: r.kota,
                Status: r.status,
                'Tgl Masuk': r.admissionDate?.toISOString() ?? null,
                RS: r.hospital,
            })),
            total: Number(totals?.n ?? 0),
        };
    }

    const [totals] = await db
        .select({ n: count() })
        .from(reportsPE)
        .innerJoin(reportsRS, eq(reportsRS.id, reportsPE.reportRSId))
        .where(scope);

    const rows = await db
        .select({
            reportRSId: reportsPE.reportRSId,
            peDate: reportsPE.peDate,
            officer: reportsPE.officerName,
            houseIndex: reportsPE.houseIndex,
            containerIndex: reportsPE.containerIndex,
            breteauIndex: reportsPE.breteauIndex,
            status: reportsPE.status,
        })
        .from(reportsPE)
        .innerJoin(reportsRS, eq(reportsRS.id, reportsPE.reportRSId))
        .where(scope)
        .orderBy(desc(reportsPE.createdAt))
        .limit(EXPORT_ROW_LIMIT);

    return {
        columns: [
            'ID Laporan RS',
            'Tgl PE',
            'Petugas',
            'House Index',
            'Container Index',
            'Breteau Index',
            'Status',
        ],
        rows: rows.map((r) => ({
            'ID Laporan RS': r.reportRSId,
            'Tgl PE': r.peDate?.toISOString() ?? null,
            Petugas: r.officer,
            'House Index': r.houseIndex,
            'Container Index': r.containerIndex,
            'Breteau Index': r.breteauIndex,
            Status: r.status,
        })),
        total: Number(totals?.n ?? 0),
    };
}

/**
 * A row whose ciphertext cannot be read must not take the whole export down,
 * but it must be visible in the output rather than silently blank.
 */
function safeDecrypt(value: string): string {
    try {
        return decryptPii(value);
    } catch {
        return '[TIDAK DAPAT DIDEKRIPSI]';
    }
}
