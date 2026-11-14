'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CheckCircle2, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusText } from '@/components/shell/status-text';
import { formatDate } from '@/lib/format';
import type { FoggingQueueItem } from '@/lib/domain/fogging';
import { foggingCycleSchema } from '@/lib/domain/form-contracts';
import { executeFoggingAction } from './actions';

const formatIdr = (n: number) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(n);

export function FoggingCard({
    item,
    canExecute,
}: {
    item: FoggingQueueItem;
    canExecute: boolean;
}) {
    const pendingCycle =
        item.cycles.find((c) => c.status !== 'DONE')?.cycleNumber ?? 1;
    const cycleNumber: 1 | 2 = pendingCycle === 2 ? 2 : 1;

    const [abateUsedKg, setAbateUsedKg] = useState(1.5);
    const [insecticideUsedLiter, setInsecticideUsedLiter] = useState(2);
    const [foggerMachinesCount, setFoggerMachinesCount] = useState(2);
    const [materialCost, setMaterialCost] = useState(350_000);
    const [honorCost, setHonorCost] = useState(400_000);
    const [maintenanceCost, setMaintenanceCost] = useState(150_000);
    const [notes, setNotes] = useState('');
    const [pending, start] = useTransition();

    const perCycleCost = materialCost + honorCost + maintenanceCost;
    const budget = {
        formattedPerCycle: formatIdr(perCycleCost),
        formattedTwoCycles: formatIdr(perCycleCost * 2),
    };

    const isDoneAll =
        item.cycles.length >= 2 && item.cycles.every((c) => c.status === 'DONE');

    function handleExecute(e: React.FormEvent) {
        e.preventDefault();

        const parsed = foggingCycleSchema.safeParse({
            reportRSId: item.reportId,
            cycleNumber,
            abateUsedKg,
            insecticideUsedLiter,
            foggerMachinesCount,
            materialCost,
            honorCost,
            maintenanceCost,
            notes: notes || undefined,
        });

        if (!parsed.success) {
            toast.error(parsed.error.issues[0]?.message ?? 'Data fogging tidak valid.');
            return;
        }

        start(async () => {
            const res = await executeFoggingAction(parsed.data);
            if (!res.ok) {
                toast.error(res.error);
                return;
            }
            toast.success(
                cycleNumber === 1
                    ? 'Siklus 1 selesai! Siklus 2 dijadwalkan otomatis H+7.'
                    : 'Siklus 2 selesai! Kasus siap ditutup.',
            );
        });
    }

    return (
        <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <div className="flex items-center gap-2">
                        <Link
                            href={`/laporan/${item.reportId}`}
                            className="font-mono text-[14px] font-semibold text-[var(--accent)] hover:underline"
                        >
                            {item.reportNumber}
                        </Link>
                        <StatusText tone={isDoneAll ? 'good' : 'warn'}>
                            {item.status}
                        </StatusText>
                    </div>
                    <p className="text-[13px] text-muted-foreground">
                        {item.kelurahan ?? '-'}, {item.kecamatan ?? '-'} ·{' '}
                        {item.puskesmasName ?? 'Puskesmas'} · ABJ:{' '}
                        <span className="font-mono">{item.abj ?? '-'}%</span> ·
                        HI: <span className="font-mono">{item.hi ?? '-'}%</span>
                    </p>
                </div>

                <div className="rounded-[var(--radius-control)] border border-[var(--rule)] bg-[var(--raised)]/60 px-3 py-1.5 text-right">
                    <p className="text-[10.5px] text-muted-foreground">
                        Proyeksi Budget 2 Siklus
                    </p>
                    <p
                        data-numeric
                        className="font-mono text-[13.5px] font-semibold"
                    >
                        {budget.formattedTwoCycles}
                    </p>
                </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
                {item.cycles.map((c) => (
                    <div
                        key={c.id}
                        className="rounded-[var(--radius-control)] border border-[var(--rule)] px-3 py-2 text-[12.5px]"
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-semibold">
                                Siklus {c.cycleNumber}
                            </span>
                            <StatusText
                                tone={c.status === 'DONE' ? 'good' : 'warn'}
                            >
                                {c.status === 'DONE' ? 'Selesai' : 'Terjadwal'}
                            </StatusText>
                        </div>
                        <p className="mt-0.5 text-muted-foreground">
                            Jadwal: {formatDate(c.scheduledDate)}
                            {c.executedAt
                                ? ` · Pelaksanaan: ${formatDate(c.executedAt)}`
                                : ''}
                        </p>
                    </div>
                ))}
            </div>

            {canExecute && !isDoneAll && (
                <form
                    onSubmit={handleExecute}
                    className="flex flex-col gap-3 border-t border-[var(--rule)] pt-3"
                >
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                        <Flame
                            className="size-4 text-[var(--warning)]"
                            aria-hidden
                        />
                        Catat Pelaksanaan Fogging Fokus Siklus {cycleNumber}
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                        <div className="flex flex-col gap-1">
                            <Label className="text-[11px]">Abate (kg)</Label>
                            <Input
                                type="number"
                                step="0.1"
                                min={0}
                                value={abateUsedKg}
                                onChange={(e) =>
                                    setAbateUsedKg(Number(e.target.value))
                                }
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-[11px]">
                                Insektisida (L)
                            </Label>
                            <Input
                                type="number"
                                step="0.1"
                                min={0}
                                value={insecticideUsedLiter}
                                onChange={(e) =>
                                    setInsecticideUsedLiter(
                                        Number(e.target.value),
                                    )
                                }
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-[11px]">Mesin Fogger</Label>
                            <Input
                                type="number"
                                min={1}
                                value={foggerMachinesCount}
                                onChange={(e) =>
                                    setFoggerMachinesCount(
                                        Number(e.target.value),
                                    )
                                }
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-[11px]">
                                Biaya Bahan (Rp)
                            </Label>
                            <Input
                                type="number"
                                min={0}
                                step={10_000}
                                value={materialCost}
                                onChange={(e) =>
                                    setMaterialCost(Number(e.target.value))
                                }
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-[11px]">
                                Honor Petugas (Rp)
                            </Label>
                            <Input
                                type="number"
                                min={0}
                                step={10_000}
                                value={honorCost}
                                onChange={(e) =>
                                    setHonorCost(Number(e.target.value))
                                }
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-[11px]">
                                Pemeliharaan (Rp)
                            </Label>
                            <Input
                                type="number"
                                min={0}
                                step={10_000}
                                value={maintenanceCost}
                                onChange={(e) =>
                                    setMaintenanceCost(Number(e.target.value))
                                }
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <Input
                            placeholder="Catatan lapangan / lokasi fokus..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="max-w-md"
                        />
                        <Button type="submit" size="sm" disabled={pending}>
                            <CheckCircle2 data-icon="inline-start" />
                            {pending
                                ? 'Menyimpan...'
                                : `Selesaikan Siklus ${cycleNumber} (${budget.formattedPerCycle})`}
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
}
