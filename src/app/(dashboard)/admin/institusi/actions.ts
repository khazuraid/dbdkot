'use server';

import { revalidatePath } from 'next/cache';
import { requireActor } from '@/lib/session';
import { idSchema, institutionSchema } from '@/lib/domain/form-contracts';
import {
    createInstitution,
    deleteInstitution,
    updateInstitution,
} from '@/lib/domain/master';

export type FormState = {
    ok: boolean;
    error?: string;
    /** Field-level messages keyed by input name, for inline errors. */
    fields?: Record<string, string>;
};

/**
 * A server action is a public POST endpoint: the role check on the page that
 * rendered the form is decoration. The actor is re-read here and the domain
 * module checks it again.
 */
function read(formData: FormData) {
    return Object.fromEntries(formData.entries());
}

async function guard(): Promise<string | null> {
    try {
        await requireActor();
        return null;
    } catch {
        return 'Sesi berakhir. Masuk ulang.';
    }
}

export async function saveInstitutionAction(
    _state: FormState,
    formData: FormData,
): Promise<FormState> {
    const denied = await guard();
    if (denied) return { ok: false, error: denied };

    const raw = read(formData);
    const parsed = institutionSchema.safeParse(raw);
    if (!parsed.success) {
        const fields: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
            const key = String(issue.path[0] ?? '');
            if (key && !fields[key]) fields[key] = issue.message;
        }
        return { ok: false, fields, error: 'Periksa isian yang ditandai.' };
    }

    const actor = await requireActor();
    const { id, ...input } = parsed.data;
    const result = id
        ? await updateInstitution(actor, id, input)
        : await createInstitution(actor, input);

    if (!result.ok) return { ok: false, error: result.message };

    revalidatePath('/admin/institusi');
    revalidatePath('/admin/pengguna');
    return { ok: true };
}

export async function deleteInstitutionAction(id: string): Promise<FormState> {
    const denied = await guard();
    if (denied) return { ok: false, error: denied };

    const parsed = idSchema.safeParse(id);
    if (!parsed.success) return { ok: false, error: 'ID tidak valid.' };

    const actor = await requireActor();
    const result = await deleteInstitution(actor, parsed.data);
    if (!result.ok) return { ok: false, error: result.message };

    revalidatePath('/admin/institusi');
    return { ok: true };
}
