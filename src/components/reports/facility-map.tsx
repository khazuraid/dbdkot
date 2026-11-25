'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import '@/app/map.css';
import Link from 'next/link';
import type { GeoJsonObject } from 'geojson';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
    Building2,
    Crosshair,
    Layers,
    LocateFixed,
    MapPin,
    Radar,
    SlidersHorizontal,
    Table2,
    X,
} from 'lucide-react';
import { SpringSheet } from '@/components/ui/drawer';
import type {
    CaseGeoPoint,
    FacilityPoint,
    KelurahanZone,
} from '@/lib/domain/map-data';
import { computeBoundaryBounds } from '@/lib/geo/boundary-schema';
import { formatNumber } from '@/lib/format';
import { escapeHtml } from '@/lib/security';
import { cn } from '@/lib/utils';

const TYPE_META: Record<string, { label: string; color: string; hex: string }> =
    {
        RUMAH_SAKIT: {
            label: 'Rumah Sakit',
            color: 'var(--viz-1)',
            hex: '#0284c7',
        },
        PUSKESMAS: {
            label: 'Puskesmas',
            color: 'var(--viz-2)',
            hex: '#0d9488',
        },
        DINAS_KESEHATAN: {
            label: 'Dinas Kesehatan',
            color: 'var(--viz-3)',
            hex: '#059669',
        },
    };

const DEFAULT_CENTER: [number, number] = [-6.72, 108.55];
const DEFAULT_ZOOM = 12;

