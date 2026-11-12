import Link from 'next/link';

/**
 * Chrome for the two unauthenticated screens (sheet §4, "No sidebar"): a
 * 47px top bar on the page ground, no rule at rest, over a centred column.
 * The logo sits exactly on the column's left edge and the bar's right cluster
 * ends near its right edge, so header and content share one column — the
 * column is 1088px, inside the studied 1088-1208px band.
 *
 * Shared so a change to the mark or the column width cannot drift between
 * sign-in and sign-up.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-dvh bg-[var(--ground)]">
            <header className="h-[47px]">
                <div className="mx-auto flex h-full max-w-[1088px] items-center justify-between px-4 md:px-8">
                    <Link
                        href="/masuk"
                        className="flex items-center gap-2"
                        aria-label="WALI-EPI, halaman masuk"
                    >
                        <span
                            aria-hidden
                            className="grid size-6 place-items-center rounded-[5px] bg-primary text-[11px] font-semibold text-primary-foreground"
                        >
                            WE
                        </span>
                        <span className="text-[14px] font-medium">
                            WALI-EPI
                        </span>
                    </Link>
                    <span className="text-[12px] text-muted-foreground">
                        SiLapor DBD
                    </span>
                </div>
            </header>

            <main className="mx-auto flex min-h-[calc(100dvh-47px)] max-w-[1088px] flex-col px-4 pb-16 md:px-8">
                {children}
            </main>
        </div>
    );
}
