'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import type { ReportStatus } from '@/lib/domain/report-labels';
import { cn } from '@/lib/utils';

type Props = {
    status: ReportStatus;
    assignedAt: string | Date | null;
    acceptedAt: string | Date | null;
    createdAt: string | Date;
};

function formatRemaining(ms: number) {
    const abs = Math.abs(ms);
    const totalHours = Math.floor(abs / 3_600_000);
    const mins = Math.floor((abs % 3_600_000) / 60_000);
    return `${totalHours}j ${mins}m`;
}

export function SlaCountdown({
    status,
    assignedAt,
    acceptedAt,
    createdAt,
}: Props) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => window.clearInterval(timer);
    }, []);

    let label: string | null = null;
    let deadlineMs: number | null = null;

    if (status === 'ASSIGNED') {
        const start = new Date(assignedAt ?? createdAt).getTime();
        deadlineMs = start + 24 * 3_600_000;
        label = 'SLA Terima Puskesmas (24j)';
    } else if (status === 'ASSIGNED_ACCEPTED' || status === 'PE_IN_PROGRESS') {
        const start = new Date(acceptedAt ?? createdAt).getTime();
        deadlineMs = start + 72 * 3_600_000;
        label = 'SLA Penyelidikan Epidemiologi (72j)';
    }

    if (!label || !deadlineMs) return null;

    const diff = deadlineMs - now;
    const overdue = diff < 0;
    const warning = !overdue && diff < 6 * 3_600_000;

    return (
        <div
            className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium tabular-nums',
                overdue
                    ? 'border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)]'
                    : warning
                      ? 'border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] text-[var(--pill-warning-ink)]'
                      : 'border-[var(--pill-info-border)] bg-[var(--pill-info-bg)] text-[var(--pill-info-ink)]',
            )}
        >
            <Clock className="size-3.5 shrink-0" aria-hidden />
            <span>
                {label}:{' '}
                {overdue
                    ? `Lewat ${formatRemaining(diff)}`
                    : `Sisa ${formatRemaining(diff)}`}
            </span>
        </div>
    );
}
