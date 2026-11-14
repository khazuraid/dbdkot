'use client';

import React, { Component, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { AlertCircle } from 'lucide-react';
import type {
    CaseGeoPoint,
    FacilityPoint,
    KelurahanZone,
} from '@/lib/domain/map-data';

class FacilityMapErrorBoundary extends Component<
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
        console.warn('FacilityMap error caught by boundary:', error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div
                    style={{ height: this.props.height ?? 380 }}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--raised)] p-4 text-center text-[12px] text-muted-foreground"
                >
                    <div className="flex size-9 items-center justify-center rounded-full bg-[var(--pill-negative-bg)] text-[var(--negative)]">
                        <AlertCircle className="size-4" aria-hidden />
                    </div>
                    <div>
                        <p className="font-medium text-foreground">
                            Peta sebaran belum dapat ditampilkan
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                            Data surveilans tetap aman. Silakan muat ulang halaman.
                        </p>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

const FacilityMap = dynamic(() => import('./facility-map'), {
    ssr: false,
    loading: () => (
        <div
            className="rounded-[var(--radius-card)] border border-border bg-[var(--raised)]"
            style={{ height: 380 }}
            aria-busy
            role="status"
            aria-label="Memuat peta sebaran"
        />
    ),
});

export function FacilityMapPanel(props: {
    points: FacilityPoint[];
    zones?: KelurahanZone[];
    cases?: CaseGeoPoint[];
    height?: number;
}) {
    return (
        <FacilityMapErrorBoundary height={props.height}>
            <FacilityMap {...props} />
        </FacilityMapErrorBoundary>
    );
}
