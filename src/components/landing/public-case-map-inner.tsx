'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import '@/app/map.css';
import { LocateFixed, MapPin, X } from 'lucide-react';
import type { PublicCaseGeoPoint } from '@/lib/domain/map-data';
import { escapeHtml } from '@/lib/security';

export type PublicMapFocusMode = 'all' | 'cluster' | 'sporadic';

const DEFAULT_CENTER: [number, number] = [-6.72, 108.55];
const DEFAULT_ZOOM = 12;

function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function PublicCaseMapInner({
    cases,
    height = 420,
    focusMode = 'all',
    focusLabel,
    onResetFocus,
}: {
    cases: PublicCaseGeoPoint[];
    height?: number;
    focusMode?: PublicMapFocusMode;
    focusLabel?: string;
    onResetFocus?: () => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layersRef = useRef<{
        rings: L.LayerGroup;
        markers: L.LayerGroup | null;
    } | null>(null);
    const hasMountedLayersRef = useRef(false);
    const [ready, setReady] = useState(false);

    const clusterCount = cases.filter((c) => Boolean(c.clusterId)).length;
    const focusedCount =
        focusMode === 'cluster'
            ? clusterCount
            : focusMode === 'sporadic'
              ? cases.length - clusterCount
              : cases.length;

    // 1. Initialize Leaflet once on mount and crossfade when tiles/map settle
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        if (mapRef.current) {
            try {
                mapRef.current.remove();
            } catch {}
            mapRef.current = null;
        }
        if ((el as unknown as { _leaflet_id?: number })._leaflet_id) {
            delete (el as unknown as { _leaflet_id?: number })._leaflet_id;
        }

        const map = L.map(el, {
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            zoomControl: false,
            scrollWheelZoom: false,
        });
        mapRef.current = map;

        let settled = false;
        const markReady = () => {
            if (settled) return;
            settled = true;
            setReady(true);
        };

        const tileLayer = L.tileLayer('/api/tiles/{z}/{x}/{y}', {
            maxZoom: 19,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
        }).addTo(map);

        tileLayer.once('load', markReady);
        map.whenReady(() => {
            // Fallback timer so slow or offline tiles never leave the map hidden.
            window.setTimeout(markReady, 420);
        });

        L.control.zoom({ position: 'topright' }).addTo(map);

        layersRef.current = {
            rings: L.layerGroup().addTo(map),
            markers: null,
        };
        hasMountedLayersRef.current = false;

        return () => {
            settled = true;
            try {
                map.remove();
            } catch {}
            mapRef.current = null;
            layersRef.current = null;
            hasMountedLayersRef.current = false;
        };
    }, []);

    // 2. Sync markers, cluster rings, and camera focus without recreating Leaflet
    useEffect(() => {
        const map = mapRef.current;
        const layers = layersRef.current;
        if (!map || !layers) return;

        layers.rings.clearLayers();
        if (layers.markers) {
            map.removeLayer(layers.markers);
            layers.markers = null;
        }

        const factory = (
            L as unknown as {
                markerClusterGroup?: (
                    opts?: Record<string, unknown>,
                ) => L.LayerGroup;
            }
        ).markerClusterGroup;

        const clusterGroup = factory
            ? factory({ maxClusterRadius: 40 })
            : L.layerGroup();

        const allLatLngs: [number, number][] = [];
        const focusLatLngs: [number, number][] = [];

        for (const c of cases) {
            const isClustered = Boolean(c.clusterId);
            const isFocused =
                focusMode === 'all' ||
                (focusMode === 'cluster' && isClustered) ||
                (focusMode === 'sporadic' && !isClustered);

            allLatLngs.push([c.lat, c.lng]);
            if (isFocused) {
                focusLatLngs.push([c.lat, c.lng]);
            }

            if (isClustered) {
                const ring = L.circle([c.lat, c.lng], {
                    radius: 100,
                    color: '#e11d48',
                    weight: focusMode === 'cluster' ? 2 : 1.5,
                    dashArray: '5 4',
                    opacity: focusMode === 'sporadic' ? 0.25 : 0.9,
                    fillColor: '#e11d48',
                    fillOpacity:
                        focusMode === 'cluster'
                            ? 0.18
                            : focusMode === 'sporadic'
                              ? 0.03
                              : 0.12,
                });
                layers.rings.addLayer(ring);
            }

            const marker = L.circleMarker([c.lat, c.lng], {
                radius: isFocused ? (focusMode === 'all' ? 7 : 8) : 5,
                color: '#ffffff',
                weight: isFocused ? 1.8 : 1,
                opacity: isFocused ? 1 : 0.35,
                fillColor: isClustered ? '#e11d48' : '#0d9488',
                fillOpacity: isFocused ? 0.94 : 0.22,
            });

            // Anonymous, privacy-first popup with NO names or personal data
            const safeCaseType = escapeHtml(c.caseType || 'DBD');
            const safeKelurahan = c.kelurahan
                ? `Kel. ${escapeHtml(c.kelurahan)}`
                : 'Wilayah Kota';
            const popupHtml = `
                <div style="font-family: inherit; min-width: 170px; padding: 2px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
                        <span style="font-size: 12px; font-weight: 700; color: ${isClustered ? '#e11d48' : '#0d9488'};">
                            Kasus ${safeCaseType}
                        </span>
                        ${
                            isClustered
                                ? '<span style="font-size: 10px; background: #ffe4e6; color: #be123c; padding: 2px 6px; border-radius: 999px; font-weight: 600;">Klaster 100m</span>'
                                : '<span style="font-size: 10px; background: #ccfbf1; color: #0f766e; padding: 2px 6px; border-radius: 999px; font-weight: 600;">Kasus Tunggal</span>'
                        }
                    </div>
                    <div style="font-size: 11px; color: #52525b; line-height: 1.4;">
                        <div>Wilayah: <strong>${safeKelurahan}</strong></div>
                        <div style="margin-top: 4px; font-size: 10px; color: #71717a; border-top: 1px solid #f4f4f5; padding-top: 3px;">
                            Data spasial terverifikasi (Anonim)
                        </div>
                    </div>
                </div>
            `;
            marker.bindPopup(popupHtml, { maxWidth: 240 });
            clusterGroup.addLayer(marker);
        }

        clusterGroup.addTo(map);
        layers.markers = clusterGroup;

        const targetLatLngs =
            focusLatLngs.length > 0 ? focusLatLngs : allLatLngs;
        const shouldAnimate =
            hasMountedLayersRef.current && !prefersReducedMotion();

        if (targetLatLngs.length > 0) {
            map.fitBounds(L.latLngBounds(targetLatLngs), {
                padding: [32, 32],
                maxZoom: 14,
                animate: shouldAnimate,
                duration: 0.25,
                easeLinearity: 0.25,
            });
        }
        hasMountedLayersRef.current = true;
    }, [cases, focusMode]);

    function resetView() {
        onResetFocus?.();
        if (!mapRef.current) return;
        const shouldAnimate = !prefersReducedMotion();
        if (cases.length > 0) {
            const latlngs = cases.map(
                (c) => [c.lat, c.lng] as [number, number],
            );
            mapRef.current.fitBounds(L.latLngBounds(latlngs), {
                padding: [32, 32],
                maxZoom: 14,
                animate: shouldAnimate,
                duration: 0.25,
                easeLinearity: 0.25,
            });
        } else {
            mapRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM, {
                animate: shouldAnimate,
                duration: 0.25,
            });
        }
    }

    return (
        <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--elev-soft)]">
            {/* Top Bar inside Map Frame */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground">
                        Peta sebaran kasus DBD
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                        Koordinat wilayah anonim
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 font-mono text-[12px] text-muted-foreground tabular-nums">
                        <span className="inline-flex items-center gap-1.5 text-foreground">
                            <span
                                aria-hidden
                                className="size-1.5 rounded-full bg-[var(--accent)]"
                            />
                            {focusedCount} titik
                        </span>
                        {clusterCount > 0 ? (
                            <span className="inline-flex items-center gap-1.5 text-[var(--negative)]">
                                <span
                                    aria-hidden
                                    className="size-1.5 rounded-full bg-[var(--negative)]"
                                />
                                {clusterCount} klaster 100 m
                            </span>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={resetView}
                        aria-label="Pusatkan peta"
                        title="Pusatkan peta"
                        className="inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] text-muted-foreground transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] hover:bg-[var(--raised)] hover:text-foreground active:scale-[0.96]"
                    >
                        <LocateFixed className="size-4" strokeWidth={1.5} />
                    </button>
                </div>
            </div>

            {/* Native Leaflet Map Container with smooth loading crossfade */}
            <div className="relative" style={{ height }}>
                <div
                    ref={containerRef}
                    style={{ height }}
                    data-ready={ready ? 'true' : 'false'}
                    className="map-stage w-full bg-[var(--ground)] focus:outline-none"
                />

                {/* Crossfade loading veil while Leaflet & tiles settle */}
                <div
                    aria-hidden={ready}
                    className={
                        ready
                            ? 'map-skeleton-overlay pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--surface)] opacity-0'
                            : 'map-skeleton-overlay absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--surface)] opacity-100'
                    }
                >
                    <MapPin
                        className="size-4 text-[var(--accent)]"
                        strokeWidth={1.5}
                    />
                    <span className="text-[12px] text-muted-foreground">
                        Menyiapkan peta sebaran
                    </span>
                </div>

                {/* Active filter indicator chip when a surveillance stat card is selected */}
                {focusMode !== 'all' && focusLabel ? (
                    <div className="summary-reveal absolute top-3 left-3 z-[400] flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)]/95 px-2.5 py-1.5 text-[12px] text-foreground shadow-[var(--elev-soft)] backdrop-blur-sm">
                        <span
                            aria-hidden
                            className={
                                focusMode === 'cluster'
                                    ? 'size-1.5 rounded-full bg-[var(--negative)]'
                                    : 'size-1.5 rounded-full bg-[var(--accent)]'
                            }
                        />
                        <span className="font-medium">{focusLabel}</span>
                        <span className="font-mono text-muted-foreground tabular-nums">
                            ({focusedCount})
                        </span>
                        {onResetFocus ? (
                            <button
                                type="button"
                                onClick={onResetFocus}
                                aria-label="Hapus sorotan peta"
                                className="ml-0.5 grid size-5 place-items-center rounded text-muted-foreground transition-colors duration-150 hover:bg-[var(--raised)] hover:text-foreground"
                            >
                                <X className="size-3.5" strokeWidth={1.5} />
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {/* Bottom Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[12px] text-muted-foreground">
                <div className="flex flex-wrap items-center gap-4">
                    <span className="inline-flex items-center gap-1.5">
                        <span
                            aria-hidden
                            className="size-2 rounded-full bg-[var(--accent)]"
                        />
                        Kasus terverifikasi
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span
                            aria-hidden
                            className="size-2 rounded-full bg-[var(--negative)]"
                        />
                        Klaster radius 100 m
                    </span>
                </div>
                <span className="font-mono text-[12px] text-muted-foreground">
                    Identitas pasien dianonimkan
                </span>
            </div>
        </div>
    );
}
