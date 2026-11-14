import { and, count, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import {
    conversationUsers,
    conversations,
    institutions,
    messages,
    reportsRS,
    notifications,
    systemSettings,
    users,
} from '@/db/schema';
import type { Actor } from '@/lib/session';
import { audit } from '@/lib/audit';
import { assignReportByKelurahan } from './assignment';
import { transitionReport } from './report-detail';

/**
 * Writes for the screens that had a list but no way to act on it: a
 * notification can be read or dismissed, a report stuck without a puskesmas can
 * be reassigned, a setting can be changed, a verified case can be decided from
 * its queue, and two colleagues can message each other.
 *
 * Same rule as every other domain module: the caller's role is re-checked here,
 * because a server action is a public POST endpoint and the check on the page
 * that drew the form is decoration.
 */

export type ActionResult<E extends string = 'FORBIDDEN' | 'NOT_FOUND'> =
    { ok: true } | { ok: false; error: E; message: string };

/* ── notifikasi ────────────────────────────────────────────────────────── */

/**
 * Touches only the caller's own rows. Scoping by `userId` in the WHERE clause —
 * rather than fetching by id and comparing after — means a guessed id from
 * another account updates nothing instead of revealing that it exists.
 */
export async function setNotificationRead(
    actor: Actor,
    id: string,
    isRead: boolean,
): Promise<ActionResult> {
    const rows = await getDb()
        .update(notifications)
        .set({ isRead, readAt: isRead ? new Date() : null })
        .where(
            and(
                eq(notifications.id, id),
                eq(notifications.userId, actor.userId),
            ),
        )
        .returning({ id: notifications.id });

    return rows.length
        ? { ok: true }
        : {
              ok: false,
              error: 'NOT_FOUND',
              message: 'Notifikasi tidak ditemukan.',
          };
}

export async function markAllNotificationsRead(
    actor: Actor,
): Promise<ActionResult> {
    await getDb()
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(
            and(
                eq(notifications.userId, actor.userId),
                eq(notifications.isRead, false),
            ),
        );

    return { ok: true };
}

export async function deleteNotification(
    actor: Actor,
    id: string,
): Promise<ActionResult> {
    const rows = await getDb()
        .delete(notifications)
        .where(
            and(
                eq(notifications.id, id),
                eq(notifications.userId, actor.userId),
            ),
        )
        .returning({ id: notifications.id });

    return rows.length
        ? { ok: true }
        : {
              ok: false,
              error: 'NOT_FOUND',
              message: 'Notifikasi tidak ditemukan.',
          };
}

/* ── koreksi wilayah ───────────────────────────────────────────────────── */

export type ReassignResult =
    | { ok: true; puskesmasId: string }
    | {
          ok: false;
          error: 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'NO_MATCH';
          message: string;
      };

/**
 * When an operator names the puskesmas a stuck report belongs to, that
 * puskesmas gains coverage of the kelurahan — stored coverage, then the same
 * auto-assign the report should have had at submission. The assignment stays a
 * consequence of stored coverage, so re-running the sweep later agrees, instead
 * of being a one-off override nothing else knows about.
 */
export async function reassignReport(
    actor: Actor,
    reportId: string,
    puskesmasId: string,
): Promise<ReassignResult> {
    if (!['ADMIN', 'DINKES'].includes(actor.role)) {
        return { ok: false, error: 'FORBIDDEN', message: 'Tidak berwenang.' };
    }

    const db = getDb();

    if (puskesmasId) {
        const [target] = await db
            .select({
                id: institutions.id,
                kelurahanList: institutions.kelurahanList,
            })
            .from(institutions)
            .where(
                and(
                    eq(institutions.id, puskesmasId),
                    eq(institutions.type, 'PUSKESMAS'),
                ),
            )
            .limit(1);

        if (!target) {
            return {
                ok: false,
                error: 'NOT_FOUND',
                message: 'Puskesmas tidak ditemukan.',
            };
        }

        const [report] = await db.execute<{ kelurahan: string | null }>(sql`
            select kelurahan from reports_rs where id = ${reportId}::uuid limit 1
        `);

        if (!report) {
            return {
                ok: false,
                error: 'NOT_FOUND',
                message: 'Laporan tidak ditemukan.',
            };
        }

        // A manual reassignment only makes sense on a report that is still
        // unassigned; checking here, before the coverage edit, keeps the
        // conflict from leaving a stored side effect behind.
        const [state] = await db
            .select({ status: reportsRS.status })
            .from(reportsRS)
            .where(eq(reportsRS.id, reportId))
            .limit(1);
        if (state && state.status !== 'SUBMITTED') {
            return {
                ok: false,
                error: 'CONFLICT',
                message: 'Laporan sudah ditugaskan.',
            };
        }

        if (report.kelurahan) {
            const already = (target.kelurahanList ?? []).some(
                (k) => k.toLowerCase() === report.kelurahan!.toLowerCase(),
            );
            if (!already) {
                await db
                    .update(institutions)
                    .set({
                        kelurahanList: [
                            ...(target.kelurahanList ?? []),
                            report.kelurahan,
                        ],
                    })
                    .where(eq(institutions.id, puskesmasId));
            }
        }
    }

    const result = await assignReportByKelurahan(reportId);

    if (result.assigned) {
        return { ok: true, puskesmasId: result.puskesmasId };
    }

    return {
        ok: false,
        error: result.reason === 'NO_MATCH' ? 'NO_MATCH' : 'CONFLICT',
        message:
            result.reason === 'NOT_FOUND'
                ? 'Laporan tidak ditemukan.'
                : result.reason === 'NO_OFFICER'
                  ? 'Puskesmas ditemukan tetapi belum punya petugas aktif.'
                  : result.reason === 'ALREADY_ASSIGNED'
                    ? 'Laporan sudah ditugaskan.'
                    : 'Tidak ada puskesmas aktif yang mencakup kelurahan ini.',
    };
}

/* ── verifikasi PE ─────────────────────────────────────────────────────── */

/**
 * The verification queue's two decisions are the report state machine's own
 * transitions, re-checked by it — so the queue cannot grant a transition the
 * actor's role or the report's current state does not allow.
 */
export async function decideVerification(
    actor: Actor,
    reportId: string,
    decision: 'VERIFY' | 'REJECT_BY_DINKES',
    note?: string,
): Promise<ActionResult<'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT'>> {
    const result = await transitionReport(actor, reportId, decision, note);

    if (result.ok) return { ok: true };

    return {
        ok: false,
        error:
            result.reason === 'NOT_FOUND'
                ? 'NOT_FOUND'
                : result.reason === 'FORBIDDEN'
                  ? 'FORBIDDEN'
                  : 'CONFLICT',
        message:
            result.reason === 'NOT_FOUND'
                ? 'Laporan tidak ditemukan.'
                : result.reason === 'FORBIDDEN'
                  ? 'Tidak berwenang.'
                  : 'Status laporan sudah berubah. Muat ulang halaman.',
    };
}

/* ── audit log ─────────────────────────────────────────────────────────── */

/**
 * The trail must outlive the data it describes, so nothing here deletes a row.
 * Retention erases the *content* (changes, IP, agent) of entries older than the
 * cutoff and leaves the who/what/when, which is what an audit answers.
 */
export async function purgeAuditLogs(
    actor: Actor,
    olderThanDays: number,
): Promise<ActionResult> {
    if (actor.role !== 'ADMIN') {
        return { ok: false, error: 'FORBIDDEN', message: 'Hanya admin.' };
    }

    const days = Math.min(3650, Math.max(1, Math.floor(olderThanDays)));
    const db = getDb();
    const result = await db.execute(sql`
        update audit_logs
        set changes = null, ip_address = null, user_agent = null
        where created_at < now() - make_interval(days => ${days})
    `);
    // The purge destroys the detail of other audit rows, so it must leave a
    // row of its own — otherwise the one operation that erases evidence is
    // the one nobody can see.
    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: actor.userId,
        changes: {
            auditPurgeOlderThanDays: { from: null, to: days },
            auditRowsErased: { from: null, to: Number(result.count ?? 0) },
        },
    });

    return { ok: true };
}

