import Link from 'next/link';

/**
 * Chrome for the two unauthenticated screens: a single centred card on the
 * page ground, with the wordmark above it. A top bar over a 1088px column was
 * right for a scrolled page; for one card the bar read as an empty strip with
 * a link in the corner, so the mark sits where the eye already is.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-dvh flex-col bg-[var(--ground)]">
            {children}
        </div>
    );
}

/** The wordmark, shared so it cannot drift between sign-in and sign-up. */
export function AuthMark() {
    return (
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
            <span className="text-[14px] font-medium">WALI-EPI</span>
        </Link>
    );
}
