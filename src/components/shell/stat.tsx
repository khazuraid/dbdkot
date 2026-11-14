import { formatNumber } from '@/lib/format';
import type { StatusTone } from '@/lib/domain/account-labels';
import { cn } from '@/lib/utils';

/**
 * KPI stat card with tabular figure, muted label, and optional icon chip.
 */
export function Stat({
    label,
    value,
    unit,
    signal,
    hint,
    icon: Icon,
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

    const chip =
        signal === 'bad'
            ? 'bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)]'
            : signal === 'warn'
              ? 'bg-[var(--pill-warning-bg)] text-[var(--pill-warning-ink)]'
              : signal === 'good'
                ? 'bg-[var(--pill-positive-bg)] text-[var(--pill-positive-ink)]'
                : 'bg-[var(--accent-soft)] text-[var(--accent)]';

    return (
        <div className="surface min-w-0 p-4">
            <div className="flex items-start justify-between gap-3">
                <dt className="eyebrow pt-1">{label}</dt>
                {Icon && (
                    <span
                        aria-hidden
                        className={cn(
                            'grid size-8 shrink-0 place-items-center rounded-[9px]',
                            chip,
                        )}
                    >
                        <Icon className="size-4" strokeWidth={1.75} />
                    </span>
                )}
            </div>
            <dd
                data-numeric
                className={cn(
                    'mt-2.5 text-[28px] leading-none font-semibold tracking-[-0.03em] tabular-nums sm:text-[var(--fs-kpi)]',
                    tone,
                )}
            >
                {typeof value === 'number' ? formatNumber(value) : value}
                {unit && (
                    <span className="ml-1.5 text-[14px] font-medium text-muted-foreground">
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
                'grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4',
                className,
            )}
        >
            {children}
        </dl>
    );
}
