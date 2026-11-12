'use server';

import { revalidatePath } from 'next/cache';
import { requireActor } from '@/lib/session';
import { createReport, createReportSchema } from '@/lib/domain/report-create';

export type FormState = {
    error?: string;
    fieldErrors?: Record<string, string>;
    ok?: boolean;
};

export async function submitReport(
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    const parsed = createReportSchema.safeParse(Object.fromEntries(formData));

    if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
            const key = String(issue.path[0] ?? 'form');
            fieldErrors[key] ??= issue.message;
        }
        return { fieldErrors };
    }

    const actor = await requireActor();
    const result = await createReport(actor, parsed.data);

    if (!result.ok) {
        return { error: result.error };
    }

    revalidatePath('/laporan');
    revalidatePath('/dasbor');

    return { ok: true };
}
