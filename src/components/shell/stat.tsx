import { formatNumber } from '@/lib/format';
import type { StatusTone } from '@/lib/domain/account-labels';
import { cn } from '@/lib/utils';

/**
 * KPI stat card with tabular mono figure, muted label, and quiet semantic dot.
 */
export function Stat({
    label,
    value,
    unit,
    signal,
    hint,
}: {
    label: string;
    value: number | string;
    unit?: string;
    signal?: StatusTone;
    hint?: React.ReactNode;
    icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
    const tone =
        signal === 'bad'
            ? 'text-[var(--negative)]'
            : signal === 'warn'
              ? 'text-[var(--warning)]'
              : signal === 'good'
                ? 'text-[var(--positive)]'
                : 'text-foreground';

    const dot =
        signal === 'bad'
            ? 'bg-[var(--negative)]'
            : signal === 'warn'
              ? 'bg-[var(--warning)]'
              : signal === 'good'
                ? 'bg-[var(--positive)]'
                : null;

    return (
        <div className="surface min-w-0 p-5">
            <dt className="eyebrow flex items-center gap-2">
                {dot && (
                    <span
                        aria-hidden
                        className={cn('size-1.5 shrink-0 rounded-full', dot)}
                    />
                )}
                <span className="truncate">{label}</span>
            </dt>
            <dd
                data-numeric
                className={cn(
                    'mt-2 font-mono text-[28px] leading-none font-medium tracking-[-0.02em] tabular-nums sm:text-[var(--fs-kpi)]',
                    tone,
                )}
            >
                {typeof value === 'number' ? formatNumber(value) : value}
                {unit && (
                    <span className="ml-1.5 font-sans text-[14px] font-normal text-muted-foreground">
                        {unit}
                    </span>
                )}
            </dd>
            {hint && (
                <p className="mt-2 truncate text-[12px] text-muted-foreground">
                    {hint}
                </p>
            )}
        </div>
    );
}

/**
 * Responsive 1 → 2 → 4 KPI grid so large tabular metrics never clip on phone
 * viewports.
 */
export function StatRow({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <dl
            className={cn(
                'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4',
                className,
            )}
        >
            {children}
        </dl>
    );
}
