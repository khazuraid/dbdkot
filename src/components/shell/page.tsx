import Link from 'next/link';

/** One page header shape across every screen: title, one-line context, action. */
export function PageHeader({
    title,
    context,
    action,
    aside,
}: {
    title: string;
    context?: string;
    action?: { href: string; label: string };
    aside?: React.ReactNode;
}) {
    return (
        <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
                <div className="flex items-center gap-3">
                    <h1 className="text-[24px] font-medium tracking-tight">
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
                    className="grid h-9 place-items-center rounded-md bg-primary px-3 text-[14px] font-medium text-primary-foreground"
                >
                    {action.label}
                </Link>
            )}
        </header>
    );
}

/** Ruled section with a heading. Panels are separated by rules, not cards. */
export function Panel({
    title,
    aside,
    children,
}: {
    title: string;
    aside?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="mt-8">
            <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-[16px] font-medium">{title}</h2>
                {aside}
            </div>
            <div className="mt-3">{children}</div>
        </section>
    );
}

export function Empty({ children }: { children: React.ReactNode }) {
    return (
        <p className="py-10 text-center text-[14px] text-muted-foreground">
            {children}
        </p>
    );
}

/** Honest placeholder: never a fake table, never a silent blank screen. */
export function NotBuilt({ what, why }: { what: string; why: string }) {
    return (
        <div className="mt-8 rounded-[var(--radius-card)] border border-dashed border-border p-4">
            <p className="text-[14px] font-medium">Belum dibangun</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
                {what}. {why}
            </p>
        </div>
    );
}
