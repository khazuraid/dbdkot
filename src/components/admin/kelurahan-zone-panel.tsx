'use client';

import dynamic from 'next/dynamic';
import type { KelurahanZoneOption } from '@/lib/domain/master';
import type { BoundaryGeoJson } from '@/lib/geo/boundary-schema';

const KelurahanZoneMap = dynamic(() => import('./kelurahan-zone-map'), {
    ssr: false,
    loading: () => (
        <div
            className="rounded-[var(--radius-control)] border border-border bg-[var(--raised)]"
            style={{ height: 420 }}
            aria-busy
            role="status"
            aria-label="Memuat peta zonasi kelurahan"
        />
    ),
});

export const BoundaryPreviewMapDynamic = dynamic(
    () =>
        import('./kelurahan-zone-map').then((m) => ({
            default: m.BoundaryPreviewMap,
        })),
    {
        ssr: false,
        loading: () => (
            <div
                className="rounded-[var(--radius-control)] border border-border bg-[var(--raised)]"
                style={{ height: 200 }}
                aria-busy
                role="status"
                aria-label="Memuat pratinjau peta"
            />
        ),
    },
);

export function KelurahanZonePanel(props: {
    zones: KelurahanZoneOption[];
    initialFocusId?: string | null;
}) {
    return <KelurahanZoneMap {...props} />;
}

export function BoundaryPreview(props: {
    boundary: BoundaryGeoJson;
    height?: number;
}) {
    return <BoundaryPreviewMapDynamic {...props} />;
}
