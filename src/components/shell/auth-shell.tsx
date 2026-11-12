import Link from 'next/link';

/**
 * Chrome for the two unauthenticated screens. Shared so a change to the mark
 * or the column width cannot drift between sign-in and sign-up.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid min-h-dvh place-items-center px-4 py-12">
            <div className="w-full max-w-[380px]">
                <Link
                    href="/masuk"
                    className="mb-8 inline-flex items-center gap-2"
                >
                    <span
                        aria-hidden
                        className="grid size-6 place-items-center rounded-[5px] bg-primary text-[11px] font-semibold text-primary-foreground"
                    >
                        WE
                    </span>
                    <span className="text-[14px] font-medium">WALI-EPI</span>
                </Link>
                {children}
            </div>
        </div>
    );
}
