import { and, count, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import {
    auditLogs,
    institutions,
    notifications,
    peTasks,
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
        })
        .from(reportsRS)
        .where(sql`true ${scope}`);

    return {
        submitted: Number(row?.submitted ?? 0),
        assigned: Number(row?.assigned ?? 0),
        peCompleted: Number(row?.peCompleted ?? 0),
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
): Promise<Paged<typeof notifications.$inferSelect>> {
    const db = getDb();
    const { current, size, offset } = pageSlice(page, perPage);

    const [rows, [totals]] = await Promise.all([
        db
            .select()
            .from(notifications)
            .where(eq(notifications.userId, userId))
            .orderBy(desc(notifications.createdAt))
            .limit(size)
            .offset(offset),
        db
            .select({ n: count() })
            .from(notifications)
            .where(eq(notifications.userId, userId)),
    ]);

    return {
        rows,
        page: current,
        perPage: size,
        total: Number(totals?.n ?? 0),
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
        ? sql`(${peTasks.assignedPuskesmasId} = ${institutionId} or ${reportsRS.assignedPuskesmasId} = ${institutionId})`
        : sql`true`;

    const [rows, [totals]] = await Promise.all([
        db
            .select({
                id: peTasks.id,
                reportPEId: peTasks.reportPEId,
                reportNumber: reportsRS.reportNumber,
                status: peTasks.status,
                priority: peTasks.priority,
                dueDate: peTasks.dueDate,
                // Late-ness is decided by the database clock, the same one the
                // sweep job uses; comparing against a render-time clock made the
                // page impure and could disagree with the worker.
                isLate: sql<boolean>`${peTasks.dueDate} < now() and ${peTasks.status} <> 'COMPLETED'`,
                notes: peTasks.notes,
                assignedToName: users.name,
            })
            .from(peTasks)
            .innerJoin(reportsPE, eq(reportsPE.id, peTasks.reportPEId))
            .innerJoin(reportsRS, eq(reportsRS.id, reportsPE.reportRSId))
            .leftJoin(users, eq(users.id, peTasks.assignedUserId))
            .where(scope)
            .orderBy(peTasks.dueDate)
            .limit(size)
            .offset(offset),
        db
            .select({ n: count() })
            .from(peTasks)
            .innerJoin(reportsPE, eq(reportsPE.id, peTasks.reportPEId))
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

export async function listAuditLogs(page?: number, perPage = PER_PAGE) {
    const db = getDb();
    const { current, size, offset } = pageSlice(page, perPage);

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
            .orderBy(desc(auditLogs.createdAt))
            .limit(size)
            .offset(offset),
        db.select({ n: count() }).from(auditLogs),
    ]);

    return {
        rows,
        page: current,
        perPage: size,
        total: Number(totals?.n ?? 0),
    };
}
