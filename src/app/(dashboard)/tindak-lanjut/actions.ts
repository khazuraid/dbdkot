'use server';

import { revalidatePath } from 'next/cache';
import { requireActor } from '@/lib/session';
import { executeFoggingCycle } from '@/lib/domain/fogging';
import { foggingCycleSchema } from '@/lib/domain/form-contracts';

export async function executeFoggingAction(raw: {
    reportRSId: string;
    cycleNumber: 1 | 2;
    abateUsedKg: number;
    insecticideUsedLiter: number;
    foggerMachinesCount: number;
    materialCost: number;
    honorCost: number;
    maintenanceCost: number;
    notes?: string;
}) {
    const parsed = foggingCycleSchema.safeParse(raw);
    if (!parsed.success) {
        return {
            ok: false as const,
            error: parsed.error.issues[0]?.message ?? 'Input tidak valid.',
        };
    }

    const actor = await requireActor();
    const res = await executeFoggingCycle(actor, parsed.data);
    if (!res.ok) return res;

    revalidatePath('/tindak-lanjut');
    revalidatePath('/logistik');
    revalidatePath('/aset');
    revalidatePath(`/laporan/${parsed.data.reportRSId}`);
    revalidatePath('/laporan');
    revalidatePath('/dasbor');

    return res;
}
