import type { StatusTone } from '@/lib/domain/account-labels';
import { cn } from '@/lib/utils';

const TONE: Record<StatusTone, { wrap: string; dot: string }> = {
    neutral: {
        wrap: 'text-muted-foreground',
        dot: 'bg-muted-foreground/70',
    },
    good: {
        wrap: 'text-[var(--positive)]',
        dot: 'bg-[var(--positive)]',
    },
    warn: {
        wrap: 'rounded-[6px] border border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] px-2 py-0.5 text-[var(--pill-warning-ink)]',
        dot: 'bg-[var(--warning)]',
    },
    bad: {
        wrap: 'rounded-[6px] border border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] px-2 py-0.5 text-[var(--pill-negative-ink)]',
        dot: 'bg-[var(--negative)]',
    },
};

/**
 * Calm clinical status indicator: 6px dot + crisp 12px text for routine states,
 * reserving tinted semantic chips exclusively for warning/overdue escalation.
 */
export function StatusText({
    tone,
    children,
}: {
    tone: StatusTone;
    children: React.ReactNode;
}) {
    const style = TONE[tone];
    return (
        <span
            className={cn(
                'inline-flex h-6 shrink-0 items-center gap-1.5 text-[12px] leading-none font-medium whitespace-nowrap',
                style.wrap,
            )}
        >
            <span
                aria-hidden
                className={cn('size-1.5 shrink-0 rounded-full', style.dot)}
            />
            {children}
        </span>
    );
}
