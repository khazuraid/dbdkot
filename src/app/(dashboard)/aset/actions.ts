'use server';

import { revalidatePath } from 'next/cache';
import { requireActor } from '@/lib/session';
import { assetSchema, idSchema } from '@/lib/domain/form-contracts';
import { createAsset, deleteAsset, updateAsset } from '@/lib/domain/master';

export type FormState = {
    ok: boolean;
    error?: string;
    fields?: Record<string, string>;
};

async function guard(): Promise<string | null> {
    try {
        await requireActor();
        return null;
    } catch {
        return 'Sesi berakhir. Masuk ulang.';
    }
}

export async function saveAssetAction(
    _state: FormState,
    formData: FormData,
): Promise<FormState> {
    const denied = await guard();
    if (denied) return { ok: false, error: denied };

    const parsed = assetSchema.safeParse(
        Object.fromEntries(formData.entries()),
    );
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
        ? await updateAsset(actor, id, input)
        : await createAsset(actor, input);

    if (!result.ok) return { ok: false, error: result.message };
    revalidatePath('/aset');
    return { ok: true };
}

export async function deleteAssetAction(id: string): Promise<FormState> {
    const denied = await guard();
    if (denied) return { ok: false, error: denied };

    const parsed = idSchema.safeParse(id);
    if (!parsed.success) return { ok: false, error: 'ID tidak valid.' };

    const actor = await requireActor();
    const result = await deleteAsset(actor, parsed.data);
    if (!result.ok) return { ok: false, error: result.message };

    revalidatePath('/aset');
    return { ok: true };
}
