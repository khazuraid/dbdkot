'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
    AlertCircle,
    CheckCircle2,
    FileCheck2,
    Loader2,
    Paperclip,
    ShieldCheck,
    UploadCloud,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompressedUpload } from '@/hooks/use-compressed-upload';
import type { AttachmentRow } from '@/lib/domain/attachments';
import { cn } from '@/lib/utils';

type UploadStage =
    | 'validating'
    | 'compressing'
    | 'uploading'
    | 'done'
    | 'error';

type UploadItem = {
    id: string;
    name: string;
    size: number;
    stage: UploadStage;
    progress: number;
    error?: string;
};

/** Bytes as the size a person expects to read, not a raw count. */
function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function checkClientMagicBytes(
    file: File,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const expected: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
    };
    const expectedMime = expected[ext];
    if (!expectedMime) {
        return { ok: false, error: 'Ekstensi file tidak diizinkan.' };
    }

    const buf = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    let detected: string | null = null;
    if (
        buf.length >= 8 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a
    ) {
        detected = 'image/png';
    } else if (
        buf.length >= 3 &&
        buf[0] === 0xff &&
        buf[1] === 0xd8 &&
        buf[2] === 0xff
    ) {
        detected = 'image/jpeg';
    } else if (
        buf.length >= 5 &&
        buf[0] === 0x25 &&
        buf[1] === 0x50 &&
        buf[2] === 0x44 &&
        buf[3] === 0x46 &&
        buf[4] === 0x2d
    ) {
        detected = 'application/pdf';
    } else if (
        buf.length >= 12 &&
        buf[0] === 0x52 &&
        buf[1] === 0x49 &&
        buf[2] === 0x46 &&
        buf[3] === 0x46 &&
        buf[8] === 0x57 &&
        buf[9] === 0x45 &&
        buf[10] === 0x42 &&
        buf[11] === 0x50
    ) {
        detected = 'image/webp';
    }

    if (!detected || detected !== expectedMime) {
        return {
            ok: false,
            error: 'Signature file (magic bytes) tidak sesuai dengan ekstensi.',
        };
    }

    return { ok: true };
}

function uploadWithProgress(
    body: FormData,
    onProgress: (pct: number) => void,
): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/attachments');
        xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable && ev.total > 0) {
                onProgress(Math.min(98, Math.round((ev.loaded / ev.total) * 100)));
            }
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                onProgress(100);
                resolve({ ok: true });
                return;
            }
            try {
                const parsed = JSON.parse(xhr.responseText) as { error?: string };
                resolve({ ok: false, error: parsed.error || 'Unggahan ditolak server.' });
            } catch {
                resolve({ ok: false, error: 'Unggahan ditolak server.' });
            }
        };
        xhr.onerror = () => resolve({ ok: false, error: 'Koneksi jaringan terputus.' });
        xhr.send(body);
    });
}

async function fetchAttachments(reportRSId: string): Promise<AttachmentRow[]> {
    const res = await fetch(
        `/api/attachments?reportRSId=${encodeURIComponent(reportRSId)}`,
    );
    if (!res.ok) throw new Error('Gagal memuat lampiran.');
    const { rows } = (await res.json()) as { rows: AttachmentRow[] };
    return rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt) }));
}

