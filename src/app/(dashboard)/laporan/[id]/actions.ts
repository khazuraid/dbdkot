'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireActor } from '@/lib/session';
import { transitionReport, type Transition } from '@/lib/domain/report-detail';

const inputSchema = z.object({
    id: z.uuid(),
    transition: z.enum(['ACCEPT', 'REJECT', 'VERIFY', 'REJECT_BY_DINKES']),
});

export async function reportAction(id: string, transition: Transition) {
    // Server Actions are an HTTP endpoint: the arguments are client input and
    // must be validated here, not assumed from the button that called them.
    const parsed = inputSchema.safeParse({ id, transition });
    if (!parsed.success) {
        return { ok: false as const, error: 'Permintaan tidak valid.' };
    }

    const actor = await requireActor();
    const result = await transitionReport(
        actor,
        parsed.data.id,
        parsed.data.transition,
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
