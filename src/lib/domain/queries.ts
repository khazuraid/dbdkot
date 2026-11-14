import { and, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/db';
import {
    auditLogs,
    institutions,
    notifications,
    reportsPE,
    reportsRS,
    users,
} from '@/db/schema';
import { scopeToInstitution, type Actor } from '@/lib/session';

/** Offset paging shared by every server-paginated list on this module. */
export const PER_PAGE = 25;

function pageSlice(page: number | undefined, perPage = PER_PAGE) {
    const size = Math.min(100, Math.max(1, perPage));
    const current = Math.max(1, Math.floor(page ?? 1));
    return { current, size, offset: (current - 1) * size };
}

export type Paged<T> = {
    rows: T[];
    page: number;
    perPage: number;
    total: number;
};

/** Queue counts the sidebar and the "perlu action" pages both need. */
export async function queueCounts(actor: Actor) {
    const db = getDb();
    const institutionId = scopeToInstitution(actor);
    const scope = institutionId
        ? sql`and (${reportsRS.institutionId} = ${institutionId} or ${reportsRS.assignedPuskesmasId} = ${institutionId})`
        : sql``;

    const [row] = await db
        .select({
            submitted: sql<number>`count(*) filter (where ${reportsRS.status} = 'SUBMITTED')`,
            assigned: sql<number>`count(*) filter (where ${reportsRS.status} = 'ASSIGNED')`,
            peCompleted: sql<number>`count(*) filter (where ${reportsRS.status} = 'PE_COMPLETED')`,
            crossBorderPending: sql<number>`count(*) filter (where ${reportsRS.status} = 'CROSS_BORDER_PENDING')`,
            foggingRequired: sql<number>`count(*) filter (where ${reportsRS.status} in ('FOGGING_REQUIRED', 'SIKLUS_1_DONE', 'SIKLUS_2_SCHEDULED'))`,
        })
        .from(reportsRS)
        .where(sql`true ${scope}`);

    return {
        submitted: Number(row?.submitted ?? 0),
        assigned: Number(row?.assigned ?? 0),
        peCompleted: Number(row?.peCompleted ?? 0),
        crossBorderPending: Number(row?.crossBorderPending ?? 0),
        foggingRequired: Number(row?.foggingRequired ?? 0),
    };
}

/** Unread notification count. Per-user, so no institution scope applies. */
export async function unreadNotifications(userId: string) {
    const [row] = await getDb()
        .select({ n: count() })
        .from(notifications)
        .where(
            and(
                eq(notifications.userId, userId),
                eq(notifications.isRead, false),
            ),
        );

    return Number(row?.n ?? 0);
}

export async function listNotifications(
    userId: string,
    page?: number,
    perPage = PER_PAGE,
    opts: { unreadOnly?: boolean } = {},
) {
    const db = getDb();
    const { current, size, offset } = pageSlice(page, perPage);

    const where = opts.unreadOnly
        ? and(eq(notifications.userId, userId), eq(notifications.isRead, false))
        : eq(notifications.userId, userId);

    const [rows, [totals], [unread]] = await Promise.all([
        db
            .select()
            .from(notifications)
            .where(where)
            .orderBy(desc(notifications.createdAt))
            .limit(size)
            .offset(offset),
        db.select({ n: count() }).from(notifications).where(where),
        db
            .select({ n: count() })
            .from(notifications)
            .where(
                and(
                    eq(notifications.userId, userId),
                    eq(notifications.isRead, false),
                ),
            ),
    ]);

    return {
        rows,
        page: current,
        perPage: size,
        total: Number(totals?.n ?? 0),
        unread: Number(unread?.n ?? 0),
    };
}

/** PE reports, scoped the same way as ReportRS: the PE copy carries the PII. */
export async function listReportsPE(
    actor: Actor,
    page?: number,
    perPage = PER_PAGE,
) {
    const db = getDb();
    const institutionId = scopeToInstitution(actor);
    const { current, size, offset } = pageSlice(page, perPage);

    const scope = institutionId
        ? sql`(${reportsPE.institutionId} = ${institutionId} or ${reportsRS.assignedPuskesmasId} = ${institutionId})`
        : sql`true`;

    const [rows, [totals]] = await Promise.all([
        db
            .select({
                id: reportsPE.id,
                reportRSId: reportsPE.reportRSId,
                reportNumber: reportsRS.reportNumber,
                peDate: reportsPE.peDate,
                officerName: reportsPE.officerName,
                houseIndex: reportsPE.houseIndex,
                containerIndex: reportsPE.containerIndex,
                conclusion: reportsPE.conclusion,
                status: reportsPE.status,
                institutionName: institutions.name,
            })
            .from(reportsPE)
            .innerJoin(reportsRS, eq(reportsRS.id, reportsPE.reportRSId))
            .leftJoin(
                institutions,
                eq(institutions.id, reportsPE.institutionId),
            )
            .where(scope)
            .orderBy(desc(reportsPE.peDate))
            .limit(size)
            .offset(offset),
        db
            .select({ n: count() })
            .from(reportsPE)
            .innerJoin(reportsRS, eq(reportsRS.id, reportsPE.reportRSId))
            .where(scope),
    ]);

    return {
        rows,
        page: current,
        perPage: size,
        total: Number(totals?.n ?? 0),
    };
}

/**
 * PE workload per officer, aggregated in SQL. The analytics screen used to
 * load a capped page of rows and average them in memory, which undercounted
 * every officer past the cap.
 */
export async function peOfficerStats(actor: Actor) {
    const institutionId = scopeToInstitution(actor);
    const scope = institutionId
        ? sql`(${reportsPE.institutionId} = ${institutionId} or ${reportsRS.assignedPuskesmasId} = ${institutionId})`
        : sql`true`;

    const rows = await getDb()
        .select({
            officer: reportsPE.officerName,
            n: sql<number>`count(*)`,
            meanHi: sql<string | null>`avg(${reportsPE.houseIndex})`,
            meanCi: sql<string | null>`avg(${reportsPE.containerIndex})`,
        })
        .from(reportsPE)
        .innerJoin(reportsRS, eq(reportsRS.id, reportsPE.reportRSId))
        .where(scope)
        .groupBy(reportsPE.officerName)
        .orderBy(sql`count(*) desc`);

    return rows.map((r) => ({
        officer: r.officer,
        reports: Number(r.n),
        meanHi: r.meanHi === null ? null : Number(r.meanHi).toFixed(2),
        meanCi: r.meanCi === null ? null : Number(r.meanCi).toFixed(2),
    }));
}

/** PE tasks visible to the caller's institution. */
export async function listPeTasks(
    actor: Actor,
    page?: number,
    perPage = PER_PAGE,
) {
    const db = getDb();
    const institutionId = scopeToInstitution(actor);
    const { current, size, offset } = pageSlice(page, perPage);

    const scope = institutionId
        ? sql`${reportsRS.assignedPuskesmasId} = ${institutionId} and ${reportsRS.status} in ('ASSIGNED', 'ASSIGNED_ACCEPTED', 'PE_IN_PROGRESS', 'PE_COMPLETED')`
        : sql`${reportsRS.status} in ('ASSIGNED', 'ASSIGNED_ACCEPTED', 'PE_IN_PROGRESS', 'PE_COMPLETED')`;

    const [rows, [totals]] = await Promise.all([
        db
            .select({
                id: reportsRS.id,
                reportPEId: reportsPE.id,
                reportRSId: reportsRS.id,
                reportNumber: reportsRS.reportNumber,
                rawStatus: reportsRS.status,
                status: sql<string>`case
                    when ${reportsRS.status} = 'PE_COMPLETED' then 'COMPLETED'
                    when ${reportsRS.createdAt} + interval '4 days' < now() and ${reportsRS.status} in ('ASSIGNED', 'ASSIGNED_ACCEPTED', 'PE_IN_PROGRESS') then 'OVERDUE'
                    when ${reportsRS.status} in ('ASSIGNED_ACCEPTED', 'PE_IN_PROGRESS') then 'IN_PROGRESS'
                    else 'PENDING'
                end`,
                priority: sql<string>`case
                    when ${reportsRS.createdAt} + interval '4 days' < now() and ${reportsRS.status} <> 'PE_COMPLETED' then 'CRITICAL'
                    when ${reportsRS.plateletCount} < 50000 then 'CRITICAL'
                    when ${reportsRS.caseType} in ('DHF', 'DSS') then 'HIGH'
                    else 'NORMAL'
                end`,
                dueDate: sql<Date>`${reportsRS.createdAt} + interval '4 days'`,
                isLate: sql<boolean>`${reportsRS.createdAt} + interval '4 days' < now() and ${reportsRS.status} <> 'PE_COMPLETED'`,
                notes: sql<string | null>`case
                    when ${reportsRS.status} = 'ASSIGNED' then 'Menunggu penerimaan puskesmas'
                    when ${reportsRS.status} = 'ASSIGNED_ACCEPTED' then 'Laporan diterima, siap dilakukan PE 100m'
                    when ${reportsRS.status} = 'PE_IN_PROGRESS' then 'PE sedang dilakukan'
                    when ${reportsRS.status} = 'PE_COMPLETED' then 'PE selesai, menunggu verifikasi Dinkes'
                    else null
                end`,
                assignedToName: reportsPE.officerName,
            })
            .from(reportsRS)
            .leftJoin(reportsPE, eq(reportsPE.reportRSId, reportsRS.id))
            .where(scope)
            .orderBy(
                sql`case when ${reportsRS.status} in ('ASSIGNED', 'ASSIGNED_ACCEPTED', 'PE_IN_PROGRESS') then 0 else 1 end`,
                reportsRS.createdAt,
            )
            .limit(size)
            .offset(offset),
        db
            .select({ n: count() })
            .from(reportsRS)
            .where(scope),
    ]);

    return {
        rows,
        page: current,
        perPage: size,
        total: Number(totals?.n ?? 0),
    };
}

export async function listUsers(page?: number, perPage = PER_PAGE) {
    const db = getDb();
    const { current, size, offset } = pageSlice(page, perPage);

    const [rows, [totals]] = await Promise.all([
        db
            .select({
                id: users.id,
                name: users.name,
                email: users.email,
                role: users.role,
                isActive: users.isActive,
                institutionName: institutions.name,
                createdAt: users.createdAt,
            })
            .from(users)
            .leftJoin(institutions, eq(institutions.id, users.institutionId))
            .orderBy(users.name)
            .limit(size)
            .offset(offset),
        db.select({ n: count() }).from(users),
    ]);

    return {
        rows,
        page: current,
        perPage: size,
        total: Number(totals?.n ?? 0),
    };
}

export async function listInstitutions(page?: number, perPage = PER_PAGE) {
    const db = getDb();
    const { current, size, offset } = pageSlice(page, perPage);

    const [rows, [totals]] = await Promise.all([
        db
            .select({
                id: institutions.id,
                name: institutions.name,
                type: institutions.type,
                city: institutions.city,
                kelurahanList: institutions.kelurahanList,
                isActive: institutions.isActive,
            })
            .from(institutions)
            .orderBy(institutions.name)
            .limit(size)
            .offset(offset),
        db.select({ n: count() }).from(institutions),
    ]);

    return {
        rows,
        page: current,
        perPage: size,
        total: Number(totals?.n ?? 0),
    };
}

export async function listAuditLogs(
    page?: number,
    perPage = PER_PAGE,
    filters: { q?: string; action?: string } = {},
) {
    const db = getDb();
    const { current, size, offset } = pageSlice(page, perPage);

    const conditions: SQL[] = [];
    if (filters.action) {
        conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters.q) {
        const q = `%${filters.q.trim()}%`;
        const match = or(
            ilike(users.name, q),
            ilike(users.email, q),
            ilike(auditLogs.entityId, q),
        );
        if (match) conditions.push(match);
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [totals]] = await Promise.all([
        db
            .select({
                id: auditLogs.id,
                action: auditLogs.action,
                entityType: auditLogs.entityType,
                entityId: auditLogs.entityId,
                changes: auditLogs.changes,
                createdAt: auditLogs.createdAt,
                userName: users.name,
                userEmail: users.email,
            })
            .from(auditLogs)
            .leftJoin(users, eq(users.id, auditLogs.userId))
            .where(where)
            .orderBy(desc(auditLogs.createdAt))
            .limit(size)
            .offset(offset),
        db
            .select({ n: count() })
            .from(auditLogs)
            .leftJoin(users, eq(users.id, auditLogs.userId))
            .where(where),
    ]);

    return {
        rows,
        page: current,
        perPage: size,
        total: Number(totals?.n ?? 0),
    };
}
