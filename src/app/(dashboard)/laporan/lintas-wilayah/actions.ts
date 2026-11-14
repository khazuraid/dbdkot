'use server';

import { revalidatePath } from 'next/cache';
import { requireActor } from '@/lib/session';
import { disposeCrossBorder } from '@/lib/domain/report-detail';
import { crossBorderDispositionSchema } from '@/lib/domain/form-contracts';

export async function disposeCrossBorderAction(input: {
    reportId: string;
    targetCity: string;
    notes: string;
}) {
    const parsed = crossBorderDispositionSchema.safeParse(input);
    if (!parsed.success) {
        return {
            ok: false as const,
            error: parsed.error.issues[0]?.message ?? 'Data tidak valid.',
        };
    }

    const actor = await requireActor();
    const res = await disposeCrossBorder(
        actor,
        parsed.data.reportId,
        `[${parsed.data.targetCity}] ${parsed.data.notes}`,
    );

    if (!res.ok) {
        return { ok: false as const, error: 'Gagal memproses disposisi.' };
    }

    revalidatePath('/laporan/lintas-wilayah');
    revalidatePath('/laporan');
    revalidatePath(`/laporan/${parsed.data.reportId}`);
    revalidatePath('/dasbor');
    return { ok: true as const };
}
