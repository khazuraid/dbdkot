import { formatNumber } from '@/lib/format';
import type { StatusTone } from '@/lib/domain/account-labels';

/**
 * A KPI: label in grey, figure in ink at statement size. No tile, no icon, no
 * sparkline — the study's screens carry KPIs as type and colour data instead.
 */
export function Stat({
    label,
    value,
    signal,
}: {
    label: string;
    value: number | string;
    signal?: StatusTone;
}) {
    const tone =
        signal === 'bad'
            ? 'text-[var(--negative)]'
            : signal === 'warn'
              ? 'text-[var(--warning)]'
              : 'text-foreground';

    return (
        <div className="min-w-0">
            <dt className="text-[12px] text-muted-foreground">{label}</dt>
            <dd
                className={`mt-1.5 text-[28px] font-medium leading-none tracking-[-0.02em] tabular-nums md:text-[30px] ${tone}`}
            >
                {typeof value === 'number' ? formatNumber(value) : value}
            </dd>
        </div>
    );
}

/**
 * The KPI strip: one white surface, cells divided by hairlines, so the figures
 * read as one row of the same table rather than four floating labels. Below
 * `lg` the dividers become a 2x2 grid with the rules redrawn on the cell edges.
 */
export function StatRow({ children }: { children: React.ReactNode }) {
    return (
        <dl
            className={
                'mt-8 grid grid-cols-2 overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface lg:grid-cols-4 ' +
                // Rules drawn on the cell itself, so no wrapper element is
                // needed. Each width then only adds the neutralisers it needs:
                // below `lg` the 2nd column and the top row drop their lines.
                '[&>div]:border-[var(--rule)] [&>div]:px-4 [&>div]:py-5 ' +
                '[&>div]:not-last:border-r [&>div]:nth-[n+3]:border-t ' +
                'lg:[&>div]:nth-[2n]:border-r'
            }
        >
            {children}
        </dl>
    );
}
