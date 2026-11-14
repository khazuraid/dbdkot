import type { StatusTone } from '@/lib/domain/account-labels';
import { cn } from '@/lib/utils';

const TONE: Record<StatusTone, string> = {
    neutral:
        'border-[var(--pill-neutral-border)] bg-[var(--pill-neutral-bg)] text-[var(--pill-neutral-ink)]',
    good: 'border-[var(--pill-positive-border)] bg-[var(--pill-positive-bg)] text-[var(--pill-positive-ink)]',
    warn: 'border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] text-[var(--pill-warning-ink)]',
    bad: 'border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)]',
};

/**
 * Status pill with hairline border, dot signifier, and accessible contrast.
 */
export function StatusText({
    tone,
    children,
}: {
    tone: StatusTone;
    children: React.ReactNode;
}) {
    return (
        <span
            className={cn(
                'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 text-[11.5px] font-medium whitespace-nowrap',
                TONE[tone],
            )}
        >
            <span
                aria-hidden
                className="size-1.5 rounded-full bg-current opacity-80"
            />
            {children}
        </span>
    );
}
