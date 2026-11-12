'use client';

import { useState, useTransition } from 'react';
import { reportAction } from './actions';
import type { Transition } from '@/lib/domain/report-detail';
import { Button } from '@/components/ui/button';

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
            <Button
                type="button"
                variant={primary ? 'default' : 'outline'}
                className="h-9 px-3"
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
            >
                {pending ? 'Memproses…' : label}
            </Button>
            {error && (
                <span className="text-[12px] text-[var(--negative)]">
                    {error}
                </span>
            )}
        </div>
    );
}
