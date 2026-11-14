import { and, asc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { institutions, reportsRS, users } from '@/db/schema';

export type AssignmentResult =
    | {
          assigned: false;
          reason: 'NOT_FOUND' | 'NO_MATCH' | 'NO_OFFICER' | 'ALREADY_ASSIGNED';
      }
    | { assigned: true; puskesmasId: string; officerId: string | null };

/**
 * Auto-assign by kelurahan. The prototype resolved the Puskesmas in the browser
 * (`reports-rs.service.ts:213` — "the matched Puskesmas ID from kelurahan
 * selection"), so a client chose its own recipient. The match now runs on the
 * server, from stored institution coverage, and only when unassigned.
 */
export async function assignReportByKelurahan(
    reportId: string,
): Promise<AssignmentResult> {
    const db = getDb();

    const [report] = await db
        .select({
            id: reportsRS.id,
            kelurahan: reportsRS.kelurahan,
            assignedPuskesmasId: reportsRS.assignedPuskesmasId,
            status: reportsRS.status,
        })
        .from(reportsRS)
        .where(eq(reportsRS.id, reportId))
        .limit(1);

    if (!report) {
        return { assigned: false, reason: 'NOT_FOUND' };
    }

    if (report.assignedPuskesmasId) {
        return { assigned: false, reason: 'ALREADY_ASSIGNED' };
    }

    if (!report.kelurahan) {
        return { assigned: false, reason: 'NO_MATCH' };
    }

    const [puskesmas] = await db
        .select({ id: institutions.id })
        .from(institutions)
        .where(
            and(
                eq(institutions.type, 'PUSKESMAS'),
                eq(institutions.isActive, true),
                // Array containment: the institution's coverage list holds
                // this kelurahan. Case- and whitespace-insensitive so ' Cilodong ' matches.
                sql`exists (
                    select 1 from unnest(${institutions.kelurahanList}) as k
                    where lower(btrim(k)) = lower(btrim(${report.kelurahan}))
                )`,
            ),
        )
        .orderBy(asc(institutions.id))
        .limit(1);

    if (!puskesmas) {
        return { assigned: false, reason: 'NO_MATCH' };
    }

    // Prefer an officer at that Puskesmas; assignment to the institution alone
    // is still valid, so a missing officer is not a failure.
    const [officer] = await db
        .select({ id: users.id })
        .from(users)
        .where(
            and(
                eq(users.institutionId, puskesmas.id),
                eq(users.isActive, true),
                eq(users.role, 'PUSKESMAS'),
            ),
        )
        .orderBy(asc(users.id))
        .limit(1);

    // `.returning()` is the arbiter: if a concurrent worker assigned this
    // report between the read above and this write, the WHERE matches nothing
    // and we must not claim the assignment — the caller notifies only on a win.
    const [won] = await db
        .update(reportsRS)
        .set({
            assignedPuskesmasId: puskesmas.id,
            assignedToId: officer?.id ?? null,
            assignedAt: new Date(),
            status: 'ASSIGNED',
        })
        .where(
            and(
                eq(reportsRS.id, reportId),
                sql`${reportsRS.assignedPuskesmasId} is null`,
                // Only a report still waiting for a puskesmas may be
                // assigned; a draft or an already-verified row must not be
                // dragged back into the queue by an orphan-sweep.
                eq(reportsRS.status, 'SUBMITTED'),
            ),
        )
        .returning({ id: reportsRS.id });

    if (!won) {
        return { assigned: false, reason: 'ALREADY_ASSIGNED' };
    }

    return {
        assigned: true,
        puskesmasId: puskesmas.id,
        officerId: officer?.id ?? null,
    };
}

/**
 * SLA is four days from submission, by one definition only: `createdAt`.
 * The delayed job and the nightly sweep both read this function, so they can
 * never disagree about what "4 days" means.
 */
const SLA_INTERVAL = sql`interval '24 hours'`;

/**
 * Rows one sweep run may touch. The night job repeats, so a backlog drains
 * oldest-first over successive runs instead of being truncated silently.
 */
const SWEEP_BATCH = 500;

export async function findOverdueReportIds(): Promise<string[]> {
    const rows = await getDb()
        .select({ id: reportsRS.id })
        .from(reportsRS)
        .where(
            sql`${reportsRS.status} = 'ASSIGNED'
                and ${reportsRS.puskesmasReviewedAt} is null
                and ${reportsRS.createdAt} < now() - ${SLA_INTERVAL}`,
        )
        // Oldest first, so a backlog larger than one sweep is worked through
        // in order instead of re-selecting the same arbitrary rows.
        .orderBy(asc(reportsRS.createdAt))
        .limit(SWEEP_BATCH);

    return rows.map((r) => r.id);
}

/**
 * Reports that were submitted but never got a Puskesmas — the enqueue to Redis
 * failed, or the worker was down at that moment. Without this they sit in
 * SUBMITTED forever and the SLA sweep (which only looks at ASSIGNED) never
 * sees them. Run nightly by the same sweep.
 */
export async function findUnassignedReportIds(): Promise<string[]> {
    const rows = await getDb()
        .select({ id: reportsRS.id })
        .from(reportsRS)
        .where(
            sql`${reportsRS.status} in ('SUBMITTED', 'ASSIGNED')
                and ${reportsRS.assignedPuskesmasId} is null
                and ${reportsRS.createdAt} > now() - interval '30 days'`,
        )
        .orderBy(asc(reportsRS.createdAt))
        .limit(SWEEP_BATCH);

    return rows.map((r) => r.id);
}
