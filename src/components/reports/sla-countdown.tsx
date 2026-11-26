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
    compact?: boolean;
};

const ID_INT = new Intl.NumberFormat('id-ID');
const DEADLINE_FMT = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
});

function formatRemaining(ms: number) {
    const abs = Math.abs(ms);
    const totalHours = Math.floor(abs / 3_600_000);
    const mins = Math.floor((abs % 3_600_000) / 60_000);
    return `${ID_INT.format(totalHours)}j ${mins}m`;
}

export function SlaCountdown({
    status,
    assignedAt,
    acceptedAt,
    createdAt,
    compact = false,
}: Props) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => window.clearInterval(timer);
    }, []);

    let label: string | null = null;
    let shortLabel: string | null = null;
    let deadlineMs: number | null = null;

    if (status === 'ASSIGNED') {
        const start = new Date(assignedAt ?? createdAt).getTime();
        deadlineMs = start + 24 * 3_600_000;
        label = 'SLA Terima (24j)';
        shortLabel = '24j';
    } else if (status === 'ASSIGNED_ACCEPTED' || status === 'PE_IN_PROGRESS') {
        const start = new Date(acceptedAt ?? createdAt).getTime();
        deadlineMs = start + 72 * 3_600_000;
        label = 'SLA PE (72j)';
        shortLabel = '72j';
    }

    if (!label || !deadlineMs) return null;

    const diff = deadlineMs - now;
    const overdue = diff < 0;
    const warning = !overdue && diff < 6 * 3_600_000;
    const deadlineText = DEADLINE_FMT.format(new Date(deadlineMs));

    return (
        <div
            title={`Batas waktu ${label}: ${deadlineText} WIB`}
            className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-r-[4px] border-l-2 py-0.5 pr-2 pl-2 text-[12px] font-medium transition-colors duration-200 ease-out',
                overdue
                    ? 'border-l-[var(--negative)] bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)]'
                    : warning
                      ? 'border-l-[var(--warning)] bg-[var(--pill-warning-bg)] text-[var(--pill-warning-ink)]'
                      : 'border-l-[var(--accent)] bg-[var(--raised)] text-muted-foreground',
            )}
        >
            <Clock
                className="size-3.5 shrink-0"
                strokeWidth={1.5}
                aria-hidden
            />
            <span className="font-mono text-[12px] whitespace-nowrap tabular-nums">
                {compact ? `${shortLabel} · ` : `${label}: `}
                {overdue
                    ? `Lewat ${formatRemaining(diff)}`
                    : `Sisa ${formatRemaining(diff)}`}
            </span>
        </div>
    );
}
