'use server';

import { revalidatePath } from 'next/cache';
import { requireActor } from '@/lib/session';
import {
    deleteConversation,
    deleteNotification,
    deleteSetting,
    markAllNotificationsRead,
    purgeAuditLogs,
    reassignReport,
    saveSetting,
    sendMessage,
    createConversation,
    setNotificationRead,
    decideVerification,
} from '@/lib/domain/actions';

/**
 * Server actions for the surfaces that gained writes. Each re-reads the actor:
 * the page that rendered the control already required a role, but an action is
 * a public POST endpoint and the domain modules re-check anyway.
 *
 * Return shape is uniform (`{ ok } | { ok: false, error }`) so one small client
 * helper can toast any of them.
 */

export type ActionState = { ok: boolean; error?: string };

async function guard(): Promise<ActionState | null> {
    try {
        await requireActor();
        return null;
    } catch {
        return { ok: false, error: 'Sesi berakhir. Masuk ulang.' };
    }
}

function fail(message: string): ActionState {
    return { ok: false, error: message };
}

/* ── notifikasi ────────────────────────────────────────────────────────── */

export async function toggleNotificationAction(
    id: string,
    isRead: boolean,
): Promise<ActionState> {
    const denied = await guard();
    if (denied) return denied;

    const actor = await requireActor();
    const result = await setNotificationRead(actor, id, isRead);
    if (!result.ok) return fail(result.message);

    revalidatePath('/notifikasi');
    return { ok: true };
}

export async function markAllReadAction(): Promise<ActionState> {
    const denied = await guard();
    if (denied) return denied;

    const actor = await requireActor();
    const result = await markAllNotificationsRead(actor);
    if (!result.ok) return fail(result.message);

    revalidatePath('/notifikasi');
    return { ok: true };
}

export async function deleteNotificationAction(
    id: string,
): Promise<ActionState> {
    const denied = await guard();
    if (denied) return denied;

    const actor = await requireActor();
    const result = await deleteNotification(actor, id);
    if (!result.ok) return fail(result.message);

    revalidatePath('/notifikasi');
    return { ok: true };
}

/* ── koreksi wilayah ───────────────────────────────────────────────────── */

export async function reassignReportAction(
    reportId: string,
    puskesmasId: string,
): Promise<ActionState> {
    const denied = await guard();
    if (denied) return denied;

    const actor = await requireActor();
    const result = await reassignReport(actor, reportId, puskesmasId);
    if (!result.ok) return fail(result.message);

    revalidatePath('/admin/koreksi-wilayah');
    revalidatePath('/laporan');
    return { ok: true };
}

/* ── verifikasi PE ─────────────────────────────────────────────────────── */

export async function decideVerificationAction(input: {
    id: string;
    decision: 'VERIFY' | 'REJECT_BY_DINKES';
    note?: string;
}): Promise<ActionState> {
    const denied = await guard();
    if (denied) return denied;

    const actor = await requireActor();
    const result = await decideVerification(
        actor,
        input.id,
        input.decision,
        input.note,
    );
    if (!result.ok) return fail(result.message);

    // Every screen that lists the report by state: the queue it left, the PE
    // list it now shows in, and the dashboards that count it.
    revalidatePath('/pe/verifikasi');
    revalidatePath('/laporan');
    revalidatePath('/laporan/perlu-action');
    revalidatePath('/pe');
    revalidatePath('/pe/tugas');
    revalidatePath('/dasbor');
    return { ok: true };
}

/* ── audit log ─────────────────────────────────────────────────────────── */

export async function purgeAuditLogsAction(days: number): Promise<ActionState> {
    const denied = await guard();
    if (denied) return denied;

    const actor = await requireActor();
    const result = await purgeAuditLogs(actor, days);
    if (!result.ok) return fail(result.message);

    // No revalidate for the log itself: retention blanks the detail columns,
    // which the list never renders, so a refresh would show nothing changed.
    return { ok: true };
}

/* ── pengaturan ────────────────────────────────────────────────────────── */

export async function saveSettingAction(
    _prev: ActionState,
    formData: FormData,
): Promise<ActionState> {
    const denied = await guard();
    if (denied) return denied;

    const value = (name: string) => String(formData.get(name) ?? '').trim();
    const key = value('key');

    if (!/^[a-z0-9_.]+$/i.test(key)) {
        return fail('Kunci hanya huruf, angka, titik, dan garis bawah.');
    }

    const actor = await requireActor();
    const result = await saveSetting(actor, {
        id: value('id') || undefined,
        key,
        value: value('value'),
        type: value('type') || 'string',
        category: value('category') || undefined,
        description: value('description') || undefined,
        isPublic: formData.get('isPublic') === 'on',
    });

    if (!result.ok) return fail(result.message);

    revalidatePath('/pengaturan');
    return { ok: true };
}

export async function deleteSettingAction(id: string): Promise<ActionState> {
    const denied = await guard();
    if (denied) return denied;

    const actor = await requireActor();
    const result = await deleteSetting(actor, id);
    if (!result.ok) return fail(result.message);

    revalidatePath('/pengaturan');
    return { ok: true };
}

/* ── pesan ─────────────────────────────────────────────────────────────── */

export async function startConversationAction(input: {
    peerId: string;
    body: string;
}): Promise<ActionState & { id?: string }> {
    const denied = await guard();
    if (denied) return denied;

    const actor = await requireActor();
    const result = await createConversation(actor, input.peerId, input.body);
    if (!result.ok) return fail(result.message);

    revalidatePath('/pesan');
    return { ok: true, id: result.id };
}

export async function sendMessageAction(input: {
    conversationId: string;
    content: string;
}): Promise<ActionState> {
    const denied = await guard();
    if (denied) return denied;

    const actor = await requireActor();
    const result = await sendMessage(
        actor,
        input.conversationId,
        input.content,
    );
    if (!result.ok) return fail(result.message);

    revalidatePath(`/pesan/${input.conversationId}`);
    revalidatePath('/pesan');
    return { ok: true };
}

export async function deleteConversationAction(
    id: string,
): Promise<ActionState> {
    const denied = await guard();
    if (denied) return denied;

    const actor = await requireActor();
    const result = await deleteConversation(actor, id);
    if (!result.ok) return fail(result.message);

    revalidatePath('/pesan');
    return { ok: true };
}
