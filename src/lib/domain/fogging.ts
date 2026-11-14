import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import {
    assets,
    assetTransactions,
    foggingCycles,
    institutions,
    reportsPE,
    reportsRS,
} from '@/db/schema';
import { audit } from '@/lib/audit';
import { enqueueFoggingReminders } from '@/lib/queue';
import { scopeToInstitution, type Actor } from '@/lib/session';
import type { FoggingCycleInput } from './form-contracts';
import { insertNotifications } from './notify';

export type FoggingQueueItem = {
    reportId: string;
    reportNumber: string;
    kelurahan: string | null;
    kecamatan: string | null;
    status: string;
    puskesmasId: string | null;
    puskesmasName: string | null;
    abj: string | null;
    hi: string | null;
    ci: string | null;
    transmissionRisk: string | null;
    cycles: Array<{
        id: string;
        cycleNumber: number;
        status: string;
        scheduledDate: Date;
        executedAt: Date | null;
        abateUsedKg: string;
        insecticideUsedLiter: string;
        totalBudget: number;
        notes: string | null;
    }>;
};

export async function listFoggingQueue(
    actor: Actor,
): Promise<FoggingQueueItem[]> {
    const db = getDb();
    const institutionId = scopeToInstitution(actor);

    const rows = await db
        .select({
            reportId: reportsRS.id,
            reportNumber: reportsRS.reportNumber,
            kelurahan: reportsRS.kelurahan,
            kecamatan: reportsRS.kecamatan,
            status: reportsRS.status,
            puskesmasId: reportsRS.assignedPuskesmasId,
            puskesmasName: institutions.name,
            abj: reportsPE.abj,
            hi: reportsPE.houseIndex,
            ci: reportsPE.containerIndex,
            transmissionRisk: reportsPE.transmissionRisk,
        })
        .from(reportsRS)
        .leftJoin(
            institutions,
            eq(institutions.id, reportsRS.assignedPuskesmasId),
        )
        .leftJoin(reportsPE, eq(reportsPE.reportRSId, reportsRS.id))
        .where(
            and(
                inArray(reportsRS.status, [
                    'FOGGING_REQUIRED',
                    'SIKLUS_1_DONE',
                    'SIKLUS_2_SCHEDULED',
                    'SIKLUS_2_DONE',
                    'CLOSED',
                ]),
                institutionId
                    ? sql`(${reportsRS.assignedPuskesmasId} = ${institutionId} or ${reportsRS.institutionId} = ${institutionId})`
                    : sql`true`,
            ),
        )
        .orderBy(desc(reportsRS.updatedAt))
        .limit(100);

    if (rows.length === 0) return [];

    const reportIds = rows.map((r) => r.reportId);
    const cycleRows = await db
        .select({
            id: foggingCycles.id,
            reportRSId: foggingCycles.reportRSId,
            cycleNumber: foggingCycles.cycleNumber,
            status: foggingCycles.status,
            scheduledDate: foggingCycles.scheduledDate,
            executedAt: foggingCycles.executedAt,
            abateUsedKg: foggingCycles.abateUsedKg,
            insecticideUsedLiter: foggingCycles.insecticideUsedLiter,
            totalBudget: foggingCycles.totalBudget,
            notes: foggingCycles.notes,
        })
        .from(foggingCycles)
        .where(inArray(foggingCycles.reportRSId, reportIds));

    const cyclesByReport = new Map<string, FoggingQueueItem['cycles']>();
    for (const c of cycleRows) {
        const arr = cyclesByReport.get(c.reportRSId) ?? [];
        arr.push({
            id: c.id,
            cycleNumber: c.cycleNumber,
            status: c.status,
            scheduledDate: c.scheduledDate,
            executedAt: c.executedAt,
            abateUsedKg: c.abateUsedKg,
            insecticideUsedLiter: c.insecticideUsedLiter,
            totalBudget: c.totalBudget,
            notes: c.notes,
        });
        arr.sort((a, b) => a.cycleNumber - b.cycleNumber);
        cyclesByReport.set(c.reportRSId, arr);
    }

    return rows.map((r) => ({
        ...r,
        cycles: cyclesByReport.get(r.reportId) ?? [],
    }));
}

