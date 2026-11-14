'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
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

/**
 * The verification decision, taken from the queue. Both paths ask for a note
 * because both are decisions a facility will read: a verification with no
 * reasoning is as unhelpful to the hospital as a rejection with none.
 */
export function VerifyControl({
    reportId,
    reportNumber,
}: {
    reportId: string;
    reportNumber: string;
}) {
    const router = useRouter();
    const [decision, setDecision] = useState<
        'VERIFY' | 'REJECT_BY_DINKES' | null
    >(null);
    const [note, setNote] = useState('');
    const [pending, startTransition] = useTransition();

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
            <div className="flex justify-end gap-1">
                <Button
                    size="xs"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setDecision('REJECT_BY_DINKES')}
                >
                    <X /> Kembalikan
                </Button>
                <Button
                    size="xs"
                    disabled={pending}
                    onClick={() => setDecision('VERIFY')}
                >
                    <Check /> Verifikasi
                </Button>
            </div>

            <Dialog
                open={decision !== null}
                onOpenChange={(open) => !open && setDecision(null)}
            >
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle className="text-[15px]">
                            {decision === 'VERIFY'
                                ? 'Verifikasi laporan'
                                : 'Kembalikan laporan'}
                        </DialogTitle>
                        <DialogDescription className="text-[12.5px]">
                            <span className="font-mono font-medium text-foreground">
                                {reportNumber}
                            </span>
                            {': '}
                            {decision === 'VERIFY'
                                ? 'laporan dinyatakan selesai dan ditutup.'
                                : 'laporan dikembalikan ke rumah sakit dengan catatan.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-1.5">
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
                                ? 'Verifikasi'
                                : 'Kembalikan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
