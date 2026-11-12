import Link from 'next/link';

export type PageInfo = {
    page: number;
    perPage: number;
    total: number;
};

/**
 * Shared pager for the server-paginated lists. Links, not buttons: the page is
 * in the URL, so a page is bookmarkable, shareable, and survives a refresh.
 *
 * `buildHref` receives the target page and returns the full href — each screen
 * keeps its own filters without this component knowing about them.
 */
export function Pager({
    info,
    buildHref,
    label = 'halaman',
}: {
    info: PageInfo;
    buildHref: (page: number) => string;
    label?: string;
}) {
    const lastPage = Math.max(1, Math.ceil(info.total / info.perPage));

    if (info.total === 0) return null;

    const from = (info.page - 1) * info.perPage + 1;
    const to = Math.min(info.page * info.perPage, info.total);

    return (
        <nav
            aria-label="Navigasi halaman"
            className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-3 text-[13px]"
        >
            <p className="text-muted-foreground" data-numeric>
                {from}–{to} dari {info.total} {label}
            </p>
            <div className="flex items-center gap-1">
                <PageLink
                    href={buildHref(info.page - 1)}
                    disabled={info.page <= 1}
                    rel="prev"
                >
                    Sebelumnya
                </PageLink>
                <span className="px-2 text-muted-foreground" data-numeric>
                    {info.page} / {lastPage}
                </span>
                <PageLink
                    href={buildHref(info.page + 1)}
                    disabled={info.page >= lastPage}
                    rel="next"
                >
                    Berikutnya
                </PageLink>
            </div>
        </nav>
    );
}

function PageLink({
    href,
    disabled,
    rel,
    children,
}: {
    href: string;
    disabled: boolean;
    rel: 'prev' | 'next';
    children: React.ReactNode;
}) {
    const className =
        'rounded-[var(--radius-control)] border border-[var(--control)] px-2 py-1';

    // Rendered as a span, not a link: a disabled anchor is still focusable and
    // still announced as a link, which is a lie about what it does.
    if (disabled) {
        return (
            <span
                aria-disabled="true"
                className={`${className} text-muted-foreground opacity-50`}
            >
                {children}
            </span>
        );
    }

    return (
        <Link
            href={href}
            rel={rel}
            className={`${className} hover:bg-[var(--raised)]`}
        >
            {children}
        </Link>
    );
}

/** Reads a 1-based page number out of the URL, ignoring junk. */
export function readPage(raw: string | undefined): number {
    const n = Number.parseInt(raw ?? '1', 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
}
