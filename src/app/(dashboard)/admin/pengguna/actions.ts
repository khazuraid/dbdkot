'use server';

import { revalidatePath } from 'next/cache';
import { requireActor } from '@/lib/session';
import {
    approveAccount,
    createAccount,
    createAccountSchema,
    rejectAccount,
    setAccountActive,
    updateAccount,
    updateAccountSchema,
} from '@/lib/domain/accounts';
import type { Role } from '@/lib/roles';

export type ActionState = { ok: boolean; error?: string; message?: string };

/**
 * Every action re-reads the actor from the session: a server function is a
 * public POST endpoint, so the guard on the page that rendered the form is
 * decoration, not authorisation.
 */
async function actorOrError() {
    try {
        return { actor: await requireActor() };
    } catch {
        return { error: 'Sesi berakhir. Masuk ulang.' };
    }
}

export async function approveAccountAction(
    _state: ActionState,
    formData: FormData,
): Promise<ActionState> {
    const { actor, error } = await actorOrError();
    if (!actor) return { ok: false, error };

    const userId = String(formData.get('userId') ?? '');
    const role = String(formData.get('role') ?? '') as Role;
    const institutionId = String(formData.get('institutionId') ?? '') || null;

    const result = await approveAccount(actor, userId, role, institutionId);
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath('/admin/pengguna');
    return { ok: true, message: 'Akun disetujui.' };
}

export async function rejectAccountAction(
    _state: ActionState,
    formData: FormData,
): Promise<ActionState> {
    const { actor, error } = await actorOrError();
    if (!actor) return { ok: false, error };

    const result = await rejectAccount(
        actor,
        String(formData.get('userId') ?? ''),
    );
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath('/admin/pengguna');
    return { ok: true, message: 'Pendaftaran ditolak.' };
}

export async function setAccountActiveAction(
    _state: ActionState,
    formData: FormData,
): Promise<ActionState> {
    const { actor, error } = await actorOrError();
    if (!actor) return { ok: false, error };

    const result = await setAccountActive(
        actor,
        String(formData.get('userId') ?? ''),
        formData.get('isActive') === 'true',
    );
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath('/admin/pengguna');
    return { ok: true, message: 'Status akun diperbarui.' };
}

export async function createAccountAction(
    _state: ActionState,
    formData: FormData,
): Promise<ActionState> {
    const { actor, error } = await actorOrError();
    if (!actor) return { ok: false, error };

    const parsed = createAccountSchema.safeParse({
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
        role: formData.get('role'),
        institutionId: formData.get('institutionId') || undefined,
    });

    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? 'Data belum lengkap.',
        };
    }

    const result = await createAccount(actor, parsed.data);
    if (!result.ok) return { ok: false, error: result.error };

    // The account exists from here on, so the caller is sent back to the list
    // rather than the form; there is nothing else to do on this screen.
    revalidatePath('/admin/pengguna');
    return { ok: true, message: 'Akun dibuat dan langsung aktif.' };
}

export async function updateAccountAction(
    _state: ActionState,
    formData: FormData,
): Promise<ActionState> {
    const { actor, error } = await actorOrError();
    if (!actor) return { ok: false, error };

    const parsed = updateAccountSchema.safeParse({
        userId: formData.get('userId'),
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password') || undefined,
        role: formData.get('role') || undefined,
        institutionId: formData.get('institutionId') || undefined,
    });

    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? 'Data belum lengkap.',
        };
    }

    const result = await updateAccount(actor, parsed.data);
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath('/admin/pengguna');
    return { ok: true, message: 'Perubahan akun disimpan.' };
}
