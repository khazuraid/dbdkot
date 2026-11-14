import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * Standard dashboard page frame: sticky header with title, context, and action,
 * followed by padded page content.
 */
export function PageBody({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex min-w-0 flex-1 flex-col', className)}>
            {children}
        </div>
    );
}

export function PageHeader({
    title,
    context,
    action,
    aside,
    children,
}: {
    title: string;
    context?: React.ReactNode;
    action?: { href: string; label: string };
    aside?: React.ReactNode;
    /** Filter row or tabs pinned under the title. */
    children?: React.ReactNode;
}) {
    return (
        <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/92 px-4 py-4 backdrop-blur-md md:px-[var(--pad)]">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <h1 className="text-[20px] leading-tight font-semibold tracking-[-0.02em] text-foreground md:text-[var(--fs-title)]">
                            {title}
                        </h1>
                        {aside}
                    </div>
                    {context && (
                        <p className="mt-1 text-[13px] text-muted-foreground">
                            {context}
                        </p>
                    )}
                </div>
                {action && (
                    <Button asChild size="default" className="shrink-0">
                        <Link href={action.href}>{action.label}</Link>
                    </Button>
                )}
            </div>
            {children && <div className="mt-3.5">{children}</div>}
        </header>
    );
}

export function PageContent({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'mx-auto w-full max-w-[1440px] space-y-5 px-4 py-5 pb-16 md:px-[var(--pad)]',
                className,
            )}
        >
            {children}
        </div>
    );
}

/**
 * Raised clinical sheet for tables, charts, and structured records.
 */
export function Panel({
    title,
    subtitle,
    aside,
    children,
    padded = false,
    className,
}: {
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    aside?: React.ReactNode;
    children: React.ReactNode;
    padded?: boolean;
    className?: string;
}) {
    return (
        <section
            className={cn(
                'surface overflow-hidden',
                className,
            )}
        >
            {(title || aside) && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] px-4 py-3.5">
                    <div className="min-w-0">
                        {title && (
                            <h2 className="text-[var(--fs-section)] leading-snug font-semibold tracking-[-0.01em] text-foreground">
                                {title}
                            </h2>
                        )}
                        {subtitle && (
                            <p className="mt-0.5 text-[12px] text-muted-foreground">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {aside}
                </div>
            )}
            <div className={cn(padded && 'p-4 md:p-5')}>{children}</div>
        </section>
    );
}

export function Empty({
    children,
    action,
}: {
    children: React.ReactNode;
    action?: { href: string; label: string };
}) {
    return (
        <div className="flex flex-col items-center justify-center gap-2.5 px-6 py-12 text-center">
            <p className="max-w-[44ch] text-[13.5px] leading-relaxed text-muted-foreground">
                {children}
            </p>
            {action && (
                <Link
                    href={action.href}
                    className="inline-flex h-8 items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-3 text-[12.5px] font-medium text-[var(--accent)] transition-colors hover:bg-[var(--active)]"
                >
                    {action.label}
                </Link>
            )}
        </div>
    );
}
