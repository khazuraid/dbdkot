'use client';

import { useState, useTransition } from 'react';
import { CloudDownload, Globe2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { syncKelurahanFromSumopodAction } from './actions';

export function SyncSumopodButton() {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [result, setResult] = useState<{
        totalDistricts: number;
        totalVillages: number;
        created: number;
        existing: number;
    } | null>(null);

    const handleSync = () => {
        startTransition(async () => {
            const res = await syncKelurahanFromSumopodAction();
            if (res.ok) {
                setResult({
                    totalDistricts: res.totalDistricts,
                    totalVillages: res.totalVillagesFromApi,
                    created: res.createdCount,
                    existing: res.existingCount,
                });
                toast.success(
                    `Berhasil sinkronisasi ${res.totalVillagesFromApi} kelurahan (${res.createdCount} baru ditambahkan)`,
                );
            } else {
                toast.error(res.error || 'Gagal sinkronisasi dari API Sumopod');
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-[var(--border)] hover:bg-[var(--raised)] text-xs font-medium"
                >
                    <Globe2 className="size-3.5 text-[var(--accent)]" />
                    <span>Tarik Data Sumopod</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <CloudDownload className="size-5 text-[var(--accent)]" />
                        Sinkronisasi Kelurahan (API Sumopod)
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
                        Menarik daftar resmi 22 kelurahan di 5 kecamatan Kota Cirebon langsung dari
                        API Wilayah Sumopod (standar Kemendagri RI). Data yang sudah ada tidak akan diduplikasi.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-3 space-y-3">
                    <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/40 p-3 text-xs space-y-1.5">
                        <div className="font-semibold text-foreground flex items-center justify-between">
                            <span>Cakupan Wilayah:</span>
                            <span className="font-mono text-[11px] text-[var(--accent)]">Kota Cirebon (32.74)</span>
                        </div>
                        <p className="text-[11.5px] text-muted-foreground">
                            Meliputi Kecamatan Harjamukti, Kejaksan, Kesambi, Lemahwungkuk, dan Pekalipan.
                        </p>
                    </div>

                    {result && (
                        <div className="rounded-[var(--radius-control)] border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                            <p className="font-semibold">Sinkronisasi Berhasil Selesai:</p>
                            <ul className="list-disc pl-4 space-y-0.5 text-[11.5px]">
                                <li>{result.totalDistricts} Kecamatan terverifikasi</li>
                                <li>{result.totalVillages} Total kelurahan dari API</li>
                                <li><strong>{result.created}</strong> Kelurahan baru disimpan ke database</li>
                                <li>{result.existing} Kelurahan sudah ada sebelumnya</li>
                            </ul>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setOpen(false)}
                        disabled={isPending}
                    >
                        Tutup
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleSync}
                        disabled={isPending}
                        className="gap-2 bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="size-3.5 animate-spin" />
                                <span>Menarik Data API...</span>
                            </>
                        ) : (
                            <>
                                <RefreshCw className="size-3.5" />
                                <span>Mulai Sinkronisasi</span>
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
