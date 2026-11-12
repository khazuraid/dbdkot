import Link from 'next/link';

/**
 * One page frame for every screen. The gutter and the top/bottom rhythm were
 * copied by hand into 16 pages; keeping them here means the mobile inset
 * (16px) can differ from the desktop one (24px) without touching each page.
 */
export function PageBody({ children }: { children: React.ReactNode }) {
    return (
        <div className="px-4 py-6 pb-16 md:px-[var(--pad)] md:py-8">
            {children}
        </div>
    );
}

/**
 * Title, one factual line under it, at most one primary action. The context
 * line states the data (count, period, scope), never the interface.
 */
export function PageHeader({
    title,
    context,
    action,
    aside,
}: {
    title: string;
    context?: React.ReactNode;
    action?: { href: string; label: string };
    aside?: React.ReactNode;
}) {
    return (
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-[22px] font-semibold leading-7 tracking-[-0.02em] md:text-[24px]">
                        {title}
                    </h1>
                    {aside}
                </div>
                {context && (
                    <p className="mt-1 text-[14px] text-muted-foreground">
                        {context}
                    </p>
                )}
            </div>
            {action && (
                <Link
                    href={action.href}
                    className="grid h-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-primary px-3.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text)]/20"
                >
                    {action.label}
                </Link>
            )}
        </header>
    );
}

/**
 * A ruled section: heading, optional meta, then the content. No card, no
 * shadow — separation from the section above is spacing plus a tone step.
 */
export function Panel({
    title,
    aside,
    children,
}: {
    title: React.ReactNode;
    aside?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
                    {title}
                </h2>
                {aside}
            </div>
            <div className="mt-3">{children}</div>
        </section>
    );
}

/**
 * An empty state keeps its frame and says what would fill it. A bare sentence
 * centred in a void reads as a broken screen, not an empty one.
 */
export function Empty({
    children,
    action,
}: {
    children: React.ReactNode;
    action?: { href: string; label: string };
}) {
    return (
        <div className="rounded-[var(--radius-card)] bg-[var(--raised)] px-4 py-10 text-center">
            <p className="mx-auto max-w-[46ch] text-[14px] text-muted-foreground">
                {children}
            </p>
            {action && (
                <Link
                    href={action.href}
                    className="mt-3 inline-block text-[14px] font-medium underline decoration-[var(--control)] underline-offset-4 hover:decoration-[var(--text)]"
                >
                    {action.label}
                </Link>
            )}
        </div>
    );
}

/** Honest placeholder: never a fake table, never a silent blank screen. */
export function NotBuilt({ what, why }: { what: string; why: string }) {
    return (
        <div className="mt-8 rounded-[var(--radius-card)] bg-[var(--raised)] p-4">
            <p className="text-[14px] font-medium">Belum dibangun</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
                {what}. {why}
            </p>
        </div>
    );
}
