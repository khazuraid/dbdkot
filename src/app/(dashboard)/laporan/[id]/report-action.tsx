'use client';

import { useState, useTransition } from 'react';
import { reportAction } from './actions';
import type { Transition } from '@/lib/domain/report-detail';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const MESSAGE: Record<string, string> = {
    NOT_FOUND: 'Laporan tidak ditemukan.',
    FORBIDDEN: 'Anda tidak berwenang untuk tindakan ini.',
    ILLEGAL_STATE: 'Status laporan sudah berubah. Muat ulang halaman.',
    NOTE_REQUIRED: 'Alasan penolakan wajib diisi minimal 5 karakter.',
};

const REQUIRES_NOTE: Transition[] = ['REJECT', 'REJECT_BY_DINKES'];

export function ReportAction({
    id,
    transition,
    label,
    primary,
}: {
    id: string;
    transition: Transition;
    label: string;
    primary?: boolean;
}) {
    const [pending, start] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const [note, setNote] = useState('');

    const needsNote = REQUIRES_NOTE.includes(transition);

    function run(reasonNote?: string) {
        start(async () => {
            const result = await reportAction(id, transition, reasonNote);

            if (result.ok) {
                setError(null);
                setOpen(false);
                setNote('');
            } else {
                setError(
                    'reason' in result
                        ? (MESSAGE[result.reason] ?? 'Gagal.')
                        : result.error,
                );
            }
        });
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <Button
                type="button"
                variant={primary ? 'default' : 'outline'}
                className="h-9 px-3 transition-[transform,background-color,border-color,color] duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
                disabled={pending}
                onClick={() => {
                    if (needsNote) {
                        setError(null);
                        setOpen(true);
                    } else {
                        run();
                    }
                }}
            >
                <span
                    className={
                        pending
                            ? 'opacity-70 blur-[1.5px] transition-[filter,opacity] duration-150 ease-out'
                            : 'blur-0 opacity-100 transition-[filter,opacity] duration-150 ease-out'
                    }
                >
                    {pending ? 'Memproses…' : label}
                </span>
            </Button>
            {error && !open && (
                <span className="text-[12px] text-[var(--negative)]">
                    {error}
                </span>
            )}

            {needsNote && (
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>
                                {transition === 'REJECT'
                                    ? 'Tolak Penugasan Kasus'
                                    : 'Tolak Hasil PE'}
                            </DialogTitle>
                            <DialogDescription>
                                {transition === 'REJECT'
                                    ? 'Cantumkan alasan penolakan agar Dinas Kesehatan dapat melakukan disposisi ulang ke Puskesmas yang sesuai.'
                                    : 'Cantumkan alasan penolakan hasil PE sebagai catatan perbaikan.'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-2 py-2">
                            <Textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Contoh: Alamat pasien berada di luar wilayah kerja kelurahan kami…"
                                rows={3}
                                maxLength={1000}
                                disabled={pending}
                            />
                            {error && (
                                <p className="text-[12px] text-[var(--negative)]">
                                    {error}
                                </p>
                            )}
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={pending}
                                onClick={() => setOpen(false)}
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={pending || note.trim().length < 5}
                                onClick={() => run(note.trim())}
                            >
                                {pending
                                    ? 'Memproses…'
                                    : 'Konfirmasi Penolakan'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
