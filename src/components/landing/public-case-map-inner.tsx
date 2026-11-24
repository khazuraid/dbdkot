'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import '@/app/map.css';
import { LocateFixed, MapPin, Radar, ShieldCheck } from 'lucide-react';
import type { PublicCaseGeoPoint } from '@/lib/domain/map-data';
import { escapeHtml } from '@/lib/security';

const DEFAULT_CENTER: [number, number] = [-6.72, 108.55];
const DEFAULT_ZOOM = 12;

export default function PublicCaseMapInner({
    cases,
    height = 420,
}: {
    cases: PublicCaseGeoPoint[];
    height?: number;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const [activeCount, setActiveCount] = useState(cases.length);
    const clusterCount = cases.filter((c) => Boolean(c.clusterId)).length;

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        if (mapRef.current) {
            try {
                mapRef.current.remove();
            } catch {}
            mapRef.current = null;
        }
        if ((el as any)._leaflet_id) {
            delete (el as any)._leaflet_id;
        }

        const map = L.map(el, {
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            zoomControl: false,
            scrollWheelZoom: false,
        });
        mapRef.current = map;

        L.tileLayer('/api/tiles/{z}/{x}/{y}', {
            maxZoom: 19,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
        }).addTo(map);

        L.control.zoom({ position: 'topright' }).addTo(map);

        // Ring layer for 100m clusters
        const ringsGroup = L.layerGroup().addTo(map);

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

        const latlngs: [number, number][] = [];

        for (const c of cases) {
            const isClustered = Boolean(c.clusterId);
            latlngs.push([c.lat, c.lng]);

            if (isClustered) {
                const ring = L.circle([c.lat, c.lng], {
                    radius: 100,
                    color: '#e11d48',
                    weight: 1.5,
                    dashArray: '5 4',
                    fillColor: '#e11d48',
                    fillOpacity: 0.12,
                });
                ringsGroup.addLayer(ring);
            }

            const marker = L.circleMarker([c.lat, c.lng], {
                radius: 7,
                color: '#ffffff',
                weight: 1.8,
                fillColor: isClustered ? '#e11d48' : '#0d9488',
                fillOpacity: 0.92,
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

        if (latlngs.length > 0) {
            map.fitBounds(L.latLngBounds(latlngs), {
                padding: [30, 30],
                maxZoom: 14,
            });
        }

        return () => {
            try {
                map.remove();
            } catch {}
            mapRef.current = null;
        };
    }, [cases]);

    function resetView() {
        if (!mapRef.current) return;
        if (cases.length > 0) {
            const latlngs = cases.map(
                (c) => [c.lat, c.lng] as [number, number],
            );
            mapRef.current.fitBounds(L.latLngBounds(latlngs), {
                padding: [30, 30],
                maxZoom: 14,
            });
        } else {
            mapRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        }
    }

    return (
        <div className="relative overflow-hidden rounded-[calc(2rem-0.5rem)] border border-[var(--border)] bg-[var(--surface)] shadow-xs">
            {/* Top Bar inside Map Frame */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-md bg-teal-500/15 text-teal-600 dark:text-teal-400">
                        <MapPin className="size-3.5" />
                    </span>
                    <div>
                        <p className="text-xs font-semibold text-foreground">
                            Peta Sebaran Kasus DBD
                        </p>
                        <p className="text-[10.5px] text-muted-foreground">
                            Sebaran spasial epidemiologi wilayah (Data Anonim)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                        <span className="size-1.5 rounded-full bg-teal-500" />
                        {cases.length} Titik Kasus
                    </span>
                    {clusterCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                            <Radar className="size-3" />
                            {clusterCount} Klaster 100m
                        </span>
                    ) : null}
                    <button
                        type="button"
                        onClick={resetView}
                        aria-label="Pusatkan peta"
                        title="Pusatkan peta"
                        className="inline-flex size-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    >
                        <LocateFixed className="size-3.5" />
                    </button>
                </div>
            </div>

            {/* Native Leaflet Map Container */}
            <div
                ref={containerRef}
                style={{ height }}
                className="w-full bg-[var(--ground)] focus:outline-none"
            />

            {/* Bottom Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface)]/90 px-4 py-2 text-[11px] text-muted-foreground backdrop-blur-xs">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-teal-600 ring-2 ring-teal-600/30" />
                        <span>Kasus Terverifikasi</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-rose-600 ring-2 ring-rose-600/30" />
                        <span>Klaster Epidemiologi (Radius 100m)</span>
                    </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
                    <ShieldCheck className="size-3 text-teal-600" />
                    <span>
                        Perlindungan PII: Nama & Identitas Pasien Dihilangkan
                    </span>
                </div>
            </div>
        </div>
    );
}