export function AttachmentDropzone({ reportRSId }: { reportRSId: string }) {
    const queryClient = useQueryClient();
    const reduceMotion = useReducedMotion();
    const [busy, setBusy] = useState(false);
    const [queue, setQueue] = useState<UploadItem[]>([]);
    const { compressing, lastStats, compressIfImage } = useCompressedUpload();

    const { data: uploaded = [], isPending } = useQuery({
        queryKey: ['attachments', reportRSId],
        queryFn: () => fetchAttachments(reportRSId),
    });

    const updateQueueItem = useCallback(
        (id: string, patch: Partial<UploadItem>) => {
            setQueue((prev) =>
                prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
            );
        },
        [],
    );

    const onDrop = useCallback(
        async (accepted: File[]) => {
            if (accepted.length === 0) return;
            setBusy(true);

            const batch: UploadItem[] = accepted.map((file, idx) => ({
                id: `${Date.now()}-${idx}-${file.name}`,
                name: file.name,
                size: file.size,
                stage: 'validating',
                progress: 8,
            }));
            setQueue((prev) => [...batch, ...prev]);

            try {
                for (let i = 0; i < accepted.length; i++) {
                    const rawFile = accepted[i];
                    const itemId = batch[i].id;

                    const magic = await checkClientMagicBytes(rawFile);
                    if (!magic.ok) {
                        updateQueueItem(itemId, {
                            stage: 'error',
                            progress: 100,
                            error: magic.error,
                        });
                        toast.error(`Berkas ditolak: ${rawFile.name}`, {
                            description: magic.error,
                        });
                        continue;
                    }

                    updateQueueItem(itemId, {
                        stage: rawFile.type.startsWith('image/')
                            ? 'compressing'
                            : 'uploading',
                        progress: 22,
                    });

                    const file = await compressIfImage(rawFile);
                    updateQueueItem(itemId, {
                        stage: 'uploading',
                        size: file.size,
                        progress: 30,
                    });

                    const body = new FormData();
                    body.set('file', file);
                    body.set('reportRSId', reportRSId);

                    const result = await uploadWithProgress(body, (pct) => {
                        updateQueueItem(itemId, {
                            progress: Math.max(30, pct),
                        });
                    });

                    if (!result.ok) {
                        updateQueueItem(itemId, {
                            stage: 'error',
                            progress: 100,
                            error: result.error,
                        });
                        toast.error(`Gagal mengunggah ${file.name}`, {
                            description: result.error,
                        });
                    } else {
                        updateQueueItem(itemId, {
                            stage: 'done',
                            progress: 100,
                        });
                        toast.success(`${file.name} berhasil diunggah.`);
                        setTimeout(() => {
                            setQueue((prev) => prev.filter((q) => q.id !== itemId));
                        }, 2400);
                    }
                }

                await queryClient.invalidateQueries({
                    queryKey: ['attachments', reportRSId],
                });
            } finally {
                setBusy(false);
            }
        },
        [reportRSId, queryClient, compressIfImage, updateQueueItem],
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

    const stageLabel = (item: UploadItem) => {
        switch (item.stage) {
            case 'validating':
                return 'Memvalidasi magic bytes…';
            case 'compressing':
                return 'Mengompresi gambar…';
            case 'uploading':
                return `Mengunggah ${item.progress}%`;
            case 'done':
                return 'Terverifikasi & tersimpan';
            case 'error':
                return item.error || 'Gagal mengunggah';
        }
    };

    return (
        <div className="space-y-3">
            <div
                {...getRootProps()}
                className={cn(
                    'relative overflow-hidden rounded-[var(--radius-card)] border border-dashed p-4 text-[13px] transition-colors duration-200',
                    isDragActive
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]/50'
                        : 'border-border bg-[var(--surface)]/50 hover:border-border/90',
                )}
            >
                <input {...getInputProps()} />

                {isDragActive && !reduceMotion && (
                    <motion.div
                        aria-hidden="true"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,var(--accent-soft),transparent_70%)]"
                    />
                )}

                <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <motion.div
                            animate={
                                reduceMotion
                                    ? undefined
                                    : isDragActive
                                      ? { y: [-2, 2, -2], scale: 1.06 }
                                      : busy
                                        ? { scale: [1, 1.04, 1] }
                                        : { y: 0, scale: 1 }
                            }
                            transition={{
                                repeat: isDragActive || busy ? Infinity : 0,
                                duration: 1.2,
                                ease: 'easeInOut',
                            }}
                            className={cn(
                                'flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
                                isDragActive
                                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                                    : 'border-border bg-[var(--raised)] text-muted-foreground',
                            )}
                        >
                            {busy ? (
                                <Loader2 className="size-4 animate-spin text-[var(--accent)]" />
                            ) : (
                                <UploadCloud className="size-4" strokeWidth={1.75} />
                            )}
                        </motion.div>
                        <div className="space-y-0.5">
                            <p className="font-medium text-foreground">
                                {isDragActive
                                    ? 'Lepaskan berkas untuk memulai validasi & unggahan'
                                    : 'Tarik & letakkan berkas di sini, atau klik pilih'}
                            </p>
                            <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
                                <span>PDF, JPG, PNG, WEBP (maks 10 MB)</span>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1 text-[var(--positive)]">
                                    <ShieldCheck className="size-3.5" />
                                    Magic Byte Validator aktif
                                </span>
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={open}
                            disabled={busy || compressing}
                        >
                            {compressing
                                ? 'Mengompresi…'
                                : busy
                                  ? 'Mengunggah…'
                                  : 'Pilih berkas'}
                        </Button>
                        {lastStats && (
                            <span className="font-mono text-[11px] text-muted-foreground">
                                {lastStats.originalKb} KB → {lastStats.compressedKb} KB
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <AnimatePresence initial={false}>
                {queue.length > 0 && (
                    <motion.ul
                        aria-label="Antrean unggahan"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2 overflow-hidden"
                    >
                        {queue.map((item) => (
                            <motion.li
                                key={item.id}
                                layout
                                initial={
                                    reduceMotion
                                        ? { opacity: 0 }
                                        : { opacity: 0, y: -6, scale: 0.98 }
                                }
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={
                                    reduceMotion
                                        ? { opacity: 0 }
                                        : { opacity: 0, x: 16, scale: 0.98 }
                                }
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                className={cn(
                                    'rounded-[var(--radius-control)] border p-2.5 text-[12.5px]',
                                    item.stage === 'error'
                                        ? 'border-[var(--negative)]/40 bg-[var(--pill-negative-bg)]'
                                        : item.stage === 'done'
                                          ? 'border-[var(--positive)]/40 bg-[var(--pill-positive-bg)]'
                                          : 'border-border bg-[var(--raised)]',
                                )}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        {item.stage === 'done' ? (
                                            <CheckCircle2 className="size-4 shrink-0 text-[var(--positive)]" />
                                        ) : item.stage === 'error' ? (
                                            <AlertCircle className="size-4 shrink-0 text-[var(--negative)]" />
                                        ) : item.stage === 'validating' ? (
                                            <FileCheck2 className="size-4 shrink-0 animate-pulse text-[var(--accent)]" />
                                        ) : (
                                            <Loader2 className="size-4 shrink-0 animate-spin text-[var(--accent)]" />
                                        )}
                                        <span className="truncate font-medium text-foreground">
                                            {item.name}
                                        </span>
                                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                                            {formatSize(item.size)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={cn(
                                                'text-[11.5px] font-medium tabular-nums',
                                                item.stage === 'error'
                                                    ? 'text-[var(--negative)]'
                                                    : item.stage === 'done'
                                                      ? 'text-[var(--positive)]'
                                                      : 'text-muted-foreground',
                                            )}
                                        >
                                            {stageLabel(item)}
                                        </span>
                                        {item.stage === 'error' && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setQueue((prev) =>
                                                        prev.filter((q) => q.id !== item.id),
                                                    )
                                                }
                                                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                                                aria-label="Tutup pesan gagal"
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {item.stage !== 'error' && (
                                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                                        <motion.div
                                            className={cn(
                                                'h-full rounded-full',
                                                item.stage === 'done'
                                                    ? 'bg-[var(--positive)]'
                                                    : 'bg-[var(--accent)]',
                                            )}
                                            initial={{ width: '0%' }}
                                            animate={{ width: `${item.progress}%` }}
                                            transition={{ duration: 0.2, ease: 'easeOut' }}
                                        />
                                    </div>
                                )}
                            </motion.li>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>

            {isPending ? (
                <div className="mt-3 flex flex-col gap-2">
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-4 w-40" />
                </div>
            ) : uploaded.length > 0 ? (
                <ul
                    aria-live="polite"
                    className="mt-3 flex flex-col gap-1.5 text-[13px]"
                >
                    <AnimatePresence initial={false}>
                        {uploaded.map((u) => (
                            <motion.li
                                key={u.id}
                                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.18 }}
                            >
                                <a
                                    href={u.href}
                                    className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 underline-offset-4 transition-colors hover:bg-[var(--raised)] hover:underline"
                                >
                                    <Paperclip className="size-3.5 shrink-0 text-faint" />
                                    <span className="truncate" title={u.fileName}>
                                        {u.fileName}
                                    </span>
                                    <span className="shrink-0 font-mono text-[11.5px] text-muted-foreground tabular-nums">
                                        {formatSize(u.fileSize)}
                                    </span>
                                </a>
                            </motion.li>
                        ))}
                    </AnimatePresence>
                </ul>
            ) : (
                <p className="mt-3 text-[12.5px] text-muted-foreground">
                    Belum ada lampiran.
                </p>
            )}
        </div>
    );
}
