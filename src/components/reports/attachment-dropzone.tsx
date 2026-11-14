'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompressedUpload } from '@/hooks/use-compressed-upload';
import type { AttachmentRow } from '@/lib/domain/attachments';

/** Bytes as the size a person expects to read, not a raw count. */
function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fetchAttachments(reportRSId: string): Promise<AttachmentRow[]> {
    const res = await fetch(
        `/api/attachments?reportRSId=${encodeURIComponent(reportRSId)}`,
    );
    if (!res.ok) throw new Error('Gagal memuat lampiran.');
    const { rows } = (await res.json()) as { rows: AttachmentRow[] };
    return rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt) }));
}

/**
 * Attachment picker for an existing report. The file list and limits mirror
 * src/lib/attachments.ts; that module remains the authority — this only stops
 * an obviously wrong file before it is sent.
 *
 * The list is a server query, not local state: it has to survive a reload, so
 * the rows come from the API and an upload only invalidates them. Tracking
 * uploads in `useState` meant a file vanished on refresh while still on disk.
 */
export function AttachmentDropzone({ reportRSId }: { reportRSId: string }) {
    const queryClient = useQueryClient();
    const [busy, setBusy] = useState(false);
    const { compressing, lastStats, compressIfImage } = useCompressedUpload();

    const { data: uploaded = [], isPending } = useQuery({
        queryKey: ['attachments', reportRSId],
        queryFn: () => fetchAttachments(reportRSId),
    });

    const onDrop = useCallback(
        async (accepted: File[]) => {
            setBusy(true);

            try {
                for (const rawFile of accepted) {
                    const file = await compressIfImage(rawFile);
                    const body = new FormData();
                    body.set('file', file);
                    body.set('reportRSId', reportRSId);

                    try {
                        const res = await fetch('/api/attachments', {
                            method: 'POST',
                            body,
                        });

                        if (!res.ok) {
                            const { error } = (await res
                                .json()
                                .catch(() => ({}))) as { error?: string };
                            toast.error(`Gagal mengunggah ${file.name}`, {
                                description: error,
                            });
                        }
                    } catch {
                        // A dropped connection fails this file, not the batch; the
                        // busy flag must still clear.
                        toast.error(`Gagal mengunggah ${file.name}`);
                    }
                }

                await queryClient.invalidateQueries({
                    queryKey: ['attachments', reportRSId],
                });
            } finally {
                setBusy(false);
            }
        },
        [reportRSId, queryClient, compressIfImage],
    );

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        multiple: true,
        maxSize: 10 * 1024 * 1024,
        accept: {
            'application/pdf': ['.pdf'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/webp': ['.webp'],
        },
        noClick: true,
    });

    return (
        <div>
            <div
                {...getRootProps()}
                className={`rounded-[var(--radius-card)] border border-dashed p-4 text-[13px] ${
                    isDragActive
                        ? 'border-[var(--data)] bg-[var(--raised)]'
                        : 'border-border'
                }`}
            >
                <input {...getInputProps()} />
                <p className="text-muted-foreground">
                    PDF, JPG, PNG, atau WEBP · gambar otomatis dikompresi maks 400 KB
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={open}
                        disabled={busy || compressing}
                    >
                        {compressing
                            ? 'Mengompresi foto…'
                            : busy
                              ? 'Mengunggah…'
                              : 'Pilih berkas'}
                    </Button>
                    {lastStats && (
                        <span className="font-mono text-[11px] text-muted-foreground">
                            Terkompresi {lastStats.originalKb} KB →{' '}
                            {lastStats.compressedKb} KB
                        </span>
                    )}
                </div>
            </div>

            {isPending ? (
                <div className="mt-3 flex flex-col gap-2">
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-4 w-40" />
                </div>
            ) : uploaded.length > 0 ? (
                <ul
                    aria-live="polite"
                    className="mt-3 flex flex-col gap-1 text-[13px]"
                >
                    {uploaded.map((u) => (
                        <li key={u.id}>
                            <a
                                href={u.href}
                                className="flex min-w-0 items-center gap-2 underline-offset-4 hover:underline"
                            >
                                <Paperclip className="size-3.5 shrink-0 text-faint" />
                                <span className="truncate" title={u.fileName}>
                                    {u.fileName}
                                </span>
                                <span className="shrink-0 text-[11.5px] text-muted-foreground tabular-nums">
                                    {formatSize(u.fileSize)}
                                </span>
                            </a>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-3 text-[12.5px] text-muted-foreground">
                    Belum ada lampiran.
                </p>
            )}
        </div>
    );
}
