'use client';

import { useState } from 'react';
import { AreaChart as AreaChartIcon, Table2 } from 'lucide-react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

type DayPoint = { day: string; n: number };

function ChartTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: { value?: number }[];
    label?: string;
}) {
    if (!active || !payload?.length) return null;
    const value = Number(payload[0]?.value ?? 0);
    const parsed = label ? new Date(`${label}T00:00:00+07:00`) : null;
    const dateText =
        parsed && !Number.isNaN(parsed.getTime())
            ? formatDate(parsed)
            : (label ?? '');

    return (
        <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-[var(--elev-pop)]">
            <p
                data-numeric
                className="font-mono text-[14px] leading-tight font-medium text-foreground tabular-nums"
            >
                {formatNumber(value)} laporan
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">{dateText}</p>
        </div>
    );
}

/**
 * 14-day submission volume area chart with an accessible table view toggle and
 * clean empty state.
 */
export function DailySeriesChart({ data }: { data: DayPoint[] }) {
    const [view, setView] = useState<'chart' | 'table'>('chart');
    const total = data.reduce((sum, d) => sum + d.n, 0);
    const peak = data.reduce(
        (best, d) => (d.n > best.n ? d : best),
        data[0] ?? { day: '', n: 0 },
    );

    if (data.length === 0 || total === 0) {
        return (
            <div className="flex h-[280px] items-center justify-center rounded-[var(--radius-control)] border border-dashed border-[var(--border)] bg-[var(--raised)]/35 px-4 text-center">
                <p className="max-w-[38ch] text-[13px] text-muted-foreground">
                    Belum ada laporan masuk dalam 14 hari terakhir pada cakupan
                    wilayah Anda
                </p>
            </div>
        );
    }

    return (
        <figure className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
                <p data-numeric className="tabular-nums">
                    Total{' '}
                    <span className="font-mono font-medium text-foreground">
                        {formatNumber(total)}
                    </span>{' '}
                    laporan · puncak{' '}
                    <span className="font-mono font-medium text-foreground">
                        {formatNumber(peak.n)}
                    </span>{' '}
                    pada{' '}
                    <span className="font-mono text-foreground">
                        {peak.day.slice(5)}
                    </span>
                </p>

                <div
                    role="group"
                    aria-label="Mode tampilan data harian"
                    className="inline-flex rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-0.5"
                >
                    <button
                        type="button"
                        onClick={() => setView('chart')}
                        aria-pressed={view === 'chart'}
                        className={cn(
                            'inline-flex h-8 touch-manipulation items-center gap-1.5 rounded-[6px] px-2 text-[12px] font-medium transition-colors duration-150 sm:h-7',
                            view === 'chart'
                                ? 'bg-[var(--surface)] text-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <AreaChartIcon
                            className="size-4"
                            strokeWidth={1.5}
                            aria-hidden
                        />
                        Grafik
                    </button>
                    <button
                        type="button"
                        onClick={() => setView('table')}
                        aria-pressed={view === 'table'}
                        className={cn(
                            'inline-flex h-8 touch-manipulation items-center gap-1.5 rounded-[6px] px-2 text-[12px] font-medium transition-colors duration-150 sm:h-7',
                            view === 'table'
                                ? 'bg-[var(--surface)] text-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Table2
                            className="size-4"
                            strokeWidth={1.5}
                            aria-hidden
                        />
                        Tabel
                    </button>
                </div>
            </div>

            {view === 'chart' ? (
                <div className="h-[280px]" aria-hidden>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            accessibilityLayer
                            data={data}
                            margin={{ top: 8, right: 8, bottom: 0, left: -24 }}
                        >
                            <defs>
                                <linearGradient
                                    id="dailyGradient"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="5%"
                                        stopColor="var(--accent)"
                                        stopOpacity={0.18}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor="var(--accent)"
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                vertical={false}
                                stroke="var(--rule)"
                            />
                            <XAxis
                                dataKey="day"
                                tickFormatter={(v: string) => v.slice(5)}
                                tickLine={false}
                                axisLine={{ stroke: 'var(--border)' }}
                                tick={{
                                    fill: 'var(--muted)',
                                    fontSize: 11,
                                    fontFamily:
                                        'var(--font-geist-mono), monospace',
                                }}
                                interval="preserveStartEnd"
                                minTickGap={24}
                            />
                            <YAxis
                                allowDecimals={false}
                                tickLine={false}
                                axisLine={false}
                                tick={{
                                    fill: 'var(--muted)',
                                    fontSize: 11,
                                    fontFamily:
                                        'var(--font-geist-mono), monospace',
                                }}
                                width={48}
                            />
                            <Tooltip
                                cursor={{
                                    stroke: 'var(--border)',
                                    strokeWidth: 1,
                                    strokeDasharray: '4 4',
                                }}
                                content={<ChartTooltip />}
                            />
                            <Area
                                type="monotone"
                                dataKey="n"
                                stroke="var(--accent)"
                                strokeWidth={2}
                                fill="url(#dailyGradient)"
                                activeDot={{
                                    r: 4,
                                    fill: 'var(--accent)',
                                    stroke: 'var(--surface)',
                                    strokeWidth: 2,
                                }}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="max-h-[280px] overflow-y-auto rounded-[var(--radius-control)] border border-[var(--border)]">
                    <table className="ledger">
                        <thead>
                            <tr>
                                <th scope="col">Tanggal</th>
                                <th scope="col" className="text-right">
                                    Laporan
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((d) => (
                                <tr key={d.day}>
                                    <td className="font-mono text-[12px]">
                                        {d.day}
                                    </td>
                                    <td className="num font-mono font-medium">
                                        {formatNumber(d.n)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <figcaption className="sr-only">
                Grafik tren laporan masuk per hari selama 14 hari terakhir.
                Total {total} laporan; puncak {peak.n} pada {peak.day}.
            </figcaption>
        </figure>
    );
}
