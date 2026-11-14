'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Edit3, Loader2, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { deleteDraftReportAction, submitDraftReportAction } from './actions';

export function DraftActionToolbar({
    reportId,
    reportNumber,
    canManage,
}: {
    reportId: string;
    reportNumber: string;
    canManage: boolean;
}) {
    const router = useRouter();
    const [isDeleting, startDeleteTransition] = useTransition();
    const [isSubmitting, startSubmitTransition] = useTransition();
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [submitOpen, setSubmitOpen] = useState(false);

    if (!canManage) return null;

    const handleDelete = () => {
        startDeleteTransition(async () => {
            const res = await deleteDraftReportAction(reportId);
            if (res.ok) {
                toast.success(`Draf laporan ${reportNumber} berhasil dihapus`);
                setDeleteOpen(false);
                router.push('/laporan');
            } else {
                toast.error(res.error || 'Gagal menghapus draf laporan');
            }
        });
    };

    const handleSubmitNow = () => {
        startSubmitTransition(async () => {
            const res = await submitDraftReportAction(reportId);
            if (res.ok) {
                toast.success(`Laporan ${reportNumber} berhasil dikirim ke surveilans!`);
                setSubmitOpen(false);
                router.refresh();
            } else {
                toast.error(res.error || 'Gagal mengirim laporan');
            }
        });
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            {/* Edit Draft */}
            <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium gap-1.5 border-[var(--border)] hover:bg-[var(--raised)]"
            >
                <Link href={`/laporan/${reportId}/edit`}>
                    <Edit3 className="size-3.5 text-foreground" />
                    <span>Edit Draf</span>
                </Link>
            </Button>

            {/* Delete Draft Modal */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isDeleting || isSubmitting}
                        className="h-8 text-xs font-medium gap-1.5 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800/40 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                    >
                        <Trash2 className="size-3.5" />
                        <span>Hapus Draf</span>
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Draf Laporan Kasus?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                            Apakah Anda yakin ingin menghapus draf laporan <strong>{reportNumber}</strong>?
                            Laporan ini belum dikirim ke surveilans dan data yang dihapus tidak dapat dipulihkan kembali.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            disabled={isDeleting}
                            className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="size-3.5 animate-spin" />
                                    <span>Menghapus…</span>
                                </>
                            ) : (
                                <>
                                    <Trash2 className="size-3.5" />
                                    <span>Ya, Hapus Draf</span>
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Submit Draft Modal */}
            <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}>
                <AlertDialogTrigger asChild>
                    <Button
                        size="sm"
                        disabled={isDeleting || isSubmitting}
                        className="h-8 text-xs font-semibold gap-1.5 bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90 shadow-xs"
                    >
                        <Send className="size-3.5" />
                        <span>Kirim Sekarang</span>
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Kirim Laporan Kasus ke Surveilans?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                            Setelah dikirim, laporan <strong>{reportNumber}</strong> akan langsung masuk ke antrian penugasan Penyelidikan Epidemiologi (PE 100 meter) di Puskesmas wilayah terkait dan statusnya tidak lagi berstatus draf.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Nanti Saja</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleSubmitNow();
                            }}
                            disabled={isSubmitting}
                            className="bg-[var(--accent)] hover:opacity-90 text-[var(--accent-ink)] gap-1.5 font-semibold"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="size-3.5 animate-spin" />
                                    <span>Mengirimkan…</span>
                                </>
                            ) : (
                                <>
                                    <Send className="size-3.5" />
                                    <span>Kirim Laporan Sekarang</span>
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
