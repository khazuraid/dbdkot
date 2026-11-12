import type { StatusTone } from '@/lib/domain/account-labels';

const TONE: Record<StatusTone, { bg: string; ink: string; dot?: boolean }> = {
    neutral: {
        bg: 'var(--pill-neutral-bg)',
        ink: 'var(--pill-neutral-ink)',
        // A neutral state is monochrome with a glyph, so "Nonaktif" reads as
        // off rather than as a quiet kind of good.
        dot: true,
    },
    good: { bg: 'var(--pill-positive-bg)', ink: 'var(--pill-positive-ink)' },
    warn: { bg: 'var(--pill-warning-bg)', ink: 'var(--pill-warning-ink)' },
    bad: { bg: 'var(--pill-negative-bg)', ink: 'var(--pill-negative-ink)' },
};

/**
 * A status pill: a pale tint with dark ink of the same hue (§7.6). 20px tall,
 * 12px at 500, `flex: none` so it never stretches in a table cell. The chrome
 * stays achromatic around it, so the tint reads as the state it means.
 */
export function StatusText({
    tone,
    children,
}: {
    tone: StatusTone;
    children: React.ReactNode;
}) {
    const { bg, ink, dot } = TONE[tone];

    return (
        <span
            className="inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[12px] font-medium"
            style={{ background: bg, color: ink }}
        >
            {dot && (
                <span
                    aria-hidden
                    className="size-1.5 rounded-full bg-current opacity-60"
                />
            )}
            {children}
        </span>
    );
}
