'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarChart3, Table2 } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export type DistributionItem = {
    key: string;
    label: string;
    count: number;
    href?: string;
};

/**
 * Horizontal magnitude bar chart with direct right-hand numeric labels,
 * single-hue encoding (--viz-1), 4px rounded data-ends, hover highlight, and an
 * accessible table toggle.
 */
export function DistributionChart({
    items,
    emptyText = 'Belum ada data untuk ditampilkan.',
    valueLabel = 'laporan',
}: {
    items: DistributionItem[];
    emptyText?: string;
    valueLabel?: string;
}) {
    const [view, setView] = useState<'chart' | 'table'>('chart');
    const total = items.reduce((sum, item) => sum + item.count, 0);
    const max = Math.max(...items.map((item) => item.count), 1);

    if (items.length === 0 || total === 0) {
        return (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
                {emptyText}
            </p>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
                <span data-numeric className="tabular-nums">
                    Total{' '}
                    <span className="font-semibold text-foreground">
                        {formatNumber(total)}
                    </span>{' '}
                    {valueLabel}
                </span>

                <div
                    role="group"
                    aria-label="Mode tampilan distribusi"
                    className="inline-flex rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-0.5"
                >
                    <button
                        type="button"
                        onClick={() => setView('chart')}
                        aria-pressed={view === 'chart'}
                        className={cn(
                            'inline-flex h-6 items-center gap-1 rounded-[6px] px-2 text-[11.5px] font-medium transition-colors',
                            view === 'chart'
                                ? 'bg-[var(--surface)] text-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <BarChart3 className="size-3" aria-hidden />
                        Grafik
                    </button>
                    <button
                        type="button"
                        onClick={() => setView('table')}
                        aria-pressed={view === 'table'}
                        className={cn(
                            'inline-flex h-6 items-center gap-1 rounded-[6px] px-2 text-[11.5px] font-medium transition-colors',
                            view === 'table'
                                ? 'bg-[var(--surface)] text-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Table2 className="size-3" aria-hidden />
                        Tabel
                    </button>
                </div>
            </div>

            {view === 'chart' ? (
                <ul className="space-y-2.5">
                    {items.map((item, idx) => {
                        const widthPct =
                            item.count === 0
                                ? 0
                                : Math.max(4, Math.round((item.count / max) * 100));
                        const sharePct = Math.round((item.count / total) * 100);
                        const vizColor = `var(--viz-${(idx % 4) + 1})`;

                        return (
                            <li
                                key={item.key}
                                className="group rounded-[var(--radius-control)] px-1.5 py-1 transition-colors hover:bg-[var(--raised)]/60"
                            >
                                <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span
                                            aria-hidden
                                            className="size-2 shrink-0 rounded-full"
                                            style={{ backgroundColor: vizColor }}
                                        />
                                        {item.href ? (
                                            <Link
                                                href={item.href}
                                                className="truncate font-medium text-foreground underline-offset-4 hover:text-[var(--accent)] hover:underline"
                                            >
                                                {item.label}
                                            </Link>
                                        ) : (
                                            <span className="truncate font-medium text-foreground">
                                                {item.label}
                                            </span>
                                        )}
                                    </div>
                                    <span
                                        data-numeric
                                        className="shrink-0 text-[12.5px] text-muted-foreground tabular-nums"
                                    >
                                        <span className="font-semibold text-foreground">
                                            {formatNumber(item.count)}
                                        </span>{' '}
                                        <span className="text-[11.5px]">
                                            ({sharePct}%)
                                        </span>
                                    </span>
                                </div>
                                <div className="h-3 w-full rounded-[3px] bg-[var(--raised)]/70 overflow-hidden">
                                    <div
                                        className="h-full rounded-r-[4px] transition-[width] duration-300"
                                        style={{
                                            width: `${widthPct}%`,
                                            backgroundColor: vizColor,
                                        }}
                                        aria-hidden
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <div className="overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)]">
                    <table className="ledger">
                        <thead>
                            <tr>
                                <th scope="col">Kategori</th>
                                <th scope="col" className="text-right">
                                    Jumlah
                                </th>
                                <th scope="col" className="text-right">
                                    Porsi
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.key}>
                                    <td>{item.label}</td>
                                    <td className="num font-medium">
                                        {formatNumber(item.count)}
                                    </td>
                                    <td className="num text-muted-foreground">
                                        {Math.round((item.count / total) * 100)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
