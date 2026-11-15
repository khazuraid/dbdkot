'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
    AlertCircle,
    CheckCircle2,
    FileText,
    Image as ImageIcon,
    Loader2,
    ShieldCheck,
    Sparkles,
    UploadCloud,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MAX_STAGED_FILES = 5;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export type StagedAttachment = {
    id: string;
    file: File;
    originalSize: number;
    compressedSize: number;
    kind: 'pdf' | 'image';
    previewUrl: string | null;
    status: 'ready' | 'compressing' | 'uploading' | 'done' | 'error';
    progress: number;
    error?: string;
};

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function verifyClientMagicBytes(
    file: File,
): Promise<{ ok: true; kind: 'pdf' | 'image' } | { ok: false; error: string }> {
    const dotIdx = file.name.lastIndexOf('.');
    const ext = dotIdx >= 0 ? file.name.slice(dotIdx).toLowerCase() : '';
    const expected: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
    };
    const expectedMime = expected[ext];
    if (!expectedMime) {
        return {
            ok: false,
            error: 'Format berkas tidak didukung. Gunakan PDF, JPG, PNG, atau WEBP.',
        };
    }

    const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
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
            error: 'Signature isi berkas tidak sesuai dengan ekstensi nama file.',
        };
    }

    return { ok: true, kind: detected === 'application/pdf' ? 'pdf' : 'image' };
}

export function uploadStagedAttachment(
    file: File,
    reportRSId: string,
    onProgress: (pct: number) => void,
): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
        const body = new FormData();
        body.set('file', file);
        body.set('reportRSId', reportRSId);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/attachments');
        xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable && ev.total > 0) {
                onProgress(Math.min(96, Math.round((ev.loaded / ev.total) * 100)));
            }
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                onProgress(100);
                resolve({ ok: true });
                return;
            }
            let message = 'Gagal mengunggah lampiran.';
            try {
                const parsed = JSON.parse(xhr.responseText);
                if (parsed?.error) message = parsed.error;
            } catch {
                // ignore JSON parse failure
            }
            resolve({ ok: false, error: message });
        };
        xhr.onerror = () => {
            resolve({ ok: false, error: 'Kendala jaringan saat mengunggah lampiran.' });
        };
        xhr.send(body);
    });
}

