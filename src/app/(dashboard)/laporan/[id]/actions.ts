'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireActor } from '@/lib/session';
import {
    deleteDraftReport,
    submitDraftReport,
    transitionReport,
    updateDraftReport,
    type Transition,
} from '@/lib/domain/report-detail';
import { createReportSchema } from '@/lib/domain/form-contracts';

const inputSchema = z.object({
    id: z.uuid(),
    transition: z.enum([
        'ACCEPT',
        'START_PE',
        'REJECT',
        'VERIFY',
        'REJECT_BY_DINKES',
        'MARK_CLOSED',
    ]),
    note: z.string().trim().max(1000).optional(),
});

export async function reportAction(
    id: string,
    transition: Transition,
    note?: string,
) {
    const parsed = inputSchema.safeParse({ id, transition, note });
    if (!parsed.success) {
        return { ok: false as const, error: 'Permintaan tidak valid.' };
    }

    const actor = await requireActor();
    const result = await transitionReport(
        actor,
        parsed.data.id,
        parsed.data.transition,
        parsed.data.note,
    );

    if (result.ok) {
        revalidatePath(`/laporan/${parsed.data.id}`);
        revalidatePath('/laporan');
        revalidatePath('/laporan/perlu-action');
        revalidatePath('/dasbor');
        revalidatePath('/pe');
        revalidatePath('/pe/verifikasi');
    }

    return result;
}

export async function deleteDraftReportAction(id: string) {
    const actor = await requireActor();
    const result = await deleteDraftReport(actor, id);

    if (result.ok) {
        revalidatePath('/laporan');
        revalidatePath('/dasbor');
    }

    return result;
}

export async function submitDraftReportAction(id: string) {
    const actor = await requireActor();
    const result = await submitDraftReport(actor, id);

    if (result.ok) {
        revalidatePath(`/laporan/${id}`);
        revalidatePath('/laporan');
        revalidatePath('/laporan/perlu-action');
        revalidatePath('/dasbor');
    }

    return result;
}

export async function updateDraftReportAction(id: string, formData: FormData) {
    const actor = await requireActor();
    const entries = Object.fromEntries(formData);
    const parsed = createReportSchema.partial().safeParse(entries);

    if (!parsed.success) {
        const error = parsed.error.issues[0]?.message ?? 'Data tidak valid';
        return { ok: false as const, error };
    }

    const result = await updateDraftReport(actor, id, parsed.data);

    if (result.ok) {
        revalidatePath(`/laporan/${id}`);
        revalidatePath('/laporan');
    }

    return result;
}
