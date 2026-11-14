import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
} from '@/components/ui/pagination';
import type { PageInfo } from './pager';

export { readPage, type PageInfo } from './pager';

/**
 * A previous/next control. At the edge of the list it renders a `<button>`
 * instead of a link to the same page: a disabled link is still focusable and
 * still announces a click, which is a lie about where it goes.
 */
function PrevNext({
    href,
    disabled,
    rel,
    icon,
    text,
    trailing,
}: {
    href: string;
    disabled: boolean;
    rel: 'prev' | 'next';
    icon: React.ReactNode;
    text: string;
    trailing?: boolean;
}) {
    const body = (
        <>
            {!trailing && icon}
            <span className="hidden sm:inline">{text}</span>
            {trailing && icon}
        </>
    );

    if (disabled) {
        return (
            // Disabled already takes it out of the tab order; aria-hidden on
            // an interactive element is invalid and hid the word from anyone
            // reading the page by screen reader.
            <Button
                variant="outline"
                size="sm"
                disabled
                tabIndex={-1}
                aria-label={text}
            >
                {body}
            </Button>
        );
    }

    return (
        <Button asChild variant="outline" size="sm">
            {/* The word is hidden below sm to save width, so the link keeps
                an accessible name when only the chevron shows. */}
            <Link href={href} rel={rel} aria-label={text}>
                {body}
            </Link>
        </Button>
    );
}

/** Page numbers to draw: first, last, and a window around the current page. */
function windowPages(page: number, lastPage: number): (number | 'gap')[] {
    const wanted = new Set([1, lastPage, page - 1, page, page + 1]);
    const pages = [...wanted]
        .filter((p) => p >= 1 && p <= lastPage)
        .sort((a, b) => a - b);

    const out: (number | 'gap')[] = [];
    let previous = 0;
    for (const p of pages) {
        if (previous && p - previous > 1) out.push('gap');
        out.push(p);
        previous = p;
    }
    return out;
}

/**
 * Shared pager for the server-paginated lists. Links, not buttons: the page is
 * in the URL, so a page is bookmarkable, shareable, and survives a refresh —
 * and the server keeps doing the paging, which is the point (the browser never
 * receives rows it will not draw).
 *
 * `buildHref` receives the target page and returns the full href — each screen
 * keeps its own filters without this component knowing about them.
 */
export function Pager({
    info,
    buildHref,
    label = 'baris',
}: {
    info: PageInfo;
    buildHref: (page: number) => string;
    label?: string;
}) {
    const lastPage = Math.max(1, Math.ceil(info.total / info.perPage));

    if (info.total === 0) return null;

    // A stale or hand-typed ?page= past the end is clamped, so the pager never
    // draws a range like "9851–250" and never leaves the current page
    // unmarked. The list itself still shows the empty page the server sent.
    const page = Math.min(info.page, lastPage);
    const from = (page - 1) * info.perPage + 1;
    const to = Math.min(page * info.perPage, info.total);
    const overrun = info.page > lastPage;

    return (
        <Pagination className="mx-0 w-auto flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 text-[12.5px]">
            <p className="text-muted-foreground" data-numeric>
                <span className="font-medium text-foreground">
                    {from}–{to}
                </span>{' '}
                dari {info.total} {label}
                {overrun && (
                    <>
                        {', '}
                        halaman {info.page} tidak ada;{' '}
                        <Link
                            href={buildHref(lastPage)}
                            className="underline underline-offset-4"
                        >
                            ke halaman terakhir
                        </Link>
                    </>
                )}
            </p>

            <PaginationContent>
                <PaginationItem>
                    <PrevNext
                        href={buildHref(Math.max(1, page - 1))}
                        disabled={page <= 1}
                        rel="prev"
                        icon={<ChevronLeft />}
                        text="Sebelumnya"
                    />
                </PaginationItem>

                {windowPages(info.page, lastPage).map((p, i) =>
                    p === 'gap' ? (
                        <PaginationItem key={`gap-${i}`}>
                            <PaginationEllipsis />
                        </PaginationItem>
                    ) : (
                        <PaginationItem key={p}>
                            <Button
                                asChild
                                variant={p === page ? 'secondary' : 'ghost'}
                                size="icon-sm"
                            >
                                <Link
                                    href={buildHref(p)}
                                    aria-current={
                                        p === page ? 'page' : undefined
                                    }
                                    data-numeric
                                >
                                    {p}
                                </Link>
                            </Button>
                        </PaginationItem>
                    ),
                )}

                <PaginationItem>
                    <PrevNext
                        href={buildHref(Math.min(lastPage, page + 1))}
                        disabled={page >= lastPage}
                        rel="next"
                        icon={<ChevronRight />}
                        text="Berikutnya"
                        trailing
                    />
                </PaginationItem>
            </PaginationContent>
        </Pagination>
    );
}
