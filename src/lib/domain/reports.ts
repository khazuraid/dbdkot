import { and, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/db';
import { reportsRS } from '@/db/schema';
import type { Actor } from '@/lib/session';
import { scopeToInstitution } from '@/lib/session';
import { STATUSES, needActionStatusesFor, type ReportListRow } from './report-labels';

export type ReportStatus = (typeof STATUSES)[number];

// Labels and the row shape live in a module with no database import, so a
// client component can render them without a driver in the browser bundle.
export {
    STATUS_LABEL,
    STATUSES,
    CASE_TYPE_LABEL,
    NEED_ACTION_STATUSES,
    needActionStatusesFor,
    type ReportListRow,
} from './report-labels';

export type ReportPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type ReportAgeGroup = 'under_5' | '5_14' | '15_44' | '45_plus';

export type ReportListFilters = {
    status?: ReportStatus;
    /** Same as `status` but for the queues that span several states. */
    statuses?: ReportStatus[];
    search?: string;
    period?: ReportPeriod;
    caseType?: string;
    gender?: 'L' | 'P';
    ageGroup?: ReportAgeGroup;
    sourceType?: 'RS' | 'PUSKESMAS';
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

    if (filters.period) {
        if (filters.period === 'weekly') {
            conditions.push(sql`${reportsRS.createdAt} >= now() - interval '7 days'`);
        } else if (filters.period === 'monthly') {
            conditions.push(sql`${reportsRS.createdAt} >= date_trunc('month', now())`);
        } else if (filters.period === 'quarterly') {
            conditions.push(sql`${reportsRS.createdAt} >= date_trunc('quarter', now())`);
        } else if (filters.period === 'yearly') {
            conditions.push(sql`${reportsRS.createdAt} >= date_trunc('year', now())`);
        }
    }

    if (filters.caseType) {
        conditions.push(sql`${reportsRS.caseType} = ${filters.caseType}`);
    }

    if (filters.gender) {
        conditions.push(eq(reportsRS.patientGender, filters.gender));
    }

    if (filters.ageGroup) {
        if (filters.ageGroup === 'under_5') {
            conditions.push(sql`${reportsRS.patientAge} < 5`);
        } else if (filters.ageGroup === '5_14') {
            conditions.push(sql`${reportsRS.patientAge} >= 5 and ${reportsRS.patientAge} <= 14`);
        } else if (filters.ageGroup === '15_44') {
            conditions.push(sql`${reportsRS.patientAge} >= 15 and ${reportsRS.patientAge} <= 44`);
        } else if (filters.ageGroup === '45_plus') {
            conditions.push(sql`${reportsRS.patientAge} >= 45`);
        }
    }

    if (filters.sourceType) {
        if (filters.sourceType === 'PUSKESMAS') {
            conditions.push(sql`(${reportsRS.sourceType} = 'PUSKESMAS_POLI' or ${reportsRS.sourceType} = 'PUSKESMAS')`);
        } else if (filters.sourceType === 'RS') {
            conditions.push(eq(reportsRS.sourceType, 'RS'));
        }
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
                kota: reportsRS.kota,
                latitude: reportsRS.latitude,
                longitude: reportsRS.longitude,
                clusterId: reportsRS.clusterId,
                sourceType: reportsRS.sourceType,
                assignedAt: reportsRS.assignedAt,
                acceptedAt: reportsRS.acceptedAt,
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

export async function getReportsForExport(
    actor: Actor,
    filters: ReportListFilters = {},
) {
    const db = getDb();
    const where = baseConditions(actor, filters);
    const clause = where.length ? and(...where) : undefined;

    return db
        .select({
            id: reportsRS.id,
            reportNumber: reportsRS.reportNumber,
            sourceType: reportsRS.sourceType,
            caseType: reportsRS.caseType,
            age: reportsRS.patientAge,
            gender: reportsRS.patientGender,
            kelurahan: reportsRS.kelurahan,
            kecamatan: reportsRS.kecamatan,
            kota: reportsRS.kota,
            latitude: reportsRS.latitude,
            longitude: reportsRS.longitude,
            status: reportsRS.status,
            admissionDate: reportsRS.admissionDate,
            createdAt: reportsRS.createdAt,
        })
        .from(reportsRS)
        .where(clause)
        .orderBy(desc(reportsRS.createdAt))
        .limit(10000);
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
    const actionStatuses = needActionStatusesFor(actor.role);
    const actionList = sql.join(
        actionStatuses.map((s) => sql`${s}`),
        sql`, `,
    );

    const [row] = await db
        .select({
            total: count(),
            needAction: sql<number>`count(*) filter (where ${reportsRS.status} in (${actionList}))`,
            verifiedThisMonth: sql<number>`count(*) filter (where ${reportsRS.status} in ('VERIFIED', 'FOGGING_REQUIRED', 'SIKLUS_1_DONE', 'SIKLUS_2_SCHEDULED', 'SIKLUS_2_DONE', 'CLOSED') and (${reportsRS.updatedAt} at time zone 'Asia/Jakarta') >= date_trunc('month', now() at time zone 'Asia/Jakarta'))`,
            slaOverdue: sql<number>`count(*) filter (where (
                (${reportsRS.status} = 'ASSIGNED' and ${reportsRS.puskesmasReviewedAt} is null and coalesce(${reportsRS.assignedAt}, ${reportsRS.createdAt}) < now() - interval '24 hours')
                or (${reportsRS.status} in ('ASSIGNED_ACCEPTED', 'PE_IN_PROGRESS') and coalesce(${reportsRS.acceptedAt}, ${reportsRS.puskesmasReviewedAt}, ${reportsRS.createdAt}) < now() - interval '72 hours')
            ))`,
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

/**
 * Case types by count, grouped in SQL. Analytics reads this instead of loading
 * a capped page of rows and tallying in memory, which silently dropped every
 * case beyond the cap.
 */
export async function caseCounts(
    actor: Actor,
): Promise<{ caseType: string; n: number }[]> {
    const institutionId = scopeToInstitution(actor);
    const scope = institutionId
        ? sql`and (${reportsRS.institutionId} = ${institutionId} or ${reportsRS.assignedPuskesmasId} = ${institutionId})`
        : sql``;

    const rows = await getDb()
        .select({ caseType: reportsRS.caseType, n: sql<number>`count(*)` })
        .from(reportsRS)
        .where(sql`true ${scope}`)
        .groupBy(reportsRS.caseType)
        .orderBy(sql`count(*) desc`);

    return rows.map((r) => ({ caseType: r.caseType, n: Number(r.n) }));
}

/** Daily submissions for the last 14 days (WIB / Asia/Jakarta); gaps filled with zero, not omitted. */
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
            sql`generate_series(date_trunc('day', now() at time zone 'Asia/Jakarta') - interval '13 days', date_trunc('day', now() at time zone 'Asia/Jakarta'), interval '1 day') as d(day)`,
        )
        .leftJoin(
            reportsRS,
            sql`date_trunc('day', ${reportsRS.createdAt} at time zone 'Asia/Jakarta') = d.day ${scope}`,
        )
        .groupBy(sql`d.day`)
        .orderBy(sql`d.day`);

    return rows.map((r) => ({ day: r.day, n: Number(r.n) }));
}

export async function listCrossBorderReports(actor: Actor) {
    if (actor.role !== 'DINKES' && actor.role !== 'ADMIN') {
        return [];
    }
    return getDb()
        .select({
            id: reportsRS.id,
            reportNumber: reportsRS.reportNumber,
            kelurahan: reportsRS.kelurahan,
            kecamatan: reportsRS.kecamatan,
            kota: reportsRS.kota,
            provinsi: reportsRS.provinsi,
            crossBorderTargetCity: reportsRS.crossBorderTargetCity,
            crossBorderNotes: reportsRS.crossBorderNotes,
            caseType: reportsRS.caseType,
            status: reportsRS.status,
            createdAt: reportsRS.createdAt,
        })
        .from(reportsRS)
        .where(
            inArray(reportsRS.status, [
                'CROSS_BORDER_PENDING',
                'ARCHIVED_CROSS_BORDER',
            ]),
        )
        .orderBy(desc(reportsRS.createdAt))
        .limit(100);
}

/**
 * Zero-PII public epidemiological summary for the unauthenticated `/` landing page.
 * Returns aggregated counts only — never patient names, NIKs, or coordinates.
 */
export async function getPublicSurveillanceSummary() {
    const db = getDb();
    try {
        const [totals] = await db
            .select({
                totalThisMonth: sql<number>`count(*) filter (where (${reportsRS.createdAt} at time zone 'Asia/Jakarta') >= date_trunc('month', now() at time zone 'Asia/Jakarta'))`,
                peCompleted: sql<number>`count(*) filter (where ${reportsRS.status} in ('PE_COMPLETED', 'VERIFIED', 'FOGGING_REQUIRED', 'SIKLUS_1_DONE', 'SIKLUS_2_SCHEDULED', 'SIKLUS_2_DONE', 'CLOSED'))`,
                foggingActive: sql<number>`count(*) filter (where ${reportsRS.status} in ('FOGGING_REQUIRED', 'SIKLUS_1_DONE', 'SIKLUS_2_SCHEDULED'))`,
                closedCases: sql<number>`count(*) filter (where ${reportsRS.status} in ('VERIFIED', 'CLOSED'))`,
            })
            .from(reportsRS);

        const topKecamatan = await db
            .select({
                kecamatan: reportsRS.kecamatan,
                count: sql<number>`count(*)`,
            })
            .from(reportsRS)
            .where(sql`${reportsRS.kecamatan} is not null`)
            .groupBy(reportsRS.kecamatan)
            .orderBy(sql`count(*) desc`)
            .limit(5);

        return {
            totalThisMonth: Number(totals?.totalThisMonth ?? 0),
            peCompleted: Number(totals?.peCompleted ?? 0),
            foggingActive: Number(totals?.foggingActive ?? 0),
            closedCases: Number(totals?.closedCases ?? 0),
            topKecamatan: topKecamatan.map((r) => ({
                kecamatan: r.kecamatan ?? 'Lainnya',
                count: Number(r.count),
            })),
        };
    } catch {
        return {
            totalThisMonth: 0,
            peCompleted: 0,
            foggingActive: 0,
            closedCases: 0,
            topKecamatan: [],
        };
    }
}
