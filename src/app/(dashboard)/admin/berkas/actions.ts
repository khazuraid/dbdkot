'use server';

import { revalidatePath } from 'next/cache';
import { requireActor } from '@/lib/session';
import { deleteUploadedFile } from '@/lib/domain/attachments';

export type ActionState = { ok: boolean; error?: string };

export async function deleteAttachmentAction(id: string): Promise<ActionState> {
    const actor = await requireActor().catch(() => null);
    if (!actor) {
        return { ok: false, error: 'Sesi berakhir. Masuk ulang.' };
    }
    if (actor.role !== 'ADMIN') {
        return {
            ok: false,
            error: 'Akses ditolak. Hanya administrator yang dapat menghapus berkas.',
        };
    }

    const res = await deleteUploadedFile(actor, id);
    if (!res.ok) {
        return { ok: false, error: res.message };
    }

    revalidatePath('/admin/berkas');
    revalidatePath('/admin');
    return { ok: true };
}
