'use client';

import { useState, useTransition } from 'react';
import { reportAction } from './actions';
import type { Transition } from '@/lib/domain/report-detail';

const MESSAGE: Record<string, string> = {
    NOT_FOUND: 'Laporan tidak ditemukan.',
    FORBIDDEN: 'Anda tidak berwenang untuk tindakan ini.',
    ILLEGAL_STATE: 'Status laporan sudah berubah. Muat ulang halaman.',
};

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

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                type="button"
                disabled={pending}
                onClick={() =>
                    start(async () => {
                        const result = await reportAction(id, transition);

                        if (result.ok) {
                            setError(null);
                        } else {
                            setError(
                                'reason' in result
                                    ? (MESSAGE[result.reason] ?? 'Gagal.')
                                    : result.error,
                            );
                        }
                    })
                }
                className={
                    primary
                        ? 'h-9 rounded-md bg-primary px-3 text-[14px] font-medium text-primary-foreground disabled:opacity-50'
                        : 'border-control h-9 rounded-md border px-3 text-[14px] hover:bg-[var(--raised)] disabled:opacity-50'
                }
            >
                {pending ? 'Memproses…' : label}
            </button>
            {error && (
                <span className="text-[12px] text-[var(--negative)]">
                    {error}
                </span>
            )}
        </div>
    );
}
