'use client';

import React, { Component, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { AlertCircle, MapPin } from 'lucide-react';
import type { PublicCaseGeoPoint } from '@/lib/domain/map-data';

class PublicMapErrorBoundary extends Component<
    { children: ReactNode; height?: number },
    { hasError: boolean }
> {
    constructor(props: { children: ReactNode; height?: number }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: unknown) {
        console.warn('PublicCaseMap error caught:', error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div
                    style={{ height: this.props.height ?? 420 }}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-xs text-muted-foreground"
                >
                    <div className="flex size-9 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                        <AlertCircle className="size-4" />
                    </div>
                    <p className="font-medium text-foreground">
                        Peta sebaran belum dapat ditampilkan
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                        Silakan muat ulang halaman atau periksa koneksi.
                    </p>
                </div>
            );
        }
        return this.props.children;
    }
}

const PublicCaseMapInner = dynamic(
    () => import('./public-case-map-inner'),
    {
        ssr: false,
        loading: () => (
            <div
                className="flex w-full flex-col items-center justify-center gap-3 rounded-[calc(2rem-0.5rem)] border border-[var(--border)] bg-[var(--surface)] shadow-xs animate-pulse"
                style={{ height: 420 }}
                role="status"
                aria-label="Memuat peta sebaran kasus"
            >
                <div className="grid size-10 place-items-center rounded-full bg-teal-500/10 text-teal-600">
                    <MapPin className="size-5 animate-bounce" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">
                    Memuat peta sebaran kasus...
                </p>
            </div>
        ),
    },
);

export function PublicCaseMap({
    cases,
    height = 420,
}: {
    cases: PublicCaseGeoPoint[];
    height?: number;
}) {
    return (
        <div className="relative mx-auto w-full">
            {/* Ambient Glow */}
            <div
                aria-hidden
                className="absolute -inset-4 rounded-3xl bg-teal-500/10 blur-2xl dark:bg-teal-500/15 pointer-events-none"
            />
            {/* Double-Bezel Hardware Frame */}
            <div className="relative rounded-[2rem] border border-[var(--border)] bg-muted/30 p-2 shadow-xl">
                <PublicMapErrorBoundary height={height}>
                    <PublicCaseMapInner cases={cases} height={height} />
                </PublicMapErrorBoundary>
            </div>
        </div>
    );
}
