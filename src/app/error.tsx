'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RootError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Root application error:', error);
    }, [error]);

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--ground)] p-4 text-center">
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
                <div className="flex size-12 items-center justify-center rounded-full bg-[var(--pill-negative-bg)] text-[var(--negative)]">
                    <AlertTriangle className="size-6" aria-hidden />
                </div>
                <div className="space-y-1.5">
                    <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                        Terjadi Kendala Sistem
                    </h1>
                    <p className="text-[13px] text-muted-foreground">
                        Sistem surveilans mengalami kendala saat memuat data. Silakan coba lagi atau kembali ke halaman utama.
                    </p>
                    {error.digest && (
                        <p className="font-mono text-[11px] text-muted-foreground/80">
                            ID Sesi: {error.digest}
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <Button onClick={() => reset()} variant="default" size="sm">
                        <RefreshCw className="mr-1.5 size-3.5" data-icon="inline-start" />
                        Coba lagi
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href="/dasbor">
                            <Home className="mr-1.5 size-3.5" data-icon="inline-start" />
                            Dasbor
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
