'use server';

import { revalidatePath } from 'next/cache';
import { requireActor } from '@/lib/session';
import { deletePe, updatePe, createPeSchema } from '@/lib/domain/pe';
import type { PeFormState } from './baru/actions';

export async function deletePeAction(peId: string): Promise<{ ok: boolean; error?: string }> {
    const actor = await requireActor();
    const result = await deletePe(actor, peId);

    if (result.ok) {
        revalidatePath('/pe');
        revalidatePath('/laporan');
        revalidatePath('/dasbor');
        revalidatePath('/pe/verifikasi');
        return { ok: true };
    }

    return { ok: false, error: result.error };
}

export async function updatePeAction(
    peId: string,
    formData: FormData,
): Promise<PeFormState> {
    let households: unknown = [];
    let clinicalSymptoms: unknown = [];
    try {
        households = JSON.parse(String(formData.get('households') ?? '[]'));
    } catch {
        return { fieldErrors: { households: 'Data rumah tidak valid.' } };
    }
    try {
        clinicalSymptoms = JSON.parse(
            String(formData.get('clinicalSymptoms') ?? '[]'),
        );
    } catch {
        clinicalSymptoms = [];
    }

    const raw = Object.fromEntries(formData);
    const parsed = createPeSchema.partial().safeParse({
        ...raw,
        households,
        clinicalSymptoms,
        hasOtherDenguePatients:
            formData.get('hasOtherDenguePatients') === 'true',
    });

    if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
            const key = String(issue.path[0] ?? 'form');
            fieldErrors[key] ??= issue.message;
        }
        return { fieldErrors };
    }

    const actor = await requireActor();
    const result = await updatePe(actor, peId, parsed.data);

    if (!result.ok) return { error: result.error };

    revalidatePath('/pe');
    revalidatePath(`/pe/${peId}`);
    revalidatePath('/laporan');
    if (parsed.data.reportRSId) {
        revalidatePath(`/laporan/${parsed.data.reportRSId}`);
    }
    revalidatePath('/dasbor');

    return { ok: true };
}
