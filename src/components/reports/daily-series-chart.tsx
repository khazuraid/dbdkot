'use client';

import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

/**
 * Daily submissions for the last 14 days. Recharts replaces the hand-built
 * div bars: the tooltip, the axis, and keyboard/screen-reader access to each
 * value all come with it instead of being re-implemented per dashboard.
 *
 * The chart is summarised in text for assistive tech — a canvas/SVG chart is
 * otherwise silent — and the bars carry the only colour on the screen.
 */
export function DailySeriesChart({
    data,
}: {
    data: { day: string; n: number }[];
}) {
    const total = data.reduce((sum, d) => sum + d.n, 0);
    const peak = data.reduce(
        (best, d) => (d.n > best.n ? d : best),
        data[0] ?? { day: '', n: 0 },
    );

    return (
        <figure>
            <div className="h-56" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{ top: 8, right: 0, bottom: 0, left: -24 }}
                        barCategoryGap={4}
                    >
                        <CartesianGrid
                            vertical={false}
                            stroke="var(--rule)"
                        />
                        <XAxis
                            dataKey="day"
                            tickFormatter={(v: string) => v.slice(5)}
                            tickLine={false}
                            axisLine={false}
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
                            cursor={{ fill: 'var(--raised)' }}
                            contentStyle={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-card)',
                                fontSize: 13,
                            }}
                            labelFormatter={(v) => `Tanggal ${v}`}
                            formatter={(value) => [`${value} laporan`, '']}
                        />
                        <Bar
                            dataKey="n"
                            fill="var(--data)"
                            radius={[2, 2, 0, 0]}
                            isAnimationActive={false}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <figcaption className="sr-only">
                Grafik batang laporan masuk per hari selama 14 hari terakhir.
                Total {total} laporan; puncak {peak.n} pada {peak.day}.
            </figcaption>
        </figure>
    );
}
