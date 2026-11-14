'use server';

import { revalidatePath } from 'next/cache';
import { requireActor } from '@/lib/session';
import { idSchema, kelurahanSchema } from '@/lib/domain/form-contracts';
import {
    boundaryGeoJsonSchema,
    type BoundaryGeoJson,
} from '@/lib/geo/boundary-schema';
import {
    createKelurahan,
    deleteKelurahan,
    updateKelurahan,
    updateKelurahanBoundary,
} from '@/lib/domain/master';

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

export async function saveKelurahanAction(
    _state: FormState,
    formData: FormData,
): Promise<FormState> {
    const denied = await guard();
    if (denied) return { ok: false, error: denied };

    const parsed = kelurahanSchema.safeParse(
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
        ? await updateKelurahan(actor, id, input)
        : await createKelurahan(actor, input);

    if (!result.ok) return { ok: false, error: result.message };
    revalidatePath('/admin/kelurahan');
    revalidatePath('/laporan/analitik');
    return { ok: true };
}

export async function saveKelurahanBoundaryAction(
    id: string,
    boundary: BoundaryGeoJson | null,
): Promise<FormState> {
    const denied = await guard();
    if (denied) return { ok: false, error: denied };

    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) return { ok: false, error: 'ID kelurahan tidak valid.' };

    let parsedBoundary: BoundaryGeoJson | null = null;
    if (boundary !== null) {
        const checked = boundaryGeoJsonSchema.safeParse(boundary);
        if (!checked.success) {
            return {
                ok: false,
                error:
                    checked.error.issues[0]?.message ??
                    'Data batas wilayah tidak valid.',
            };
        }
        parsedBoundary = checked.data as BoundaryGeoJson;
    }

    const actor = await requireActor();
    const result = await updateKelurahanBoundary(
        actor,
        parsedId.data,
        parsedBoundary,
    );
    if (!result.ok) return { ok: false, error: result.message };

    revalidatePath('/admin/kelurahan');
    revalidatePath('/laporan/analitik');
    return { ok: true };
}

export async function deleteKelurahanAction(id: string): Promise<FormState> {
    const denied = await guard();
    if (denied) return { ok: false, error: denied };

    const parsed = idSchema.safeParse(id);
    if (!parsed.success) return { ok: false, error: 'ID tidak valid.' };

    const actor = await requireActor();
    const result = await deleteKelurahan(actor, parsed.data);
    if (!result.ok) return { ok: false, error: result.message };

    revalidatePath('/admin/kelurahan');
    return { ok: true };
}
