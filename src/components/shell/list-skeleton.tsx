import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shape-matched loading skeleton reserving header, KPI, and ledger space.
 */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
    return (
        <div aria-busy role="status" aria-label="Memuat data">
            <div className="border-b border-[var(--border)] px-4 py-4 md:px-[var(--pad)]">
                <Skeleton className="h-7 w-44" />
                <Skeleton className="mt-2 h-4 w-72 max-w-full" />
            </div>

            <div className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-5 md:px-[var(--pad)]">
                <div className="surface overflow-hidden">
                    <div className="flex items-center gap-4 border-b border-[var(--border)] bg-[var(--raised)] px-4 py-3">
                        {Array.from({ length: 5 }, (_, i) => (
                            <Skeleton key={i} className="h-3 w-20" />
                        ))}
                    </div>
                    {Array.from({ length: rows }, (_, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-4 border-b border-[var(--rule)] px-4 py-3 last:border-b-0"
                        >
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="ml-auto h-5 w-20 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Shape-matched loading skeleton for dashboard and analytics views: header,
 * 4-column KPI strip, and 2-column chart + action/distribution panels.
 */
export function DashboardSkeleton() {
    return (
        <div aria-busy role="status" aria-label="Memuat dasbor">
            <div className="border-b border-[var(--border)] px-4 py-4 md:px-[var(--pad)]">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="mt-2 h-4 w-64 max-w-full" />
            </div>

            <div className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-5 md:px-[var(--pad)]">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }, (_, i) => (
                        <div key={i} className="surface p-4">
                            <Skeleton className="h-3 w-28" />
                            <Skeleton className="mt-3 h-8 w-16" />
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.65fr_1fr]">
                    <div className="surface p-4 md:p-5">
                        <Skeleton className="h-4 w-44" />
                        <Skeleton className="mt-4 h-56 w-full" />
                    </div>
                    <div className="surface p-4 md:p-5">
                        <Skeleton className="h-4 w-36" />
                        <div className="mt-4 space-y-3">
                            {Array.from({ length: 4 }, (_, i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
