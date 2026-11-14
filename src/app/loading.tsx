import { Skeleton } from '@/components/ui/skeleton';

export default function RootLoading() {
    return (
        <div className="flex min-h-dvh flex-col p-4 md:p-6" aria-busy="true" aria-label="Memuat sistem surveilans...">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
                <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                    <div className="space-y-2">
                        <Skeleton className="h-7 w-48" />
                        <Skeleton className="h-4 w-72" />
                    </div>
                    <Skeleton className="h-9 w-32" />
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <Skeleton className="h-80 w-full lg:col-span-2" />
                    <Skeleton className="h-80 w-full" />
                </div>
            </div>
        </div>
    );
}
