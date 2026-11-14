'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { reassignReportAction } from '@/app/(dashboard)/actions';

export type PuskesmasOption = { id: string; name: string };

/**
 * One report stuck without a puskesmas, and the two ways out: name the
 * puskesmas directly (which grants it coverage of that kelurahan, so a later
 * sweep agrees), or retry the automatic match after someone fixed the
 * kelurahan. The dialog is the confirmation step — this re-routes patient data.
 */
export function ReassignControl({
    reportId,
    reportNumber,
    kelurahan,
    options,
}: {
    reportId: string;
    reportNumber: string;
    kelurahan: string | null;
    options: PuskesmasOption[];
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [target, setTarget] = useState('');
    const [pending, startTransition] = useTransition();

    function submit(puskesmasId: string) {
        startTransition(async () => {
            const result = await reassignReportAction(reportId, puskesmasId);
            if (!result.ok) {
                toast.error(result.error ?? 'Gagal menugaskan.');
                return;
            }
            toast.success(
                puskesmasId
                    ? `${reportNumber} ditugaskan ulang.`
                    : 'Pencocokan otomatis dijalankan.',
            );
            setOpen(false);
            router.refresh();
        });
    }

    return (
        <>
            <div className="flex justify-end gap-1.5">
                <Button
                    size="xs"
                    variant="outline"
                    disabled={pending}
                    onClick={() => submit('')}
                >
                    <RotateCcw aria-hidden /> Cocokkan otomatis
                </Button>
                <Button
                    size="xs"
                    disabled={pending || options.length === 0}
                    onClick={() => setOpen(true)}
                >
                    <MapPin aria-hidden /> Pilih puskesmas
                </Button>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle className="text-[16px]">
                            Tugaskan {reportNumber}
                        </DialogTitle>
                        <DialogDescription className="text-[12.5px]">
                            Puskesmas terpilih akan mendapat cakupan kelurahan
                            ini, lalu laporan langsung dialihkan ke sana.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <dl className="grid grid-cols-2 gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/55 px-3.5 py-2.5 text-[12.5px]">
                            <div>
                                <dt className="text-muted-foreground">
                                    No. laporan
                                </dt>
                                <dd className="mt-0.5 font-mono font-medium text-foreground">
                                    {reportNumber}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">
                                    Kelurahan
                                </dt>
                                <dd className="mt-0.5 font-medium text-foreground">
                                    {kelurahan ?? '—'}
                                </dd>
                            </div>
                        </dl>

                        <div className="space-y-1.5">
                            <label
                                htmlFor={`puskesmas-${reportId}`}
                                className="block text-[12.5px] font-medium text-foreground"
                            >
                                Puskesmas tujuan
                            </label>
                            <Select value={target} onValueChange={setTarget}>
                                <SelectTrigger
                                    id={`puskesmas-${reportId}`}
                                    aria-label="Puskesmas tujuan"
                                    className="w-full"
                                >
                                    <SelectValue placeholder="Pilih puskesmas…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {options.map((o) => (
                                        <SelectItem key={o.id} value={o.id}>
                                            {o.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={pending}
                        >
                            Batal
                        </Button>
                        <Button
                            disabled={pending || !target}
                            onClick={() => submit(target)}
                        >
                            {pending ? 'Menugaskan…' : 'Tugaskan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
