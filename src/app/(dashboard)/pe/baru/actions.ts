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
    // Households arrive as one JSON field from the client list; it is parsed and
    // validated here, never trusted as already-shaped.
    let households: unknown = [];
    try {
        households = JSON.parse(String(formData.get('households') ?? '[]'));
    } catch {
        return { fieldErrors: { households: 'Data rumah tidak valid.' } };
    }

    const parsed = createPeSchema.safeParse({
        ...Object.fromEntries(formData),
        households,
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
    revalidatePath('/dasbor');

    return { ok: true };
}
