'use client';

import React, { Component, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { AlertCircle, MapPin } from 'lucide-react';

interface ErrorBoundaryProps {
    children: ReactNode;
    height?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

class MapErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: unknown) {
        console.warn('PatientLocationMap error caught by MapErrorBoundary:', error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div
                    style={{ height: this.props.height ?? '280px' }}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-4 text-center text-[12px] text-muted-foreground"
                >
                    <div className="flex size-9 items-center justify-center rounded-full bg-[var(--pill-negative-bg)] text-[var(--negative)]">
                        <AlertCircle className="size-4" aria-hidden />
                    </div>
                    <div className="space-y-0.5">
                        <p className="font-medium text-foreground">
                            Peta belum dapat ditampilkan
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                            Data koordinat tetap aman. Silakan muat ulang halaman.
                        </p>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

const PatientLocationMap = dynamic(
    () => import('./patient-location-map'),
    {
        ssr: false,
        loading: () => (
            <div
                className="flex h-[280px] w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] text-[12px] text-muted-foreground"
                aria-busy
                role="status"
            >
                <MapPin className="size-4 animate-pulse text-[var(--accent)]" />
                <span>Memuat peta lokasi domisili...</span>
            </div>
        ),
    },
);

export function PatientMapPanel(props: {
    lat: number | null;
    lng: number | null;
    interactive?: boolean;
    height?: string;
    onLocationSelect?: (lat: number, lng: number) => void;
}) {
    return (
        <MapErrorBoundary height={props.height}>
            <PatientLocationMap {...props} />
        </MapErrorBoundary>
    );
}
