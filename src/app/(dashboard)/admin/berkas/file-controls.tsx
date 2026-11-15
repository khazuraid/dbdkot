'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Eye, FileText, Image as ImageIcon, Trash2 } from 'lucide-react';
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
import type { AdminUploadedFileRow } from '@/lib/domain/attachments';
import { deleteAttachmentAction } from './actions';

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function UploadedFileRowActions({
    row,
}: {
    row: Omit<AdminUploadedFileRow, 'createdAt'> & { createdAtLabel: string };
}) {
    const router = useRouter();
    const [previewOpen, setPreviewOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pending, startTransition] = useTransition();

    const isImage = row.fileType.startsWith('image/');

    function handleDelete() {
        startTransition(async () => {
            const res = await deleteAttachmentAction(row.id);
            if (!res.ok) {
                toast.error(res.error ?? 'Gagal menghapus berkas.');
                return;
            }
            toast.success(`Berkas "${row.fileName}" berhasil dihapus.`);
            setConfirmOpen(false);
            router.refresh();
        });
    }

    return (
        <>
            <div className="flex items-center justify-end gap-1">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewOpen(true)}
                    className="h-7 px-2 text-[12px]"
                    title="Lihat detail & pratinjau"
                >
                    <Eye className="size-3.5" />
                    <span className="hidden sm:inline">Detail</span>
                </Button>
                <a
                    href={row.href}
                    className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-control)] border border-border bg-[var(--raised)] px-2 text-[12px] font-medium text-foreground transition-colors hover:bg-muted"
                    title="Unduh berkas"
                >
                    <Download className="size-3.5" />
                    <span className="hidden sm:inline">Unduh</span>
                </a>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmOpen(true)}
                    className="h-7 px-2 text-[12px] text-[var(--negative)] hover:bg-[var(--pill-negative-bg)] hover:text-[var(--negative)]"
                    title="Hapus berkas permanen"
                >
                    <Trash2 className="size-3.5" />
                </Button>
            </div>

            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-[15px]">
                            {isImage ? (
                                <ImageIcon className="size-4 text-[var(--accent)]" />
                            ) : (
                                <FileText className="size-4 text-[var(--accent)]" />
                            )}
                            <span className="truncate">{row.fileName}</span>
                        </DialogTitle>
                        <DialogDescription>
                            Metadata berkas tervalidasi Magic Byte Validator
                        </DialogDescription>
                    </DialogHeader>

                    {isImage ? (
                        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-muted/40 p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={row.href}
                                alt={row.fileName}
                                className="mx-auto max-h-72 w-auto rounded object-contain"
                            />
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-[var(--surface)] p-4 text-[13px] text-muted-foreground">
                            <FileText className="size-8 shrink-0 text-[var(--accent)]" />
                            <div>
                                <p className="font-medium text-foreground">
                                    Dokumen PDF terproteksi sandbox CSP
                                </p>
                                <p className="text-[12px]">
                                    Unduh berkas untuk membukanya dengan aman di penampil PDF lokal.
                                </p>
                            </div>
                        </div>
                    )}

                    <dl className="grid grid-cols-1 gap-2 rounded-[var(--radius-card)] border border-border bg-[var(--surface)] p-3 text-[12.5px] sm:grid-cols-2">
                        <div>
                            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                                ID Berkas
                            </dt>
                            <dd className="font-mono text-foreground">{row.id}</dd>
                        </div>
                        <div>
                            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                                Tipe MIME & Ukuran
                            </dt>
                            <dd className="font-mono text-foreground tabular-nums">
                                {row.fileType} · {formatBytes(row.fileSize)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                                Pengunggah
                            </dt>
                            <dd className="text-foreground">
                                {row.uploaderName || 'Pengguna'}{' '}
                                {row.uploaderEmail ? `(${row.uploaderEmail})` : ''}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                                Waktu Unggah
                            </dt>
                            <dd className="font-mono text-foreground tabular-nums">
                                {row.createdAtLabel}
                            </dd>
                        </div>
                        <div className="sm:col-span-2">
                            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                                Lokasi Penyimpanan Server
                            </dt>
                            <dd className="truncate font-mono text-[11.5px] text-muted-foreground">
                                uploads/{row.filePath}
                            </dd>
                        </div>
                    </dl>

                    <DialogFooter className="gap-2">
                        <a
                            href={row.href}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-primary px-4 text-[13px] font-medium text-primary-foreground transition-colors hover:opacity-90"
                        >
                            <Download className="size-4" />
                            Unduh Berkas
                        </a>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPreviewOpen(false)}
                        >
                            Tutup
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Hapus berkas unggahan?</DialogTitle>
                        <DialogDescription>
                            Berkas <strong className="text-foreground">{row.fileName}</strong>{' '}
                            akan dihapus permanen dari disk server dan database. Tindakan ini dicatat di Audit Log.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setConfirmOpen(false)}
                            disabled={pending}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={pending}
                        >
                            {pending ? 'Menghapus…' : 'Ya, Hapus Permanen'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
