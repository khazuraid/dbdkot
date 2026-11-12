'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

type Uploaded = { id: string; fileName: string };

/**
 * Attachment picker for an existing report. The file list and limits mirror
 * src/lib/attachments.ts; that module remains the authority — this only stops
 * an obviously wrong file before it is sent.
 */
export function AttachmentDropzone({ reportRSId }: { reportRSId: string }) {
    const [uploaded, setUploaded] = useState<Uploaded[]>([]);
    const [busy, setBusy] = useState(false);

    const onDrop = useCallback(
        async (accepted: File[]) => {
            setBusy(true);

            for (const file of accepted) {
                const body = new FormData();
                body.set('file', file);
                body.set('reportRSId', reportRSId);

                const res = await fetch('/api/attachments', {
                    method: 'POST',
                    body,
                });

                if (!res.ok) {
                    const { error } = (await res.json().catch(() => ({}))) as {
                        error?: string;
                    };
                    toast.error(`Gagal mengunggah ${file.name}`, {
                        description: error,
                    });
                    continue;
                }

                const saved = (await res.json()) as Uploaded;
                setUploaded((prev) => [...prev, saved]);
            }

            setBusy(false);
        },
        [reportRSId],
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
                    PDF, JPG, PNG, atau WEBP · maks 10 MB
                </p>
                <Button
                    type="button"
                    variant="outline"
                    className="mt-2"
                    onClick={open}
                    disabled={busy}
                >
                    {busy ? 'Mengunggah…' : 'Pilih berkas'}
                </Button>
            </div>

            {uploaded.length > 0 && (
                <ul aria-live="polite" className="mt-3 space-y-1 text-[13px]">
                    {uploaded.map((u) => (
                        <li key={u.id} className="truncate">
                            {u.fileName}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
