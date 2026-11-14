'use server';

import { revalidatePath } from 'next/cache';
import { requireActor } from '@/lib/session';
import { createPe, createPeSchema } from '@/lib/domain/pe';

export type PeFormState = {
    error?: string;
    fieldErrors?: Record<string, string>;
    ok?: boolean;
};

export async function submitPe(
    _prev: PeFormState,
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
    const parsed = createPeSchema.safeParse({
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
    const result = await createPe(actor, parsed.data);

    if (!result.ok) return { error: result.error };

    revalidatePath('/pe');
    revalidatePath('/laporan');
    revalidatePath(`/laporan/${parsed.data.reportRSId}`);
    revalidatePath('/dasbor');

    return { ok: true };
}
