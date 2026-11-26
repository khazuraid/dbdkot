'use client';

import React, { Component, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { AlertCircle, MapPin } from 'lucide-react';
import type { PublicCaseGeoPoint } from '@/lib/domain/map-data';
import type { PublicMapFocusMode } from './public-case-map-inner';

export type { PublicMapFocusMode };

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
                    style={{ height: this.props.height ?? 440 }}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[13px] text-muted-foreground"
                >
                    <AlertCircle
                        className="size-4 text-[var(--negative)]"
                        strokeWidth={1.5}
                    />
                    <p className="font-medium text-foreground">
                        Peta sebaran belum dapat ditampilkan
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                        Muat ulang halaman atau periksa koneksi
                    </p>
                </div>
            );
        }
        return this.props.children;
    }
}

const PublicCaseMapInner = dynamic(() => import('./public-case-map-inner'), {
    ssr: false,
    loading: () => (
        <div
            className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--elev-soft)]"
            role="status"
            aria-label="Memuat peta sebaran kasus"
        >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <div>
                    <p className="text-[13px] font-medium text-foreground">
                        Peta sebaran kasus DBD
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                        Koordinat wilayah anonim
                    </p>
                </div>
            </div>
            <div
                className="flex w-full flex-col items-center justify-center gap-2 bg-[var(--surface)] text-[12px] text-muted-foreground"
                style={{ height: 440 }}
            >
                <MapPin
                    className="size-4 text-[var(--accent)]"
                    strokeWidth={1.5}
                />
                <p>Menyiapkan peta sebaran</p>
            </div>
            <div className="border-t border-[var(--border)] bg-[var(--ground)] px-4 py-2 text-[12px] text-muted-foreground">
                Identitas pasien dianonimkan
            </div>
        </div>
    ),
});

export function PublicCaseMap({
    cases,
    height = 440,
    fill = false,
    focusMode = 'all',
    focusLabel,
    onResetFocus,
}: {
    cases: PublicCaseGeoPoint[];
    height?: number;
    fill?: boolean;
    focusMode?: PublicMapFocusMode;
    focusLabel?: string;
    onResetFocus?: () => void;
}) {
    return (
        <div
            className={
                fill
                    ? 'relative flex h-full min-h-[340px] w-full flex-col'
                    : 'relative mx-auto w-full'
            }
        >
            <PublicMapErrorBoundary height={height}>
                <PublicCaseMapInner
                    cases={cases}
                    height={height}
                    fill={fill}
                    focusMode={focusMode}
                    focusLabel={focusLabel}
                    onResetFocus={onResetFocus}
                />
            </PublicMapErrorBoundary>
        </div>
    );
}
