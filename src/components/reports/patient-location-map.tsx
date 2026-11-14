'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@/app/map.css';
import { MapPin } from 'lucide-react';

interface PatientLocationMapProps {
    lat: number | null;
    lng: number | null;
    onLocationSelect?: (lat: number, lng: number) => void;
    height?: string;
    interactive?: boolean;
}

const DEFAULT_CENTER: [number, number] = [-6.72, 108.55]; // Default Cirebon
const DEFAULT_ZOOM = 13;

export default function PatientLocationMap({
    lat,
    lng,
    onLocationSelect,
    height = '280px',
    interactive = true,
}: PatientLocationMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layersRef = useRef<{
        circle: L.Circle | null;
        outerDot: L.CircleMarker | null;
        innerDot: L.CircleMarker | null;
    }>({ circle: null, outerDot: null, innerDot: null });

    const hasValidCoords =
        lat !== null &&
        lng !== null &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180;

    const initialCoordsRef = useRef({ hasValidCoords, lat, lng });
    const onLocationSelectRef = useRef(onLocationSelect);
    const interactiveRef = useRef(interactive);

    useEffect(() => {
        onLocationSelectRef.current = onLocationSelect;
        interactiveRef.current = interactive;
    }, [onLocationSelect, interactive]);

    // Initialize map on mount
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        // Clean up any stale Leaflet ID on the DOM container to prevent
        // "Error: Map container is being reused by another instance"
        if ((el as unknown as { _leaflet_id?: number | null })._leaflet_id) {
            (el as unknown as { _leaflet_id?: number | null })._leaflet_id = null;
        }

        const init = initialCoordsRef.current;
        const initialCenter: [number, number] = init.hasValidCoords
            ? [init.lat as number, init.lng as number]
            : DEFAULT_CENTER;
        const initialZoom = init.hasValidCoords ? 16 : DEFAULT_ZOOM;

        const map = L.map(el, {
            center: initialCenter,
            zoom: initialZoom,
            zoomControl: false,
            scrollWheelZoom: false,
        });
        mapRef.current = map;

        // Internal CSP-compliant tile proxy
        L.tileLayer('/api/tiles/{z}/{x}/{y}', {
            maxZoom: 19,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
        }).addTo(map);

        // Zoom control at top right so it does not collide with the coordinate pill
        L.control.zoom({ position: 'topright' }).addTo(map);

        // Handle click event if interactive
        map.on('click', (e: L.LeafletMouseEvent) => {
            if (interactiveRef.current && onLocationSelectRef.current) {
                onLocationSelectRef.current(e.latlng.lat, e.latlng.lng);
            }
        });

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            if (el) {
                (el as unknown as { _leaflet_id?: number | null })._leaflet_id = null;
            }
        };
    }, []); // Run once on mount

    // Update markers and circle when lat/lng change
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // Remove old layers
        if (layersRef.current.circle) {
            map.removeLayer(layersRef.current.circle);
            layersRef.current.circle = null;
        }
        if (layersRef.current.outerDot) {
            map.removeLayer(layersRef.current.outerDot);
            layersRef.current.outerDot = null;
        }
        if (layersRef.current.innerDot) {
            map.removeLayer(layersRef.current.innerDot);
            layersRef.current.innerDot = null;
        }

        if (hasValidCoords) {
            const coords: [number, number] = [lat as number, lng as number];

            // 100m Investigation Radius
            const circle = L.circle(coords, {
                radius: 100,
                color: '#0d9488',
                fillColor: '#0d9488',
                fillOpacity: 0.12,
                weight: 2,
                dashArray: '5, 5',
            }).addTo(map);
            circle.bindTooltip(
                '<span style="font-size:11px;font-weight:600;">Radius Penyelidikan PE 100m</span>',
                { direction: 'top', opacity: 0.95 },
            );

            // Outer ring
            const outerDot = L.circleMarker(coords, {
                radius: 8,
                color: '#ffffff',
                fillColor: '#0d9488',
                fillOpacity: 1,
                weight: 2.5,
            }).addTo(map);
            outerDot.bindTooltip(
                '<span style="font-size:11px;font-weight:700;color:#0d9488;">Domisili Pasien</span>',
                { direction: 'top', offset: [0, -8], permanent: true },
            );

            // Inner white dot
            const innerDot = L.circleMarker(coords, {
                radius: 3,
                color: '#ffffff',
                fillColor: '#ffffff',
                fillOpacity: 1,
                weight: 1,
            }).addTo(map);

            layersRef.current = { circle, outerDot, innerDot };

            // Recenter map smoothly
            map.setView(coords, 16, { animate: true });
        }
    }, [lat, lng, hasValidCoords]);

    return (
        <div className="relative w-full overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] shadow-2xs">
            {/* Map Canvas */}
            <div ref={containerRef} style={{ height }} className="h-full w-full z-0" />

            {/* Top-left Coordinate Badge */}
            <div className="absolute top-2 left-2 z-[400] flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)]/95 px-2.5 py-1 text-[11.5px] font-medium text-foreground shadow-xs backdrop-blur-sm">
                <MapPin className="size-3.5 text-[var(--accent)]" aria-hidden />
                {hasValidCoords ? (
                    <span className="font-mono tabular-nums text-[11px]">
                        {lat?.toFixed(6)}, {lng?.toFixed(6)}
                    </span>
                ) : (
                    <span className="text-muted-foreground">
                        Belum ada koordinat ditentukan
                    </span>
                )}
            </div>

            {/* Bottom-left Legend Badge (uncovers attribution at bottomright) */}
            <div className="pointer-events-none absolute bottom-2 left-2 z-[400] flex max-w-[calc(100%-190px)] flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)]/95 px-2.5 py-1 text-[11px] text-muted-foreground shadow-xs backdrop-blur-sm">
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <span className="size-2 rounded-full bg-[var(--accent)]" />
                    Domisili
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full border border-dashed border-[var(--accent)] bg-[var(--accent)]/20" />
                    Radius PE 100m
                </span>
                {interactive && (
                    <span className="hidden text-[10.5px] text-muted-foreground sm:inline">
                        · Klik peta untuk geser titik
                    </span>
                )}
            </div>
        </div>
    );
}
