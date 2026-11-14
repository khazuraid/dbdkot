'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eraser } from 'lucide-react';
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
import { purgeAuditLogsAction } from '@/app/(dashboard)/actions';

const RETENTION = [
    { value: '30', label: '30 hari' },
    { value: '90', label: '90 hari' },
    { value: '180', label: '6 bulan' },
    { value: '365', label: '1 tahun' },
];

/**
 * Retention erases the *content* of old entries (the change payload, the IP,
 * the agent) and keeps the who/what/when. An audit trail that deletes rows
 * cannot answer the question it exists for, so this is the only write this
 * screen has.
 */
export function PurgeButton({ isAdmin }: { isAdmin: boolean }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [days, setDays] = useState('365');
    const [pending, startTransition] = useTransition();

    if (!isAdmin) return null;

    function submit() {
        startTransition(async () => {
            const result = await purgeAuditLogsAction(Number(days));
            if (!result.ok) {
                toast.error(result.error ?? 'Gagal membersihkan.');
                return;
            }
            toast.success('Isi catatan lama dibersihkan.');
            setOpen(false);
            router.refresh();
        });
    }

    return (
        <>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                <Eraser /> Retensi
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle className="text-[15px]">
                            Bersihkan catatan lama
                        </DialogTitle>
                        <DialogDescription className="text-[12px]">
                            Perubahan, alamat IP, dan user agent dihapus untuk
                            catatan lebih lama dari batas ini. Siapa, apa, dan
                            kapan tetap tersimpan.
                        </DialogDescription>
                    </DialogHeader>

                    <Select value={days} onValueChange={setDays}>
                        <SelectTrigger aria-label="Batas retensi">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {RETENTION.map((r) => (
                                <SelectItem key={r.value} value={r.value}>
                                    Lebih lama dari {r.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            disabled={pending}
                            onClick={() => setOpen(false)}
                        >
                            Batal
                        </Button>
                        <Button disabled={pending} onClick={submit}>
                            Bersihkan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
