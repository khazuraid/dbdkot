'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Edit3, Eye, Loader2, Trash2 } from 'lucide-react';
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
import { deletePeAction } from './actions';

export function PeActionToolbar({
    peId,
    reportNumber,
    canManage = true,
    size = 'sm',
    showDetail = false,
}: {
    peId: string;
    reportNumber?: string;
    canManage?: boolean;
    size?: 'sm' | 'default';
    showDetail?: boolean;
}) {
    const router = useRouter();
    const [isDeleting, startDeleteTransition] = useTransition();
    const [deleteOpen, setDeleteOpen] = useState(false);

    if (!canManage) return null;

    const handleDelete = () => {
        startDeleteTransition(async () => {
            const res = await deletePeAction(peId);
            if (res.ok) {
                toast.success(
                    reportNumber
                        ? `Data PE untuk ${reportNumber} berhasil dihapus`
                        : 'Data PE berhasil dihapus',
                );
                setDeleteOpen(false);
                router.refresh();
            } else {
                toast.error(res.error || 'Gagal menghapus data PE');
            }
        });
    };

    return (
        <div className="flex items-center gap-1.5">
            {showDetail && (
                <Button
                    asChild
                    variant="outline"
                    size={size}
                    className="h-7 text-xs font-medium gap-1 px-2 border-[var(--border)] hover:bg-[var(--raised)]"
                >
                    <Link href={`/pe/${peId}`}>
                        <Eye className="size-3 text-foreground" />
                        <span>Detail PE</span>
                    </Link>
                </Button>
            )}

            <Button
                asChild
                variant="outline"
                size={size}
                className="h-7 text-xs font-medium gap-1 px-2 border-[var(--border)] hover:bg-[var(--raised)]"
            >
                <Link href={`/pe/${peId}/edit`}>
                    <Edit3 className="size-3 text-foreground" />
                    <span>Edit PE</span>
                </Link>
            </Button>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogTrigger asChild>
                    <Button
                        variant="outline"
                        size={size}
                        disabled={isDeleting}
                        className="h-7 text-xs font-medium gap-1 px-2 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800/40 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                    >
                        <Trash2 className="size-3" />
                        <span>Hapus PE</span>
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Data Penyelidikan Epidemiologi (PE)?</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                            Apakah Anda yakin ingin menghapus data hasil PE{' '}
                            {reportNumber && (
                                <span>
                                    untuk laporan <strong>{reportNumber}</strong>
                                </span>
                            )}
                            ? Data survei jentik rumah tangga dan rekomendasi terkait akan dihapus, dan status laporan kasus akan dikembalikan ke antrian siap diselidiki.
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
                            className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5 font-medium"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="size-3.5 animate-spin" />
                                    <span>Menghapus…</span>
                                </>
                            ) : (
                                <>
                                    <Trash2 className="size-3.5" />
                                    <span>Ya, Hapus Data PE</span>
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
