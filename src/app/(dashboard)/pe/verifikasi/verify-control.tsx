'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { decideVerificationAction } from '@/app/(dashboard)/actions';
import { AttachmentDropzone } from '@/components/reports/attachment-dropzone';
import { formatDate } from '@/lib/format';

export type VerificationPeSummary = {
    peId?: string | null;
    officerName?: string | null;
    peDate?: Date | string | null;
    abj?: string | null;
    houseIndex?: string | null;
    containerIndex?: string | null;
    transmissionRisk?: string | null;
    foggingRecommended?: boolean | null;
    conclusion?: string | null;
};

/**
 * The verification decision, taken from the queue. Both paths ask for a note
 * because both are decisions a facility will read. Provides direct access to
 * the full PE investigation details and field attachment uploads.
 */
export function VerifyControl({
    reportId,
    reportNumber,
    peSummary,
}: {
    reportId: string;
    reportNumber: string;
    peSummary?: VerificationPeSummary;
}) {
    const router = useRouter();
    const [decision, setDecision] = useState<
        'VERIFY' | 'REJECT_BY_DINKES' | null
    >(null);
    const [note, setNote] = useState('');
    const [pending, startTransition] = useTransition();

    const abjVal = peSummary?.abj ? Number(peSummary.abj) : null;
    const isAbjSafe = abjVal !== null && abjVal >= 95;

    function submit() {
        if (!decision) return;
        startTransition(async () => {
            const result = await decideVerificationAction({
                id: reportId,
                decision,
                note: note.trim() || undefined,
            });
            if (!result.ok) {
                toast.error(result.error ?? 'Gagal menyimpan keputusan.');
                return;
            }
            toast.success(
                decision === 'VERIFY'
                    ? `${reportNumber} diverifikasi.`
                    : `${reportNumber} dikembalikan.`,
            );
            setDecision(null);
            setNote('');
            router.refresh();
        });
    }

    return (
        <>
            <div className="flex items-center justify-end gap-1.5">
                {peSummary?.peId ? (
                    <Button
                        size="xs"
                        variant="ghost"
                        asChild
                        className="text-xs text-muted-foreground hover:text-foreground"
                    >
                        <Link href={`/pe/${peSummary.peId}`} target="_blank">
                            <ExternalLink className="mr-1 h-3.5 w-3.5" />
                            Hasil PE
                        </Link>
                    </Button>
                ) : null}
                <Button
                    size="xs"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setDecision('REJECT_BY_DINKES')}
                >
                    <X className="mr-1 h-3 w-3" /> Kembalikan
                </Button>
                <Button
                    size="xs"
                    disabled={pending}
                    onClick={() => setDecision('VERIFY')}
                >
                    <Check className="mr-1 h-3 w-3" /> Verifikasi
                </Button>
            </div>

            <Dialog
                open={decision !== null}
                onOpenChange={(open) => !open && setDecision(null)}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {decision === 'VERIFY'
                                ? `Verifikasi Hasil PE — ${reportNumber}`
                                : `Kembalikan Hasil PE — ${reportNumber}`}
                        </DialogTitle>
                        <DialogDescription>
                            {decision === 'VERIFY'
                                ? 'Tinjau ringkasan hasil PE lapangan dan dokumen pendukung sebelum menyetujui laporan.'
                                : 'Laporan PE akan dikembalikan ke Puskesmas terkait untuk diperbaiki.'}
                        </DialogDescription>
                    </DialogHeader>

                    {peSummary ? (
                        <div className="space-y-3 rounded-lg border border-border/80 bg-surface/50 p-3.5 text-xs">
                            <div className="flex items-center justify-between border-b border-border/60 pb-2">
                                <span className="font-semibold text-foreground">
                                    Ringkasan Hasil Penyelidikan Epidemiologi
                                </span>
                                {peSummary.peId ? (
                                    <Link
                                        href={`/pe/${peSummary.peId}`}
                                        target="_blank"
                                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                                    >
                                        Buka Formulir Lengkap & Jentik 40 Rumah
                                        <ExternalLink className="h-3 w-3" />
                                    </Link>
                                ) : null}
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                                <div>
                                    <span className="text-[11px] text-muted-foreground">
                                        Petugas PE
                                    </span>
                                    <p className="font-medium text-foreground">
                                        {peSummary.officerName || '-'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[11px] text-muted-foreground">
                                        Tanggal PE
                                    </span>
                                    <p className="font-medium text-foreground">
                                        {peSummary.peDate
                                            ? formatDate(peSummary.peDate)
                                            : '-'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[11px] text-muted-foreground">
                                        Angka Bebas Jentik
                                    </span>
                                    <p
                                        className={`font-semibold tabular-nums ${
                                            isAbjSafe
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-rose-600 dark:text-rose-400'
                                        }`}
                                    >
                                        {peSummary.abj ? `${peSummary.abj}%` : '-'}
                                        {abjVal !== null && !isAbjSafe ? (
                                            <span className="ml-1 text-[10px] font-normal">
                                                (&lt;95%)
                                            </span>
                                        ) : null}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[11px] text-muted-foreground">
                                        Rekomendasi Fogging
                                    </span>
                                    <p
                                        className={`font-medium ${
                                            peSummary.foggingRecommended
                                                ? 'text-rose-600 font-semibold dark:text-rose-400'
                                                : 'text-foreground'
                                        }`}
                                    >
                                        {peSummary.foggingRecommended
                                            ? 'Perlu Fogging'
                                            : 'Tidak Perlu'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 border-t border-border/40 pt-2 sm:grid-cols-3">
                                <div>
                                    <span className="text-[11px] text-muted-foreground">
                                        House Index (HI)
                                    </span>
                                    <p className="font-medium tabular-nums text-foreground">
                                        {peSummary.houseIndex
                                            ? `${peSummary.houseIndex}%`
                                            : '-'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[11px] text-muted-foreground">
                                        Container Index (CI)
                                    </span>
                                    <p className="font-medium tabular-nums text-foreground">
                                        {peSummary.containerIndex
                                            ? `${peSummary.containerIndex}%`
                                            : '-'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[11px] text-muted-foreground">
                                        Risiko Penularan
                                    </span>
                                    <p className="font-medium text-foreground">
                                        {peSummary.transmissionRisk || '-'}
                                    </p>
                                </div>
                            </div>

                            {peSummary.conclusion ? (
                                <div className="border-t border-border/40 pt-2">
                                    <span className="text-[11px] text-muted-foreground">
                                        Kesimpulan Lapangan
                                    </span>
                                    <p className="text-foreground">
                                        {peSummary.conclusion}
                                    </p>
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {peSummary?.peId ? (
                        <div className="space-y-1.5 border-t border-border/70 pt-3">
                            <Label className="text-[12.5px] font-semibold">
                                Dokumen PE & Foto Dokumentasi
                            </Label>
                            <p className="text-[11.5px] text-muted-foreground">
                                Lampiran dokumen fisik bertandatangan atau foto kegiatan PE lapangan.
                            </p>
                            <AttachmentDropzone
                                reportPEId={peSummary.peId}
                                title="Unggah Berkas PE"
                                subtitle="PDF laporan bertandatangan atau foto jentik/lapangan (maks 10MB)"
                            />
                        </div>
                    ) : null}

                    <div className="space-y-1.5 border-t border-border/70 pt-3">
                        <Label htmlFor="verify-note" className="text-[12.5px]">
                            Catatan{' '}
                            <span className="text-muted-foreground">
                                (opsional)
                            </span>
                        </Label>
                        <Textarea
                            id="verify-note"
                            rows={3}
                            value={note}
                            maxLength={500}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Alasan keputusan, terbaca oleh fasilitas pelapor."
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            disabled={pending}
                            onClick={() => setDecision(null)}
                        >
                            Batal
                        </Button>
                        <Button
                            variant={
                                decision === 'VERIFY'
                                    ? 'default'
                                    : 'destructive'
                            }
                            disabled={pending}
                            onClick={submit}
                        >
                            {decision === 'VERIFY'
                                ? 'Verifikasi Sekarang'
                                : 'Kembalikan ke Puskesmas'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