/* ── pengaturan ────────────────────────────────────────────────────────── */

export type SettingInput = {
    id?: string;
    key: string;
    value: string;
    type: string;
    category?: string;
    description?: string;
    isPublic: boolean;
};

export async function saveSetting(
    actor: Actor,
    input: SettingInput,
): Promise<ActionResult<'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT'>> {
    if (actor.role !== 'ADMIN') {
        return { ok: false, error: 'FORBIDDEN', message: 'Hanya admin.' };
    }

    const db = getDb();
    const values = {
        key: input.key,
        value: input.value,
        type: input.type,
        category: input.category || null,
        description: input.description || null,
        isPublic: input.isPublic,
    };

    try {
        if (input.id) {
            const rows = await db
                .update(systemSettings)
                .set(values)
                .where(eq(systemSettings.id, input.id))
                .returning({ id: systemSettings.id });

            return rows.length
                ? { ok: true }
                : {
                      ok: false,
                      error: 'NOT_FOUND',
                      message: 'Pengaturan tidak ditemukan.',
                  };
        }

        await db.insert(systemSettings).values(values);
        return { ok: true };
    } catch (error) {
        if (
            typeof error === 'object' &&
            error !== null &&
            (error as { code?: string }).code === '23505'
        ) {
            return {
                ok: false,
                error: 'CONFLICT',
                message: 'Kunci pengaturan sudah dipakai.',
            };
        }
        throw error;
    }
}