export function StagedAttachmentPicker({
    items,
    onChange,
    disabled = false,
}: {
    items: StagedAttachment[];
    onChange: React.Dispatch<React.SetStateAction<StagedAttachment[]>>;
    disabled?: boolean;
}) {
    const reducedMotion = useReducedMotion();
    const previewUrlsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const urls = previewUrlsRef.current;
        return () => {
            for (const url of urls) {
                URL.revokeObjectURL(url);
            }
            urls.clear();
        };
    }, []);

    const removeItem = (id: string) => {
        onChange((prev) => {
            const target = prev.find((i) => i.id === id);
            if (target?.previewUrl) {
                URL.revokeObjectURL(target.previewUrl);
                previewUrlsRef.current.delete(target.previewUrl);
            }
            return prev.filter((i) => i.id !== id);
        });
    };

    const onDrop = useCallback(
        async (accepted: File[]) => {
            if (accepted.length === 0 || disabled) return;

            const remaining = MAX_STAGED_FILES - items.length;
            if (remaining <= 0) {
                toast.warning(`Maksimal ${MAX_STAGED_FILES} berkas lampiran per laporan.`);
                return;
            }

            const slice = accepted.slice(0, remaining);
            if (accepted.length > remaining) {
                toast.info(`Hanya ${remaining} berkas pertama yang ditambahkan (batas ${MAX_STAGED_FILES}).`);
            }

            for (const rawFile of slice) {
                const duplicate = items.some(
                    (existing) =>
                        existing.file.name.toLowerCase() === rawFile.name.toLowerCase(),
                );
                if (duplicate) {
                    toast.warning(`Berkas "${rawFile.name}" sudah ada di daftar.`);
                    continue;
                }

                const magic = await verifyClientMagicBytes(rawFile);
                if (!magic.ok) {
                    toast.error(`Berkas ditolak: ${rawFile.name}`, {
                        description: magic.error,
                    });
                    continue;
                }

                const itemId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

                if (magic.kind === 'pdf') {
                    if (rawFile.size === 0 || rawFile.size > MAX_UPLOAD_BYTES) {
                        toast.error(`PDF terlalu besar: ${rawFile.name}`, {
                            description: 'Ukuran PDF maksimal 10 MB.',
                        });
                        continue;
                    }
                    onChange((prev) => [
                        ...prev,
                        {
                            id: itemId,
                            file: rawFile,
                            originalSize: rawFile.size,
                            compressedSize: rawFile.size,
                            kind: 'pdf',
                            previewUrl: null,
                            status: 'ready',
                            progress: 0,
                        },
                    ]);
                    continue;
                }

                // Image: add compressing item, then compress via browser-image-compression
                onChange((prev) => [
                    ...prev,
                    {
                        id: itemId,
                        file: rawFile,
                        originalSize: rawFile.size,
                        compressedSize: rawFile.size,
                        kind: 'image',
                        previewUrl: null,
                        status: 'compressing',
                        progress: 0,
                    },
                ]);

                try {
                    const compressedBlob = await imageCompression(rawFile, {
                        maxSizeMB: 0.4,
                        maxWidthOrHeight: 1600,
                        useWebWorker: true,
                    });
                    const finalFile = new File([compressedBlob], rawFile.name, {
                        type: compressedBlob.type || rawFile.type,
                    });

                    if (finalFile.size > MAX_UPLOAD_BYTES) {
                        onChange((prev) => prev.filter((x) => x.id !== itemId));
                        toast.error(`Ukuran berkas masih melebihi 10 MB: ${rawFile.name}`);
                        continue;
                    }

                    const previewUrl = URL.createObjectURL(finalFile);
                    previewUrlsRef.current.add(previewUrl);

                    onChange((prev) =>
                        prev.map((x) =>
                            x.id === itemId
                                ? {
                                      ...x,
                                      file: finalFile,
                                      compressedSize: finalFile.size,
                                      previewUrl,
                                      status: 'ready',
                                  }
                                : x,
                        ),
                    );
                } catch {
                    if (rawFile.size > MAX_UPLOAD_BYTES) {
                        onChange((prev) => prev.filter((x) => x.id !== itemId));
                        toast.error(`Gagal mengompresi ${rawFile.name}`);
                        continue;
                    }
                    const previewUrl = URL.createObjectURL(rawFile);
                    previewUrlsRef.current.add(previewUrl);
                    onChange((prev) =>
                        prev.map((x) =>
                            x.id === itemId
                                ? {
                                      ...x,
                                      previewUrl,
                                      status: 'ready',
                                  }
                                : x,
                        ),
                    );
                }
            }
        },
        [disabled, items, onChange],
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        disabled,
        multiple: true,
        accept: {
            'application/pdf': ['.pdf'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/webp': ['.webp'],
        },
    });

    return (
        <div className="space-y-3">
            <div
                {...getRootProps()}
                className={cn(
                    'group relative cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-all',
                    isDragActive
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]/50'
                        : 'border-[var(--border)] bg-[var(--ground)]/70 hover:border-[var(--accent)]/50 hover:bg-[var(--raised)]/60',
                    disabled && 'pointer-events-none opacity-60',
                )}
            >
                <input {...getInputProps()} aria-label="Unggah berkas PDF atau gambar hasil lab" />
                <div className="mx-auto flex max-w-md flex-col items-center gap-2">
                    <div
                        className={cn(
                            'grid size-11 place-items-center rounded-xl border transition-colors',
                            isDragActive
                                ? 'border-[var(--accent)]/30 bg-[var(--accent)] text-[var(--accent-ink)]'
                                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--accent)] group-hover:border-[var(--accent)]/30',
                        )}
                    >
                        <UploadCloud className="size-5" aria-hidden />
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[13px] font-semibold text-foreground">
                            {isDragActive
                                ? 'Lepaskan berkas di sini…'
                                : 'Seret & lepas hasil lab (PDF) atau foto klinis (JPG/PNG)'}
                        </p>
                        <p className="text-[11.5px] text-muted-foreground">
                            atau <span className="font-medium text-[var(--accent)] underline-offset-2 group-hover:underline">klik untuk memilih berkas</span> · Maks. {MAX_STAGED_FILES} berkas
                        </p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5">
                            <Sparkles className="size-3 text-[var(--accent)]" aria-hidden />
                            JPG/PNG otomatis dikompresi ≤ 400 KB
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5">
                            <ShieldCheck className="size-3 text-[var(--positive)]" aria-hidden />
                            Verifikasi Magic-Byte PDF & Gambar
                        </span>
                    </div>
                </div>
            </div>

            <AnimatePresence initial={false}>
                {items.length > 0 && (
                    <motion.ul
                        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="space-y-2"
                    >
                        {items.map((item) => {
                            const savedPct =
                                item.originalSize > item.compressedSize
                                    ? Math.round(
                                          ((item.originalSize - item.compressedSize) /
                                              item.originalSize) *
                                              100,
                                      )
                                    : 0;

                            return (
                                <li
                                    key={item.id}
                                    className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-2xs"
                                >
                                    {/* Preview Thumbnail / PDF Badge */}
                                    {item.kind === 'image' && item.previewUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={item.previewUrl}
                                            alt={item.file.name}
                                            className="size-11 shrink-0 rounded-lg border border-[var(--border)] object-cover"
                                        />
                                    ) : (
                                        <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--raised)] text-[var(--accent)]">
                                            {item.kind === 'pdf' ? (
                                                <FileText className="size-5" aria-hidden />
                                            ) : (
                                                <ImageIcon className="size-5" aria-hidden />
                                            )}
                                        </div>
                                    )}

                                    {/* Metadata & Progress */}
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate text-[12.5px] font-medium text-foreground">
                                                {item.file.name}
                                            </p>
                                            <span className="shrink-0 rounded bg-[var(--raised)] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-foreground">
                                                {item.kind === 'pdf' ? 'PDF' : 'IMG'}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
                                            {item.status === 'compressing' ? (
                                                <span className="inline-flex items-center gap-1 text-[var(--accent)]">
                                                    <Loader2 className="size-3 animate-spin" />
                                                    Mengompresi gambar…
                                                </span>
                                            ) : (
                                                <span>{formatSize(item.compressedSize)}</span>
                                            )}

                                            {savedPct > 3 && item.status !== 'compressing' && (
                                                <span className="rounded bg-[var(--pill-positive-bg)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--pill-positive-ink)]">
                                                    dari {formatSize(item.originalSize)} (-{savedPct}%)
                                                </span>
                                            )}

                                            {item.status === 'uploading' && (
                                                <span className="text-[var(--accent)] font-medium">
                                                    Mengunggah {item.progress}%
                                                </span>
                                            )}
                                            {item.status === 'done' && (
                                                <span className="inline-flex items-center gap-1 text-[var(--positive)] font-medium">
                                                    <CheckCircle2 className="size-3" />
                                                    Terunggah
                                                </span>
                                            )}
                                            {item.status === 'error' && (
                                                <span className="inline-flex items-center gap-1 text-[var(--negative)]">
                                                    <AlertCircle className="size-3" />
                                                    {item.error ?? 'Gagal'}
                                                </span>
                                            )}
                                        </div>

                                        {item.status === 'uploading' && (
                                            <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--raised)]">
                                                <div
                                                    className="h-full bg-[var(--accent)] transition-all duration-150"
                                                    style={{ width: `${item.progress}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {item.status !== 'uploading' && item.status !== 'done' && (
                                        <button
                                            type="button"
                                            onClick={() => removeItem(item.id)}
                                            disabled={disabled}
                                            aria-label={`Hapus ${item.file.name}`}
                                            className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--raised)] hover:text-foreground"
                                        >
                                            <X className="size-4" />
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}