export type ExecuteFoggingResult =
    | { ok: true; nextStatus: string; cycle2ScheduledAt?: Date }
    | { ok: false; error: string };

export async function executeFoggingCycle(
    actor: Actor,
    input: FoggingCycleInput,
): Promise<ExecuteFoggingResult> {
    if (actor.role !== 'PUSKESMAS' && actor.role !== 'DINKES') {
        return {
            ok: false,
            error: 'Hanya Puskesmas atau Dinkes yang dapat mencatat pelaksanaan fogging.',
        };
    }

    const institutionId = scopeToInstitution(actor);
    const db = getDb();

    const [report] = await db
        .select({
            id: reportsRS.id,
            reportNumber: reportsRS.reportNumber,
            status: reportsRS.status,
            assignedPuskesmasId: reportsRS.assignedPuskesmasId,
            kelurahan: reportsRS.kelurahan,
        })
        .from(reportsRS)
        .where(eq(reportsRS.id, input.reportRSId))
        .limit(1);

    if (!report) {
        return { ok: false, error: 'Laporan tidak ditemukan.' };
    }

    if (
        actor.role === 'PUSKESMAS' &&
        report.assignedPuskesmasId !== institutionId
    ) {
        return {
            ok: false,
            error: 'Laporan tidak berada pada wilayah kerja Puskesmas Anda.',
        };
    }

    if (input.cycleNumber === 1 && report.status !== 'FOGGING_REQUIRED') {
        return {
            ok: false,
            error: 'Siklus 1 hanya dapat dicatat untuk kasus berstatus Wajib Fogging Fokus.',
        };
    }

    if (
        input.cycleNumber === 2 &&
        report.status !== 'SIKLUS_1_DONE' &&
        report.status !== 'SIKLUS_2_SCHEDULED'
    ) {
        return {
            ok: false,
            error: 'Siklus 2 hanya dapat dicatat setelah Siklus 1 selesai.',
        };
    }

    const targetInstitutionId =
        report.assignedPuskesmasId ?? institutionId ?? '';
    if (!targetInstitutionId) {
        return { ok: false, error: 'Puskesmas pelaksana belum ditetapkan.' };
    }

    const totalBudget =
        input.materialCost + input.honorCost + input.maintenanceCost;
    const now = new Date();
    const cycle2ScheduledDate = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const nextStatus =
        input.cycleNumber === 1 ? 'SIKLUS_2_SCHEDULED' : 'CLOSED';

    const [pe] = await db
        .select({ id: reportsPE.id })
        .from(reportsPE)
        .where(eq(reportsPE.reportRSId, input.reportRSId))
        .limit(1);

    await db.transaction(async (tx) => {
        await tx
            .insert(foggingCycles)
            .values({
                reportRSId: input.reportRSId,
                reportPEId: pe?.id ?? null,
                institutionId: targetInstitutionId,
                cycleNumber: input.cycleNumber,
                status: 'DONE',
                scheduledDate: now,
                executedAt: now,
                abateUsedKg: String(input.abateUsedKg),
                insecticideUsedLiter: String(input.insecticideUsedLiter),
                foggerMachinesCount: input.foggerMachinesCount,
                materialCost: input.materialCost,
                honorCost: input.honorCost,
                maintenanceCost: input.maintenanceCost,
                totalBudget,
                notes: input.notes ?? null,
                executedById: actor.userId,
            })
            .onConflictDoUpdate({
                target: [foggingCycles.reportRSId, foggingCycles.cycleNumber],
                set: {
                    status: 'DONE',
                    executedAt: now,
                    abateUsedKg: String(input.abateUsedKg),
                    insecticideUsedLiter: String(input.insecticideUsedLiter),
                    foggerMachinesCount: input.foggerMachinesCount,
                    materialCost: input.materialCost,
                    honorCost: input.honorCost,
                    maintenanceCost: input.maintenanceCost,
                    totalBudget,
                    notes: input.notes ?? null,
                    executedById: actor.userId,
                    updatedAt: now,
                },
            });

        if (input.cycleNumber === 1) {
            await tx
                .insert(foggingCycles)
                .values({
                    reportRSId: input.reportRSId,
                    reportPEId: pe?.id ?? null,
                    institutionId: targetInstitutionId,
                    cycleNumber: 2,
                    status: 'SCHEDULED',
                    scheduledDate: cycle2ScheduledDate,
                    foggerMachinesCount: input.foggerMachinesCount,
                    materialCost: input.materialCost,
                    honorCost: input.honorCost,
                    maintenanceCost: input.maintenanceCost,
                    totalBudget,
                })
                .onConflictDoNothing();
        }

        // Deduct matching vector logistics stocks when tracked in assets table.
        if (input.abateUsedKg > 0 || input.insecticideUsedLiter > 0) {
            const instAssets = await tx
                .select({
                    id: assets.id,
                    name: assets.name,
                    category: assets.category,
                    currentStock: assets.currentStock,
                })
                .from(assets)
                .where(eq(assets.institutionId, targetInstitutionId));

            const deductAsset = async (
                keyword: string,
                usedAmount: number,
            ) => {
                if (usedAmount <= 0) return;
                const match = instAssets.find(
                    (a) =>
                        a.category.toLowerCase().includes(keyword) ||
                        a.name.toLowerCase().includes(keyword),
                );
                if (!match) return;
                const qty = Math.max(1, Math.round(usedAmount));
                const nextStock = Math.max(0, match.currentStock - qty);
                await tx
                    .update(assets)
                    .set({ currentStock: nextStock, updatedAt: now })
                    .where(eq(assets.id, match.id));
                await tx.insert(assetTransactions).values({
                    assetId: match.id,
                    type: 'OUT',
                    quantity: qty,
                    reference: report.reportNumber,
                    notes: `Fogging Siklus ${input.cycleNumber} (${report.kelurahan ?? '-'})`,
                });
            };

            await deductAsset('abate', input.abateUsedKg);
            await deductAsset('insektisida', input.insecticideUsedLiter);
        }

        await tx
            .update(reportsRS)
            .set({
                status: nextStatus,
                updatedById: actor.userId,
                updatedAt: now,
            })
            .where(eq(reportsRS.id, input.reportRSId));
    });

    if (input.cycleNumber === 1) {
        try {
            await enqueueFoggingReminders(input.reportRSId, cycle2ScheduledDate);
        } catch (err) {
            console.error('[fogging] gagal enqueue pengingat Siklus 2', err);
        }
        await insertNotifications(
            { kind: 'INSTITUTION', institutionId: targetInstitutionId },
            {
                title: 'Fogging Siklus 2 dijadwalkan (H+7)',
                message: `Kasus ${report.reportNumber} dijadwalkan untuk Fogging Siklus 2 pada ${cycle2ScheduledDate.toLocaleDateString('id-ID')}.`,
                type: 'FOGGING_SCHEDULED',
                entityType: 'REPORT_RS',
                entityId: input.reportRSId,
            },
        );
    } else {
        await insertNotifications(
            { kind: 'ROLE', role: 'DINKES' },
            {
                title: 'Penanggulangan fokus tuntas',
                message: `Fogging Siklus 2 untuk ${report.reportNumber} selesai dan kasus ditutup.`,
                type: 'FOGGING_COMPLETED',
                entityType: 'REPORT_RS',
                entityId: input.reportRSId,
            },
        );
    }

    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'REPORT_RS',
        entityId: input.reportRSId,
        changes: {
            foggingCycle: { from: null, to: input.cycleNumber },
            status: { from: report.status, to: nextStatus },
            totalBudget: { from: null, to: totalBudget },
        },
    });

    return {
        ok: true,
        nextStatus,
        cycle2ScheduledAt:
            input.cycleNumber === 1 ? cycle2ScheduledDate : undefined,
    };
}