export async function deleteSetting(
    actor: Actor,
    id: string,
): Promise<ActionResult> {
    if (actor.role !== 'ADMIN') {
        return { ok: false, error: 'FORBIDDEN', message: 'Hanya admin.' };
    }

    const rows = await getDb()
        .delete(systemSettings)
        .where(eq(systemSettings.id, id))
        .returning({ id: systemSettings.id });

    return rows.length
        ? { ok: true }
        : {
              ok: false,
              error: 'NOT_FOUND',
              message: 'Pengaturan tidak ditemukan.',
          };
}

/* ── pesan ─────────────────────────────────────────────────────────────── */

export type ConversationRow = {
    id: string;
    title: string;
    lastMessage: string | null;
    lastAt: Date | null;
    unread: number;
};

/**
 * The inbox a person actually has: conversations they belong to, newest
 * activity first, with the count of messages addressed to them that they have
 * not opened. Paged in SQL — a user with years of threads should not download
 * all of them to see ten.
 */
export async function listConversations(
    actor: Actor,
    page = 1,
    perPage = 25,
): Promise<{
    rows: ConversationRow[];
    page: number;
    perPage: number;
    total: number;
}> {
    const db = getDb();
    const size = Math.min(50, Math.max(1, perPage));
    const current = Math.max(1, Math.floor(page));
    const offset = (current - 1) * size;

    const rows = await db.execute<{
        id: string;
        title: string | null;
        last_message: string | null;
        last_at: Date | string | null;
        unread: string | number;
    }>(sql`
        with mine as (
            select c.id, c.name, c.updated_at
            from conversations c
            join conversation_users cu on cu.conversation_id = c.id
            where cu.user_id = ${actor.userId}::uuid
        ), last as (
            select m.conversation_id, m.content, m.created_at,
                   row_number() over (
                       partition by m.conversation_id order by m.created_at desc
                   ) as rn
            from messages m
            join mine on mine.id = m.conversation_id
        )
        select mine.id,
               coalesce(
                   mine.name,
                   (
                       select string_agg(u.name, ', ' order by u.name)
                       from conversation_users cu2
                       join users u on u.id = cu2.user_id
                       where cu2.conversation_id = mine.id
                         and u.id <> ${actor.userId}::uuid
                   )
               ) as title,
               last.content as last_message,
               coalesce(last.created_at, mine.updated_at) as last_at,
               (
                   select count(*) from messages m2
                   where m2.conversation_id = mine.id
                     and m2.sender_id <> ${actor.userId}::uuid
                     and m2.is_read = false
               ) as unread
        from mine
        left join last on last.conversation_id = mine.id and last.rn = 1
        order by coalesce(last.created_at, mine.updated_at) desc
        limit ${size} offset ${offset}
    `);

    const [totals] = await db
        .select({ n: count() })
        .from(conversationUsers)
        .where(eq(conversationUsers.userId, actor.userId));

    return {
        rows: rows.map((r) => ({
            id: r.id,
            title: r.title ?? 'Percakapan',
            lastMessage: r.last_message,
            lastAt: r.last_at ? new Date(r.last_at) : null,
            unread: Number(r.unread),
        })),
        page: current,
        perPage: size,
        total: Number(totals?.n ?? 0),
    };
}

/** Everyone the current user may open a thread with: active colleagues. */
export async function messagePeers(actor: Actor) {
    return getDb()
        .select({ id: users.id, name: users.name, role: users.role })
        .from(users)
        .where(
            and(
                eq(users.isActive, true),
                sql`${users.id} <> ${actor.userId}::uuid`,
                actor.institutionId
                    ? sql`(${users.institutionId} = ${actor.institutionId}::uuid or ${users.institutionId} is null)`
                    : sql`true`,
            ),
        )
        .orderBy(users.name)
        .limit(200);
}

