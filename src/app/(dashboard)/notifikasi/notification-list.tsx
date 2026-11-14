'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCheck, Mail, MailOpen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { StatusText } from '@/components/shell/status-text';
import {
    deleteNotificationAction,
    markAllReadAction,
    toggleNotificationAction,
} from '@/app/(dashboard)/actions';

export type NotificationRow = {
    id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: Date;
};

const TYPE_LABEL: Record<string, string> = {
    ASSIGNMENT: 'Penugasan',
    VERIFICATION: 'Verifikasi',
    REJECTION: 'Penolakan',
    SLA: 'SLA',
    SYSTEM: 'Sistem',
};

/**
 * The notification list, with the three writes it needs: mark one read (or back
 * to unread), mark every one read, and dismiss. Each row is a real record, so
 * the operations are per-row and the list refreshes from the server afterwards
 * rather than being mutated in local state.
 */
export function NotificationList({
    rows,
    unreadTotal,
}: {
    rows: NotificationRow[];
    unreadTotal: number;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [busy, setBusy] = useState<string | null>(null);

    function run(
        key: string,
        work: () => Promise<{ ok: boolean; error?: string }>,
        success: string,
    ) {
        setBusy(key);
        startTransition(async () => {
            const result = await work();
            setBusy(null);
            if (!result.ok) {
                toast.error(result.error ?? 'Gagal menyimpan.');
                return;
            }
            toast.success(success);
            router.refresh();
        });
    }

    if (rows.length === 0) {
        return (
            <div className="px-4 py-14 text-center">
                <p className="mx-auto max-w-[46ch] text-[13px] text-muted-foreground">
                    Belum ada notifikasi. Pemberitahuan muncul di sini saat
                    laporan ditugaskan atau diverifikasi.
                </p>
            </div>
        );
    }

    const disabled = pending || busy !== null;

    return (
        <>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--raised)] px-4 py-2">
                <p className="text-[12px] text-muted-foreground">
                    {unreadTotal > 0
                        ? `${unreadTotal} belum dibaca`
                        : 'Semua sudah dibaca'}
                </p>
                {unreadTotal > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        onClick={() =>
                            run(
                                'all',
                                markAllReadAction,
                                'Semua ditandai sudah dibaca.',
                            )
                        }
                    >
                        <CheckCheck /> Tandai semua dibaca
                    </Button>
                )}
            </div>

            <ul className="divide-y divide-[var(--rule)]">
                {rows.map((n) => (
                    <li
                        key={n.id}
                        className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--raised)]"
                    >
                        <span
                            aria-hidden
                            className={`mt-[9px] size-2 shrink-0 rounded-full ${
                                n.isRead
                                    ? 'bg-[var(--control)]'
                                    : 'bg-[var(--accent)]'
                            }`}
                        />

                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <p
                                    className={
                                        n.isRead
                                            ? 'text-[13.5px] text-muted-foreground'
                                            : 'text-[13.5px] font-semibold'
                                    }
                                >
                                    {n.title}
                                </p>
                                <StatusText
                                    tone={n.isRead ? 'neutral' : 'good'}
                                >
                                    {TYPE_LABEL[n.type] ?? n.type}
                                </StatusText>
                            </div>
                            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                                {n.message}
                            </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={
                                    n.isRead
                                        ? 'Tandai belum dibaca'
                                        : 'Tandai sudah dibaca'
                                }
                                disabled={disabled}
                                onClick={() =>
                                    run(
                                        n.id,
                                        () =>
                                            toggleNotificationAction(
                                                n.id,
                                                !n.isRead,
                                            ),
                                        n.isRead
                                            ? 'Ditandai belum dibaca.'
                                            : 'Ditandai sudah dibaca.',
                                    )
                                }
                            >
                                {n.isRead ? <Mail /> : <MailOpen />}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Hapus notifikasi"
                                disabled={disabled}
                                className="text-muted-foreground hover:text-[var(--negative)]"
                                onClick={() =>
                                    run(
                                        `del-${n.id}`,
                                        () => deleteNotificationAction(n.id),
                                        'Notifikasi dihapus.',
                                    )
                                }
                            >
                                <Trash2 />
                            </Button>
                        </div>
                    </li>
                ))}
            </ul>
        </>
    );
}
