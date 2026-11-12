import { and, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/db';
import { reportsRS } from '@/db/schema';
import type { Actor } from '@/lib/session';
import { scopeToInstitution } from '@/lib/session';
import { STATUSES, type ReportListRow } from './report-labels';

export type ReportStatus = (typeof STATUSES)[number];

// Labels and the row shape live in a module with no database import, so a
// client component can render them without a driver in the browser bundle.
export {
    STATUS_LABEL,
    STATUSES,
    CASE_TYPE_LABEL,
    type ReportListRow,
} from './report-labels';

export type ReportListFilters = {
    status?: ReportStatus;
    /** Same as `status` but for the queues that span several states. */
    statuses?: ReportStatus[];
    search?: string;
    page?: number;
    perPage?: number;
};

/**
 * Every list query on reports goes through here and starts with the tenant
 * scope. That is the C6 fix: `findOne(id)` in the prototype had no scoping, so
 * any Puskesmas could read any hospital's patient data.
 */
function baseConditions(actor: Actor, filters: ReportListFilters): SQL[] {
    const conditions: SQL[] = [];
    const institutionId = scopeToInstitution(actor);

    if (institutionId) {
        conditions.push(
            sql`(${reportsRS.institutionId} = ${institutionId} or ${reportsRS.assignedPuskesmasId} = ${institutionId})`,
        );
    }

    if (filters.status) {
        conditions.push(eq(reportsRS.status, filters.status));
    }

    if (filters.statuses?.length) {
        conditions.push(inArray(reportsRS.status, filters.statuses));
    }

    if (filters.search) {
        // Only non-PII columns are searchable: NIK and name are ciphertext.
        const q = `%${filters.search.trim()}%`;
        conditions.push(
            sql`(${reportsRS.reportNumber} ilike ${q} or ${reportsRS.kelurahan} ilike ${q})`,
        );
    }

    return conditions;
}

export async function listReports(
    actor: Actor,
    filters: ReportListFilters = {},
): Promise<{
    rows: ReportListRow[];
    total: number;
    page: number;
    perPage: number;
}> {
    const db = getDb();
    const page = Math.max(1, filters.page ?? 1);
    const perPage = Math.min(100, Math.max(1, filters.perPage ?? 25));
    const where = baseConditions(actor, filters);
    const clause = where.length ? and(...where) : undefined;

    const [rows, [totals]] = await Promise.all([
        db
            .select({
                id: reportsRS.id,
                reportNumber: reportsRS.reportNumber,
                age: reportsRS.patientAge,
                gender: reportsRS.patientGender,
                caseType: reportsRS.caseType,
                kelurahan: reportsRS.kelurahan,
                kecamatan: reportsRS.kecamatan,
                status: reportsRS.status,
                createdAt: reportsRS.createdAt,
            })
            .from(reportsRS)
            .where(clause)
            .orderBy(desc(reportsRS.createdAt))
            .limit(perPage)
            .offset((page - 1) * perPage),
        db.select({ n: count() }).from(reportsRS).where(clause),
    ]);

    return { rows, total: totals?.n ?? 0, page, perPage };
}

export type ReportCounts = {
    total: number;
    needAction: number;
    verifiedThisMonth: number;
    slaOverdue: number;
};

/**
 * The four numbers the dashboard leads with. Computed in SQL, not by loading
 * rows into memory — the prototype pulled 180 days of cases to count them.
 */
export async function reportCounts(actor: Actor): Promise<ReportCounts> {
    const db = getDb();
    const institutionId = scopeToInstitution(actor);
    const scope = institutionId
        ? sql`and (${reportsRS.institutionId} = ${institutionId} or ${reportsRS.assignedPuskesmasId} = ${institutionId})`
        : sql``;

    const [row] = await db
        .select({
            total: count(),
            needAction: sql<number>`count(*) filter (where ${reportsRS.status} in ('SUBMITTED','ASSIGNED'))`,
            verifiedThisMonth: sql<number>`count(*) filter (where ${reportsRS.status} = 'VERIFIED' and ${reportsRS.updatedAt} >= date_trunc('month', now()))`,
            slaOverdue: sql<number>`count(*) filter (where ${reportsRS.status} = 'ASSIGNED' and ${reportsRS.puskesmasReviewedAt} is null and ${reportsRS.updatedAt} < now() - interval '4 days')`,
        })
        .from(reportsRS)
        .where(sql`true ${scope}`);

    return {
        total: Number(row?.total ?? 0),
        needAction: Number(row?.needAction ?? 0),
        verifiedThisMonth: Number(row?.verifiedThisMonth ?? 0),
        slaOverdue: Number(row?.slaOverdue ?? 0),
    };
}

/** Daily submissions for the last 14 days; gaps filled with zero, not omitted. */
export async function dailySeries(
    actor: Actor,
): Promise<{ day: string; n: number }[]> {
    const institutionId = scopeToInstitution(actor);
    const scope = institutionId
        ? sql`and (${reportsRS.institutionId} = ${institutionId} or ${reportsRS.assignedPuskesmasId} = ${institutionId})`
        : sql``;

    const rows = await getDb()
        .select({
            day: sql<string>`to_char(d.day, 'YYYY-MM-DD')`,
            n: sql<number>`count(${reportsRS.id})`,
        })
        .from(
            sql`generate_series(now() - interval '13 days', now(), interval '1 day') as d(day)`,
        )
        .leftJoin(
            reportsRS,
            sql`date_trunc('day', ${reportsRS.createdAt}) = date_trunc('day', d.day) ${scope}`,
        )
        .groupBy(sql`d.day`)
        .orderBy(sql`d.day`);

    return rows.map((r) => ({ day: r.day, n: Number(r.n) }));
}