export async function createConversation(
    actor: Actor,
    peerId: string,
    body: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
    if (!peerId || peerId === actor.userId) {
        return { ok: false, message: 'Pilih lawan bicara.' };
    }
    const text = body.trim();
    if (!text) return { ok: false, message: 'Pesan tidak boleh kosong.' };
    if (text.length > 4000)
        return { ok: false, message: 'Pesan terlalu panjang.' };

    const db = getDb();

    // The peer must be a real, active account the caller is allowed to reach —
    // otherwise a crafted POST could open a thread with any uuid it guessed.
    // Asked of the database by id, not of the picker's list: that list is
    // capped, and a capped list is not an authorization set.
    const [peer] = await db
        .select({ id: users.id })
        .from(users)
        .where(
            and(
                eq(users.id, peerId),
                eq(users.isActive, true),
                actor.institutionId
                    ? sql`(${users.institutionId} = ${actor.institutionId}::uuid or ${users.institutionId} is null)`
                    : sql`true`,
            ),
        )
        .limit(1);
    if (!peer) {
        return { ok: false, message: 'Lawan bicara tidak tersedia.' };
    }

    const id = await db.transaction(async (tx) => {
        const [conversation] = await tx
            .insert(conversations)
            .values({ type: 'DIRECT' })
            .returning({ id: conversations.id });

        await tx.insert(conversationUsers).values([
            { conversationId: conversation.id, userId: actor.userId },
            { conversationId: conversation.id, userId: peerId },
        ]);

        await tx.insert(messages).values({
            conversationId: conversation.id,
            senderId: actor.userId,
            content: text,
        });

        return conversation.id;
    });

    return { ok: true, id };
}

/** Members may remove their own view of a thread; it is not a global delete. */
export async function deleteConversation(
    actor: Actor,
    id: string,
): Promise<ActionResult> {
    const rows = await getDb()
        .delete(conversationUsers)
        .where(
            and(
                eq(conversationUsers.conversationId, id),
                eq(conversationUsers.userId, actor.userId),
            ),
        )
        .returning({ id: conversationUsers.id });

    return rows.length
        ? { ok: true }
        : {
              ok: false,
              error: 'NOT_FOUND',
              message: 'Percakapan tidak ditemukan.',
          };
}

/** Only a member may read a thread; the join enforces that, not the caller. */
export async function canReadConversation(actor: Actor, id: string) {
    const [row] = await getDb()
        .select({ id: conversationUsers.id })
        .from(conversationUsers)
        .where(
            and(
                eq(conversationUsers.conversationId, id),
                eq(conversationUsers.userId, actor.userId),
            ),
        )
        .limit(1);
    return Boolean(row);
}

export async function listThreadMessages(
    actor: Actor,
    conversationId: string,
    page = 1,
    perPage = 50,
) {
    const db = getDb();
    const size = Math.min(100, Math.max(1, perPage));
    const current = Math.max(1, Math.floor(page));
    const offset = (current - 1) * size;

    const rows = await db.execute<{
        id: string;
        sender_name: string;
        content: string;
        created_at: Date | string;
        mine: boolean;
    }>(sql`
        select m.id, u.name as sender_name, m.content, m.created_at,
               (m.sender_id = ${actor.userId}::uuid) as mine
        from messages m
        join users u on u.id = m.sender_id
        join conversation_users cu on cu.conversation_id = m.conversation_id
        where m.conversation_id = ${conversationId}::uuid
          and cu.user_id = ${actor.userId}::uuid
        order by m.created_at
        limit ${size} offset ${offset}
    `);

    const [totals] = await db.execute<{ n: string }>(sql`
        select count(*) as n
        from messages m
        join conversation_users cu on cu.conversation_id = m.conversation_id
        where m.conversation_id = ${conversationId}::uuid
          and cu.user_id = ${actor.userId}::uuid
    `);

    // Only what the reader was actually shown. Reading one page of a long
    // thread used to mark the other pages read too, so the inbox badge went to
    // zero for messages nobody had opened.
    // A page past the end, or an empty thread, would build `in ()` below and
    // Postgres rejects that: nothing to mark, so nothing to run.
    if (rows.length > 0) {
        await db.execute(sql`
            update messages set is_read = true, read_at = now()
            where conversation_id = ${conversationId}::uuid
              and sender_id <> ${actor.userId}::uuid
              and is_read = false
              and id in (${sql.join(
                  rows.map((r) => sql`${r.id}::uuid`),
                  sql`, `,
              )})
        `);
    }

    return {
        rows: rows.map((r) => ({
            id: r.id,
            senderName: r.sender_name,
            content: r.content,
            createdAt: new Date(r.created_at),
            mine: r.mine,
        })),
        page: current,
        perPage: size,
        total: Number(totals?.n ?? 0),
    };
}

export async function sendMessage(
    actor: Actor,
    conversationId: string,
    content: string,
): Promise<ActionResult> {
    const text = content.trim();
    if (!text)
        return { ok: false, error: 'NOT_FOUND', message: 'Pesan kosong.' };
    if (text.length > 4000) {
        return {
            ok: false,
            error: 'NOT_FOUND',
            message: 'Pesan terlalu panjang.',
        };
    }

    // A membership check, not a guess: a non-member's insert is refused here.
    if (!(await canReadConversation(actor, conversationId))) {
        return {
            ok: false,
            error: 'NOT_FOUND',
            message: 'Percakapan tidak ditemukan.',
        };
    }

    await getDb().insert(messages).values({
        conversationId,
        senderId: actor.userId,
        content: text,
    });

    return { ok: true };
}
