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
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-[var(--elev-pop)]">
            <p
                data-numeric
                className="text-[14px] leading-tight font-semibold text-foreground tabular-nums"
            >
                {formatNumber(value)} laporan
            </p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                {dateText}
            </p>
        </div>
    );
}

/**
 * 14-day submission volume bar chart with an accessible table view toggle and
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
            <div className="flex h-52 items-center justify-center rounded-[var(--radius-control)] border border-dashed border-[var(--border)] bg-[var(--raised)]/35 px-4 text-center">
                <p className="max-w-[38ch] text-[13px] text-muted-foreground">
                    Belum ada laporan masuk dalam 14 hari terakhir pada cakupan
                    wilayah Anda.
                </p>
            </div>
        );
    }

    return (
        <figure className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
                <p data-numeric className="tabular-nums">
                    Total{' '}
                    <span className="font-semibold text-foreground">
                        {formatNumber(total)}
                    </span>{' '}
                    laporan, puncak{' '}
                    <span className="font-semibold text-foreground">
                        {formatNumber(peak.n)}
                    </span>{' '}
                    pada {peak.day.slice(5)}
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
                            'inline-flex h-8 sm:h-6 items-center gap-1.5 sm:gap-1 rounded-[6px] px-2.5 sm:px-2 text-[12px] sm:text-[11.5px] font-medium transition-colors touch-manipulation',
                            view === 'chart'
                                ? 'bg-[var(--surface)] text-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <AreaChartIcon className="size-3.5 sm:size-3" aria-hidden />
                        Grafik
                    </button>
                    <button
                        type="button"
                        onClick={() => setView('table')}
                        aria-pressed={view === 'table'}
                        className={cn(
                            'inline-flex h-8 sm:h-6 items-center gap-1.5 sm:gap-1 rounded-[6px] px-2.5 sm:px-2 text-[12px] sm:text-[11.5px] font-medium transition-colors touch-manipulation',
                            view === 'table'
                                ? 'bg-[var(--surface)] text-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Table2 className="size-3.5 sm:size-3" aria-hidden />
                        Tabel
                    </button>
                </div>
            </div>

            {view === 'chart' ? (
                <div className="h-56" aria-hidden>
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
                                        stopColor="var(--viz-1)"
                                        stopOpacity={0.2}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor="var(--viz-1)"
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
                                tick={{ fill: 'var(--muted)', fontSize: 12 }}
                                interval="preserveStartEnd"
                                minTickGap={24}
                            />
                            <YAxis
                                allowDecimals={false}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: 'var(--muted)', fontSize: 12 }}
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
                                stroke="var(--viz-1)"
                                strokeWidth={2}
                                fill="url(#dailyGradient)"
                                activeDot={{
                                    r: 4.5,
                                    fill: 'var(--viz-1)',
                                    stroke: 'var(--surface)',
                                    strokeWidth: 2,
                                }}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="max-h-56 overflow-y-auto rounded-[var(--radius-control)] border border-[var(--border)]">
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
                                    <td className="font-mono text-[12.5px]">
                                        {d.day}
                                    </td>
                                    <td className="num font-medium">
                                        {formatNumber(d.n)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <figcaption className="sr-only">
                Grafik batang laporan masuk per hari selama 14 hari terakhir.
                Total {total} laporan; puncak {peak.n} pada {peak.day}.
            </figcaption>
        </figure>
    );
}