export default function FacilityMap({
    points,
    zones = [],
    cases = [],
    height = 380,
}: {
    points: FacilityPoint[];
    zones?: KelurahanZone[];
    cases?: CaseGeoPoint[];
    height?: number;
}) {
    const reduce = Boolean(useReducedMotion());
    const [view, setView] = useState<'map' | 'table'>('map');
    const [tableTab, setTableTab] = useState<'faskes' | 'zona' | 'klaster'>(
        'faskes',
    );
    const [showFacilities, setShowFacilities] = useState(true);
    const [showCases, setShowCases] = useState(true);
    const [onlyClusters, setOnlyClusters] = useState(false);
    const [showZones, setShowZones] = useState(zones.length > 0);
    const [selectedZoneId, setSelectedZoneId] = useState('');
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const [activeCase, setActiveCase] = useState<CaseGeoPoint | null>(null);
    const [popoverAnchor, setPopoverAnchor] = useState<{
        x: number;
        y: number;
        w: number;
        h: number;
    } | null>(null);
    const [locating, setLocating] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layerGroupsRef = useRef<{
        zones: L.LayerGroup;
        facilities: L.LayerGroup;
        rings: L.LayerGroup;
        cases: L.LayerGroup | null;
    } | null>(null);

    const max = useMemo(() => Math.max(...points.map((p) => p.n), 1), [points]);

    const visibleCases = useMemo(
        () =>
            onlyClusters ? cases.filter((c) => Boolean(c.clusterId)) : cases,
        [cases, onlyClusters],
    );

    const clusteredCasesCount = useMemo(
        () => cases.filter((c) => Boolean(c.clusterId)).length,
        [cases],
    );

    const clusterSiblings = useMemo(() => {
        if (!activeCase?.clusterId) return [];
        return cases.filter((c) => c.clusterId === activeCase.clusterId);
    }, [activeCase, cases]);

    const activeFilterCount =
        (showFacilities ? 0 : 1) +
        (showCases ? 0 : 1) +
        (onlyClusters ? 1 : 0) +
        (zones.length > 0 && !showZones ? 1 : 0) +
        (selectedZoneId ? 1 : 0);

    const openCasePopover = useCallback((c: CaseGeoPoint) => {
        setActiveCase(c);
        const map = mapRef.current;
        if (map) {
            const pt = map.latLngToContainerPoint([c.lat, c.lng]);
            const sz = map.getSize();
            setPopoverAnchor({ x: pt.x, y: pt.y, w: sz.x, h: sz.y });
        }
    }, []);

    const countsByType = useMemo(() => {
        const counts = new Map<string, number>();
        for (const p of points) {
            counts.set(p.type, (counts.get(p.type) ?? 0) + 1);
        }
        return Object.entries(TYPE_META).map(([type, meta]) => ({
            type,
            ...meta,
            count: counts.get(type) ?? 0,
        }));
    }, [points]);

    // Initialize native Leaflet map when view === 'map'
    useEffect(() => {
        if (view !== 'map') return;
        const el = containerRef.current;
        if (!el) return;

        // Ensure previous map instance is cleanly removed before recreating
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

        const zonesGroup = L.layerGroup().addTo(map);
        const ringsGroup = L.layerGroup().addTo(map);
        const facilitiesGroup = L.layerGroup().addTo(map);

        layerGroupsRef.current = {
            zones: zonesGroup,
            facilities: facilitiesGroup,
            rings: ringsGroup,
            cases: null,
        };

        return () => {
            if (mapRef.current) {
                try {
                    mapRef.current.remove();
                } catch {}
                mapRef.current = null;
            }
            layerGroupsRef.current = null;
            if (el && (el as any)._leaflet_id) {
                delete (el as any)._leaflet_id;
            }
        };
    }, [view]);

    // Sync layers & auto-fit bounds
    useEffect(() => {
        if (view !== 'map') return;
        const map = mapRef.current;
        const groups = layerGroupsRef.current;
        if (!map || !groups) return;

        // 1. Zones
        groups.zones.clearLayers();
        if (showZones && zones.length > 0) {
            for (const z of zones) {
                const isSelected =
                    selectedZoneId === '' || selectedZoneId === z.id;
                const style = isSelected
                    ? {
                          color: z.reportCount > 0 ? '#dc2626' : '#0f766e',
                          weight: selectedZoneId === z.id ? 2.5 : 1.8,
                          dashArray: '6 4',
                          fillColor: z.reportCount > 0 ? '#dc2626' : '#0f766e',
                          fillOpacity: z.reportCount > 0 ? 0.1 : 0.05,
                      }
                    : {
                          color: '#64748b',
                          weight: 1,
                          dashArray: '4 4',
                          fillColor: '#64748b',
                          fillOpacity: 0.03,
                      };

                try {
                    const geo = L.geoJSON(
                        z.boundaryGeojson as unknown as GeoJsonObject,
                        { style: () => style },
                    );
                    geo.bindTooltip(
                        `<div style="font-size:12px;">
                            <strong>Kel. ${escapeHtml(z.name)}</strong><br/>
                            <span style="color:#64748b;">${escapeHtml(z.kecamatan)}, ${escapeHtml(z.kota)}</span><br/>
                            <span><strong>${escapeHtml(formatNumber(z.reportCount))}</strong> laporan${
                                z.puskesmasNames.length > 0
                                    ? ` · ${escapeHtml(z.puskesmasNames.join(', '))}`
                                    : ''
                            }</span>
                        </div>`,
                        { sticky: true },
                    );
                    groups.zones.addLayer(geo);
                } catch {
                    // ignore invalid geojson
                }
            }
        }

        // 2. Facilities
        groups.facilities.clearLayers();
        if (showFacilities) {
            for (const p of points) {
                const meta = TYPE_META[p.type] ?? {
                    label: p.type,
                    hex: '#0284c7',
                };
                const marker = L.circleMarker([p.lat, p.lng], {
                    radius: 6 + 9 * Math.sqrt(p.n / max),
                    color: '#ffffff',
                    fillColor: meta.hex,
                    fillOpacity: 0.9,
                    weight: 2,
                });
                marker.bindTooltip(
                    `<div style="font-size:12px;">
                        <strong>${escapeHtml(p.name)}</strong><br/>
                        <span style="color:#64748b;">${escapeHtml(meta.label)}</span> · <strong>${escapeHtml(formatNumber(p.n))}</strong> laporan
                    </div>`,
                    { direction: 'top' },
                );
                groups.facilities.addLayer(marker);
            }
        }

        // 3. Case Cluster Rings (100m) + Case Marker Cluster
        groups.rings.clearLayers();
        if (groups.cases) {
            map.removeLayer(groups.cases);
            groups.cases = null;
        }

        if (showCases && visibleCases.length > 0) {
            for (const c of visibleCases) {
                if (c.clusterId) {
                    const ring = L.circle([c.lat, c.lng], {
                        radius: 100,
                        color: '#e11d48',
                        weight: 1.5,
                        dashArray: '5 4',
                        fillColor: '#e11d48',
                        fillOpacity: 0.14,
                    });
                    ring.on('click', () => openCasePopover(c));
                    groups.rings.addLayer(ring);
                }
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

            for (const c of visibleCases) {
                const isClustered = Boolean(c.clusterId);
                const color = isClustered ? '#e11d48' : '#0284c7';
                const marker = L.circleMarker([c.lat, c.lng], {
                    radius: 7,
                    color: '#ffffff',
                    weight: 1.8,
                    fillColor: color,
                    fillOpacity: 0.92,
                });

                const sourceLabel = c.institutionName
                    ? `${c.institutionType === 'PUSKESMAS' ? 'PKM' : 'RS'} ${c.institutionName}`
                    : c.sourceType === 'PUSKESMAS_POLI'
                      ? 'Puskesmas'
                      : 'Rumah Sakit';

                marker.bindTooltip(
                    `<div style="font-size:11.5px;line-height:1.35;padding:1px 3px;">
                        <strong style="font-family:monospace;">${escapeHtml(c.reportNumber)}</strong> (${escapeHtml(c.caseType ?? 'Kasus')})<br/>
                        <span style="color:#64748b;">Sumber: ${escapeHtml(sourceLabel)}</span><br/>
                        <span style="color:#64748b;">Kel. ${escapeHtml(c.kelurahan ?? '-')}</span>
                        ${isClustered ? '<br/><span style="color:#e11d48;font-weight:600;">Klaster 100m</span>' : ''}
                    </div>`,
                    { direction: 'top' },
                );
                marker.on('click', () => openCasePopover(c));
                clusterGroup.addLayer(marker);
            }

            map.addLayer(clusterGroup);
            groups.cases = clusterGroup;
        }

        // 4. Auto-fit bounds
        fitMapToData(
            map,
            points,
            zones,
            visibleCases,
            selectedZoneId,
            showZones,
        );
    }, [
        view,
        points,
        zones,
        visibleCases,
        showFacilities,
        showCases,
        showZones,
        selectedZoneId,
        max,
        openCasePopover,
    ]);

    // Keep origin-aware cluster popover anchored when map pans/zooms
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !activeCase || view !== 'map') return;
        const sync = () => {
            const pt = map.latLngToContainerPoint([
                activeCase.lat,
                activeCase.lng,
            ]);
            const sz = map.getSize();
            setPopoverAnchor({ x: pt.x, y: pt.y, w: sz.x, h: sz.y });
        };
        map.on('move zoom resize', sync);
        return () => {
            map.off('move zoom resize', sync);
        };
    }, [activeCase, view]);

    const popoverPlacement = useMemo(() => {
        if (!popoverAnchor) return null;
        const cardW = 284;
        const cardH = 196;
        const pad = 12;
        const gap = 14;
        const { x, y, w, h } = popoverAnchor;
        const openAbove = y > cardH + gap + pad;
        const left = Math.min(
            Math.max(x - cardW / 2, pad),
            Math.max(pad, w - cardW - pad),
        );
        const top = openAbove
            ? Math.max(pad, y - cardH - gap)
            : Math.min(y + gap, Math.max(pad, h - cardH - pad));
        const originX = Math.min(
            92,
            Math.max(8, Math.round(((x - left) / cardW) * 100)),
        );
        const originY = openAbove ? 100 : 0;
        return {
            left,
            top,
            origin: `${originX}% ${originY}%`,
            nudgeY: openAbove ? 6 : -6,
        };
    }, [popoverAnchor]);

    function handleResetBounds() {
        if (!mapRef.current) return;
        setSelectedZoneId('');
        fitMapToData(mapRef.current, points, zones, cases, '', showZones);
    }

    function handleLocate() {
        if (!mapRef.current || !navigator.geolocation || locating) return;
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                mapRef.current?.setView(
                    [pos.coords.latitude, pos.coords.longitude],
                    15,
                    { animate: true },
                );
                setLocating(false);
            },
            () => setLocating(false),
            { enableHighAccuracy: true, timeout: 8000 },
        );
    }

    return (
        <figure className="m-0 flex flex-col gap-3">
            {/* Control & Layer Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/60 p-2">
                {/* Layer filter toggles */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setShowFacilities((v) => !v)}
                        aria-pressed={showFacilities}
                        className={cn(
                            'inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-control)] border px-2.5 text-[11.5px] font-medium transition-colors',
                            showFacilities
                                ? 'border-[var(--accent)]/50 bg-[var(--surface)] text-foreground shadow-2xs'
                                : 'border-transparent text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Building2
                            className="size-3.5 text-[#0284c7]"
                            aria-hidden
                        />
                        Faskes ({points.length})
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowCases((v) => !v)}
                        aria-pressed={showCases}
                        className={cn(
                            'inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-control)] border px-2.5 text-[11.5px] font-medium transition-colors',
                            showCases
                                ? 'border-[var(--accent)]/50 bg-[var(--surface)] text-foreground shadow-2xs'
                                : 'border-transparent text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Radar
                            className="size-3.5 text-[#e11d48]"
                            aria-hidden
                        />
                        Titik Kasus &amp; Klaster 100m ({cases.length})
                    </button>

                    {zones.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowZones((v) => !v)}
                            aria-pressed={showZones}
                            className={cn(
                                'inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-control)] border px-2.5 text-[11.5px] font-medium transition-colors',
                                showZones
                                    ? 'border-[var(--accent)]/50 bg-[var(--surface)] text-foreground shadow-2xs'
                                    : 'border-transparent text-muted-foreground hover:text-foreground',
                            )}
                        >
                            <Layers
                                className="size-3.5 text-[#0f766e]"
                                aria-hidden
                            />
                            Zonasi Kelurahan ({zones.length})
                        </button>
                    )}
                </div>

                {/* Right controls: zone dropdown + reset + view toggle */}
                <div className="flex flex-wrap items-center gap-2">
                    {zones.length > 0 && showZones && view === 'map' && (
                        <select
                            aria-label="Fokus zona kelurahan"
                            value={selectedZoneId}
                            onChange={(e) => setSelectedZoneId(e.target.value)}
                            className="h-7 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[11.5px] text-foreground outline-none focus:border-[var(--accent)]"
                        >
                            <option value="">
                                Semua zona ({zones.length})
                            </option>
                            {zones.map((z) => (
                                <option key={z.id} value={z.id}>
                                    Kel. {z.name} ({z.reportCount})
                                </option>
                            ))}
                        </select>
                    )}

                    {view === 'map' && (
                        <>
                            <button
                                type="button"
                                onClick={() => setFilterSheetOpen(true)}
                                aria-expanded={filterSheetOpen}
                                className={cn(
                                    'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[var(--radius-control)] border px-2.5 text-[11.5px] font-medium transition-[color,background-color,border-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97]',
                                    filterSheetOpen || activeFilterCount > 0
                                        ? 'border-[var(--accent)]/60 bg-[var(--accent-soft)] text-[var(--accent)]'
                                        : 'border-[var(--border)] bg-[var(--surface)] text-foreground hover:bg-[var(--raised)]',
                                )}
                            >
                                <SlidersHorizontal
                                    className="size-3"
                                    aria-hidden
                                />
                                Filter Peta
                                {activeFilterCount > 0 ? (
                                    <span className="rounded-full bg-[var(--accent)] px-1.5 font-mono text-[10px] text-white tabular-nums">
                                        {activeFilterCount}
                                    </span>
                                ) : null}
                            </button>
                            <button
                                type="button"
                                onClick={handleResetBounds}
                                title="Reset zoom ke seluruh wilayah"
                                className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[11.5px] font-medium text-muted-foreground transition-[color,transform] duration-150 ease-[var(--ease-out)] hover:text-foreground active:scale-[0.97]"
                            >
                                <Crosshair className="size-3" aria-hidden />
                                Reset
                            </button>
                        </>
                    )}

                    <div
                        role="group"
                        aria-label="Mode tampilan sebaran"
                        className="inline-flex rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-0.5"
                    >
                        <button
                            type="button"
                            onClick={() => setView('map')}
                            aria-pressed={view === 'map'}
                            className={cn(
                                'inline-flex h-6 items-center gap-1 rounded-[5px] px-2 text-[11.5px] font-medium transition-colors',
                                view === 'map'
                                    ? 'bg-[var(--accent)] text-white shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            <MapPin className="size-3" aria-hidden />
                            Peta
                        </button>
                        <button
                            type="button"
                            onClick={() => setView('table')}
                            aria-pressed={view === 'table'}
                            className={cn(
                                'inline-flex h-6 items-center gap-1 rounded-[5px] px-2 text-[11.5px] font-medium transition-colors',
                                view === 'table'
                                    ? 'bg-[var(--accent)] text-white shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            <Table2 className="size-3" aria-hidden />
                            Tabel
                        </button>
                    </div>
                </div>
            </div>

            {view === 'map' ? (
                <div
                    className="relative overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]"
                    style={{ height }}
                >
                    <div ref={containerRef} className="z-0 h-full w-full" />

                    {/* Geolocate button */}
                    <button
                        type="button"
                        onClick={handleLocate}
                        aria-label="Pusatkan ke lokasi saya"
                        title="Pusatkan ke lokasi saya"
                        disabled={locating}
                        className="absolute top-[78px] right-2.5 z-[400] grid size-[30px] place-items-center rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-foreground shadow-sm transition-colors hover:bg-[var(--raised)] disabled:opacity-50"
                    >
                        <LocateFixed className="size-3.5" aria-hidden />
                    </button>

                    {/* Bottom-left Legend Strip */}
                    <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-[400] flex max-w-[calc(100%-150px)] flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)]/95 px-2.5 py-1.5 text-[11px] shadow-xs backdrop-blur-sm">
                        {countsByType.map((item) => (
                            <span
                                key={item.type}
                                className="inline-flex items-center gap-1.5"
                            >
                                <span
                                    aria-hidden
                                    className="size-2.5 rounded-full border border-white/80"
                                    style={{ backgroundColor: item.hex }}
                                />
                                <span className="font-medium text-foreground">
                                    {item.label}
                                </span>
                                <span className="font-mono text-muted-foreground">
                                    ({item.count})
                                </span>
                            </span>
                        ))}
                        <span className="inline-flex items-center gap-1.5">
                            <span
                                aria-hidden
                                className="size-2.5 rounded-full border border-dashed border-[#e11d48] bg-[#e11d48]/25"
                            />
                            <span className="font-medium text-foreground">
                                Klaster 100m
                            </span>
                            <span className="font-mono text-muted-foreground">
                                ({clusteredCasesCount})
                            </span>
                        </span>
                    </div>

                    {/* Origin-Aware Spring Popover Detail Klaster 100m */}
                    <AnimatePresence>
                        {activeCase && (
                            <motion.div
                                key={activeCase.id}
                                data-translucent="true"
                                initial={
                                    reduce
                                        ? { opacity: 0 }
                                        : {
                                              opacity: 0,
                                              scale: 0.92,
                                              y: popoverPlacement?.nudgeY ?? 6,
                                          }
                                }
                                animate={
                                    reduce
                                        ? { opacity: 1 }
                                        : { opacity: 1, scale: 1, y: 0 }
                                }
                                exit={
                                    reduce
                                        ? { opacity: 0 }
                                        : {
                                              opacity: 0,
                                              scale: 0.94,
                                              y:
                                                  (popoverPlacement?.nudgeY ??
                                                      6) * 0.6,
                                          }
                                }
                                transition={
                                    reduce
                                        ? { duration: 0.14, ease: 'easeOut' }
                                        : {
                                              type: 'spring',
                                              duration: 0.28,
                                              bounce: 0.14,
                                          }
                                }
                                style={
                                    popoverPlacement
                                        ? {
                                              left: popoverPlacement.left,
                                              top: popoverPlacement.top,
                                              transformOrigin:
                                                  popoverPlacement.origin,
                                          }
                                        : {
                                              right: 12,
                                              bottom: 48,
                                              transformOrigin: 'bottom right',
                                          }
                                }
                                className="absolute z-[450] flex w-[284px] items-start justify-between gap-2.5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]/95 p-3.5 shadow-[var(--elev-pop)] backdrop-blur-md"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <p className="font-mono text-[13px] font-semibold text-foreground">
                                            {activeCase.reportNumber}
                                        </p>
                                        <span className="rounded bg-[var(--accent)]/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--accent)]">
                                            {activeCase.caseType ?? 'DBD'}
                                        </span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                        <span className="truncate font-medium text-foreground">
                                            {activeCase.institutionName
                                                ? `${activeCase.institutionType === 'PUSKESMAS' ? 'PKM' : 'RS'} ${activeCase.institutionName}`
                                                : activeCase.sourceType ===
                                                    'PUSKESMAS_POLI'
                                                  ? 'Puskesmas'
                                                  : 'Rumah Sakit'}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                                        Kel. {activeCase.kelurahan ?? '-'}
                                        {activeCase.kecamatan
                                            ? `, Kec. ${activeCase.kecamatan}`
                                            : ''}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        Status:{' '}
                                        <span className="font-medium text-foreground">
                                            {activeCase.status}
                                        </span>
                                    </p>
                                    {activeCase.clusterId && (
                                        <div className="mt-1.5 rounded-[var(--radius-control)] border border-[#e11d48]/25 bg-[#e11d48]/8 px-2 py-1">
                                            <p className="font-mono text-[10.5px] font-semibold text-[#e11d48]">
                                                ● Klaster 100m (
                                                {activeCase.clusterId})
                                                {clusterSiblings.length > 1
                                                    ? ` · ${clusterSiblings.length} kasus`
                                                    : ''}
                                            </p>
                                            {clusterSiblings.length > 1 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {clusterSiblings
                                                        .slice(0, 4)
                                                        .map((sib) => (
                                                            <button
                                                                key={sib.id}
                                                                type="button"
                                                                onClick={() =>
                                                                    openCasePopover(
                                                                        sib,
                                                                    )
                                                                }
                                                                className={cn(
                                                                    'cursor-pointer rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors',
                                                                    sib.id ===
                                                                        activeCase.id
                                                                        ? 'bg-[#e11d48] text-white'
                                                                        : 'bg-[var(--surface)] text-foreground hover:bg-[var(--raised)]',
                                                                )}
                                                            >
                                                                {sib.reportNumber.slice(
                                                                    -4,
                                                                )}
                                                            </button>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <Link
                                        href={`/laporan/${activeCase.id}`}
                                        className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:underline"
                                    >
                                        Buka detail kasus →
                                    </Link>
                                </div>
                                <button
                                    type="button"
                                    aria-label="Tutup kartu kasus"
                                    onClick={() => setActiveCase(null)}
                                    className="grid size-6 shrink-0 cursor-pointer place-items-center rounded text-muted-foreground transition-[color,background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-[var(--raised)] hover:text-foreground active:scale-[0.94]"
                                >
                                    <X className="size-3.5" aria-hidden />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Draggable Swipe-to-Dismiss Panel Filter Peta */}
                    <SpringSheet
                        contained
                        open={filterSheetOpen}
                        onOpenChange={setFilterSheetOpen}
                        title="Filter Lapisan Peta"
                        description="Tarik ke bawah untuk menutup panel filter"
                    >
                        <div className="space-y-3.5">
                            <div className="grid gap-2 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => setShowFacilities((v) => !v)}
                                    aria-pressed={showFacilities}
                                    className={cn(
                                        'flex cursor-pointer items-center justify-between rounded-[var(--radius-control)] border px-3 py-2.5 text-left text-[12.5px] transition-[color,background-color,border-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.98]',
                                        showFacilities
                                            ? 'border-[var(--accent)]/60 bg-[var(--accent-soft)] text-foreground'
                                            : 'border-[var(--border)] bg-[var(--ground)] text-muted-foreground',
                                    )}
                                >
                                    <span className="inline-flex items-center gap-2 font-medium">
                                        <Building2
                                            className="size-3.5 text-[#0284c7]"
                                            aria-hidden
                                        />
                                        Fasilitas Kesehatan
                                    </span>
                                    <span className="font-mono text-[11px] tabular-nums">
                                        {points.length}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setShowCases((v) => !v)}
                                    aria-pressed={showCases}
                                    className={cn(
                                        'flex cursor-pointer items-center justify-between rounded-[var(--radius-control)] border px-3 py-2.5 text-left text-[12.5px] transition-[color,background-color,border-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.98]',
                                        showCases
                                            ? 'border-[var(--accent)]/60 bg-[var(--accent-soft)] text-foreground'
                                            : 'border-[var(--border)] bg-[var(--ground)] text-muted-foreground',
                                    )}
                                >
                                    <span className="inline-flex items-center gap-2 font-medium">
                                        <Radar
                                            className="size-3.5 text-[#e11d48]"
                                            aria-hidden
                                        />
                                        Titik Kasus GPS
                                    </span>
                                    <span className="font-mono text-[11px] tabular-nums">
                                        {cases.length}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setOnlyClusters((v) => !v);
                                        if (!showCases) setShowCases(true);
                                    }}
                                    aria-pressed={onlyClusters}
                                    className={cn(
                                        'flex cursor-pointer items-center justify-between rounded-[var(--radius-control)] border px-3 py-2.5 text-left text-[12.5px] transition-[color,background-color,border-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.98]',
                                        onlyClusters
                                            ? 'border-[#e11d48]/60 bg-[#e11d48]/10 text-foreground'
                                            : 'border-[var(--border)] bg-[var(--ground)] text-muted-foreground',
                                    )}
                                >
                                    <span className="inline-flex items-center gap-2 font-medium">
                                        <span
                                            aria-hidden
                                            className="size-2.5 rounded-full border border-dashed border-[#e11d48] bg-[#e11d48]/30"
                                        />
                                        Hanya Klaster 100m
                                    </span>
                                    <span className="font-mono text-[11px] tabular-nums">
                                        {clusteredCasesCount}
                                    </span>
                                </button>

                                {zones.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowZones((v) => !v)}
                                        aria-pressed={showZones}
                                        className={cn(
                                            'flex cursor-pointer items-center justify-between rounded-[var(--radius-control)] border px-3 py-2.5 text-left text-[12.5px] transition-[color,background-color,border-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.98]',
                                            showZones
                                                ? 'border-[var(--accent)]/60 bg-[var(--accent-soft)] text-foreground'
                                                : 'border-[var(--border)] bg-[var(--ground)] text-muted-foreground',
                                        )}
                                    >
                                        <span className="inline-flex items-center gap-2 font-medium">
                                            <Layers
                                                className="size-3.5 text-[#0f766e]"
                                                aria-hidden
                                            />
                                            Zonasi Kelurahan
                                        </span>
                                        <span className="font-mono text-[11px] tabular-nums">
                                            {zones.length}
                                        </span>
                                    </button>
                                )}
                            </div>

                            {zones.length > 0 && showZones && (
                                <label className="block space-y-1.5">
                                    <span className="text-[11.5px] font-medium text-muted-foreground">
                                        Fokus Wilayah Kelurahan
                                    </span>
                                    <select
                                        aria-label="Fokus zona kelurahan di panel filter"
                                        value={selectedZoneId}
                                        onChange={(e) =>
                                            setSelectedZoneId(e.target.value)
                                        }
                                        className="h-9 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[12.5px] text-foreground outline-none focus:border-[var(--accent)]"
                                    >
                                        <option value="">
                                            Semua zona ({zones.length})
                                        </option>
                                        {zones.map((z) => (
                                            <option key={z.id} value={z.id}>
                                                Kel. {z.name} ({z.reportCount}{' '}
                                                kasus)
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}

                            <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowFacilities(true);
                                        setShowCases(true);
                                        setOnlyClusters(false);
                                        setShowZones(zones.length > 0);
                                        handleResetBounds();
                                    }}
                                    className="cursor-pointer text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    Reset semua filter
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterSheetOpen(false)}
                                    className="inline-flex h-8 cursor-pointer items-center rounded-[var(--radius-control)] bg-[var(--accent)] px-3.5 text-[12px] font-medium text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
                                >
                                    Terapkan
                                </button>
                            </div>
                        </div>
                    </SpringSheet>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                        {(
                            [
                                {
                                    id: 'faskes',
                                    label: `Faskes (${points.length})`,
                                },
                                {
                                    id: 'klaster',
                                    label: `Kasus GPS (${cases.length})`,
                                },
                                {
                                    id: 'zona',
                                    label: `Zona Kelurahan (${zones.length})`,
                                },
                            ] as const
                        ).map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTableTab(t.id)}
                                className={cn(
                                    'rounded-[var(--radius-control)] border px-2.5 py-1 text-[12px] font-medium transition-colors',
                                    tableTab === t.id
                                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                                        : 'border-[var(--border)] bg-[var(--surface)] text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div
                        className="overflow-y-auto rounded-[var(--radius-control)] border border-[var(--border)]"
                        style={{ maxHeight: height - 38 }}
                    >
                        {tableTab === 'faskes' && (
                            <table className="ledger">
                                <thead>
                                    <tr>
                                        <th scope="col">Fasilitas</th>
                                        <th scope="col">Jenis</th>
                                        <th scope="col">Koordinat GPS</th>
                                        <th scope="col" className="text-right">
                                            Laporan
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {points.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="py-6 text-center text-muted-foreground"
                                            >
                                                Belum ada faskes dengan
                                                koordinat GPS.
                                            </td>
                                        </tr>
                                    ) : (
                                        points.map((p) => (
                                            <tr key={p.id}>
                                                <td className="font-medium">
                                                    {p.name}
                                                </td>
                                                <td className="text-muted-foreground">
                                                    {TYPE_META[p.type]?.label ??
                                                        p.type}
                                                </td>
                                                <td className="font-mono text-[11.5px] text-muted-foreground">
                                                    {p.lat.toFixed(4)},{' '}
                                                    {p.lng.toFixed(4)}
                                                </td>
                                                <td className="num font-medium">
                                                    {formatNumber(p.n)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}

                        {tableTab === 'klaster' && (
                            <table className="ledger">
                                <thead>
                                    <tr>
                                        <th scope="col">No. Laporan</th>
                                        <th scope="col">Diagnosis</th>
                                        <th scope="col">Sumber Lapor</th>
                                        <th scope="col">Kelurahan</th>
                                        <th scope="col">Status</th>
                                        <th scope="col">Klaster 100m</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cases.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="py-6 text-center text-muted-foreground"
                                            >
                                                Belum ada kasus dengan titik
                                                koordinat GPS.
                                            </td>
                                        </tr>
                                    ) : (
                                        cases.map((c) => (
                                            <tr key={c.id}>
                                                <td>
                                                    <Link
                                                        href={`/laporan/${c.id}`}
                                                        className="font-mono text-[12.5px] font-medium text-[var(--accent)] hover:underline"
                                                    >
                                                        {c.reportNumber}
                                                    </Link>
                                                </td>
                                                <td>
                                                    <span className="text-[11px] font-semibold text-[var(--accent)]">
                                                        {c.caseType ?? 'DBD'}
                                                    </span>
                                                </td>
                                                <td className="text-[12px] text-muted-foreground">
                                                    {c.institutionName
                                                        ? `${c.institutionType === 'PUSKESMAS' ? 'PKM' : 'RS'} ${c.institutionName}`
                                                        : c.sourceType ===
                                                            'PUSKESMAS_POLI'
                                                          ? 'Puskesmas'
                                                          : 'Rumah Sakit'}
                                                </td>
                                                <td>{c.kelurahan ?? '-'}</td>
                                                <td className="text-[12px]">
                                                    {c.status}
                                                </td>
                                                <td className="font-mono text-[11.5px]">
                                                    {c.clusterId ? (
                                                        <span className="font-semibold text-[#e11d48]">
                                                            {c.clusterId}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">
                                                            Tunggal
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}

                        {tableTab === 'zona' && (
                            <table className="ledger">
                                <thead>
                                    <tr>
                                        <th scope="col">Kelurahan</th>
                                        <th scope="col">Kecamatan / Kota</th>
                                        <th scope="col">Puskesmas Pengampu</th>
                                        <th scope="col" className="text-right">
                                            Laporan
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {zones.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="py-6 text-center text-muted-foreground"
                                            >
                                                Belum ada poligon zonasi
                                                kelurahan.
                                            </td>
                                        </tr>
                                    ) : (
                                        zones.map((z) => (
                                            <tr key={z.id}>
                                                <td className="font-medium">
                                                    Kel. {z.name}
                                                </td>
                                                <td className="text-muted-foreground">
                                                    {z.kecamatan}, {z.kota}
                                                </td>
                                                <td className="text-[12px]">
                                                    {z.puskesmasNames.length > 0
                                                        ? z.puskesmasNames.join(
                                                              ', ',
                                                          )
                                                        : 'Belum dipetakan'}
                                                </td>
                                                <td className="num font-medium">
                                                    {formatNumber(
                                                        z.reportCount,
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            <figcaption className="sr-only">
                Peta sebaran {points.length} fasilitas kesehatan aktif,{' '}
                {cases.length} titik kasus, dan {zones.length} zonasi kelurahan.
            </figcaption>
        </figure>
    );
}

function fitMapToData(
    map: L.Map,
    points: FacilityPoint[],
    zones: KelurahanZone[],
    cases: CaseGeoPoint[],
    selectedZoneId: string,
    showZones: boolean,
) {
    try {
        const container = map.getContainer();
        if (!container) return;
        const size = map.getSize();
        if (size.x === 0 || size.y === 0) {
            map.invalidateSize();
        }

        if (selectedZoneId && showZones) {
            const target = zones.find((z) => z.id === selectedZoneId);
            if (target) {
                const bounds = computeBoundaryBounds(target.boundaryGeojson);
                if (bounds) {
                    map.fitBounds(bounds, {
                        padding: [28, 28],
                        maxZoom: 15,
                        animate: false,
                    });
                    return;
                }
            }
        }

        const coords: [number, number][] = [
            ...points.map((p): [number, number] => [p.lat, p.lng]),
            ...cases.map((c): [number, number] => [c.lat, c.lng]),
        ];

        if (showZones) {
            for (const z of zones) {
                const b = computeBoundaryBounds(z.boundaryGeojson);
                if (b) {
                    coords.push(b[0], b[1]);
                }
            }
        }

        if (coords.length === 0) return;

        if (coords.length === 1) {
            map.setView(coords[0], 13, { animate: false });
            return;
        }

        map.fitBounds(L.latLngBounds(coords), {
            padding: [28, 28],
            maxZoom: 14,
            animate: false,
        });
    } catch {
        // Safe guard against transient unmount
    }
}
