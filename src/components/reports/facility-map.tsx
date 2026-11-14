'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import '@/app/map.css';
import Link from 'next/link';
import type { GeoJsonObject } from 'geojson';
import {
    Building2,
    Crosshair,
    Layers,
    LocateFixed,
    MapPin,
    Radar,
    Table2,
    X,
} from 'lucide-react';
import type {
    CaseGeoPoint,
    FacilityPoint,
    KelurahanZone,
} from '@/lib/domain/map-data';
import { computeBoundaryBounds } from '@/lib/geo/boundary-schema';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

const TYPE_META: Record<
    string,
    { label: string; color: string; hex: string }
> = {
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
    const [view, setView] = useState<'map' | 'table'>('map');
    const [tableTab, setTableTab] = useState<'faskes' | 'zona' | 'klaster'>(
        'faskes',
    );
    const [showFacilities, setShowFacilities] = useState(true);
    const [showCases, setShowCases] = useState(true);
    const [showZones, setShowZones] = useState(zones.length > 0);
    const [selectedZoneId, setSelectedZoneId] = useState('');
    const [activeCase, setActiveCase] = useState<CaseGeoPoint | null>(null);
    const [locating, setLocating] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layerGroupsRef = useRef<{
        zones: L.LayerGroup;
        facilities: L.LayerGroup;
        rings: L.LayerGroup;
        cases: L.LayerGroup | null;
    } | null>(null);

    const max = useMemo(
        () => Math.max(...points.map((p) => p.n), 1),
        [points],
    );

    const clusteredCasesCount = useMemo(
        () => cases.filter((c) => Boolean(c.clusterId)).length,
        [cases],
    );

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

        if ((el as unknown as { _leaflet_id?: number | null })._leaflet_id) {
            (el as unknown as { _leaflet_id?: number | null })._leaflet_id =
                null;
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
                mapRef.current.remove();
                mapRef.current = null;
            }
            layerGroupsRef.current = null;
            if (el) {
                (el as unknown as { _leaflet_id?: number | null })._leaflet_id =
                    null;
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
                            <strong>Kel. ${z.name}</strong><br/>
                            <span style="color:#64748b;">${z.kecamatan}, ${z.kota}</span><br/>
                            <span><strong>${formatNumber(z.reportCount)}</strong> laporan${
                                z.puskesmasNames.length > 0
                                    ? ` · ${z.puskesmasNames.join(', ')}`
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
                        <strong>${p.name}</strong><br/>
                        <span style="color:#64748b;">${meta.label}</span> · <strong>${formatNumber(p.n)}</strong> laporan
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

        if (showCases && cases.length > 0) {
            for (const c of cases) {
                if (c.clusterId) {
                    const ring = L.circle([c.lat, c.lng], {
                        radius: 100,
                        color: '#e11d48',
                        weight: 1.5,
                        dashArray: '5 4',
                        fillColor: '#e11d48',
                        fillOpacity: 0.14,
                    });
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

            for (const c of cases) {
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
                        <strong style="font-family:monospace;">${c.reportNumber}</strong> (${c.caseType ?? 'Kasus'})<br/>
                        <span style="color:#64748b;">Sumber: ${sourceLabel}</span><br/>
                        <span style="color:#64748b;">Kel. ${c.kelurahan ?? '-'}</span>
                        ${isClustered ? '<br/><span style="color:#e11d48;font-weight:600;">Klaster 100m</span>' : ''}
                    </div>`,
                    { direction: 'top' },
                );
                marker.on('click', () => setActiveCase(c));
                clusterGroup.addLayer(marker);
            }

            map.addLayer(clusterGroup);
            groups.cases = clusterGroup;
        }

        // 4. Auto-fit bounds
        fitMapToData(map, points, zones, cases, selectedZoneId, showZones);
    }, [
        view,
        points,
        zones,
        cases,
        showFacilities,
        showCases,
        showZones,
        selectedZoneId,
        max,
    ]);

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
                        <Building2 className="size-3.5 text-[#0284c7]" aria-hidden />
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
                        <Radar className="size-3.5 text-[#e11d48]" aria-hidden />
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
                            <Layers className="size-3.5 text-[#0f766e]" aria-hidden />
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
                            <option value="">Semua zona ({zones.length})</option>
                            {zones.map((z) => (
                                <option key={z.id} value={z.id}>
                                    Kel. {z.name} ({z.reportCount})
                                </option>
                            ))}
                        </select>
                    )}

                    {view === 'map' && (
                        <button
                            type="button"
                            onClick={handleResetBounds}
                            title="Reset zoom ke seluruh wilayah"
                            className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <Crosshair className="size-3" aria-hidden />
                            Reset
                        </button>
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

                    {/* Selected Case Popover Card */}
                    {activeCase && (
                        <div className="absolute right-3 bottom-12 z-[450] flex items-start justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)]/95 p-3.5 shadow-[var(--elev-pop)] backdrop-blur-md sm:max-w-xs">
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-mono text-[13px] font-semibold text-foreground">
                                        {activeCase.reportNumber}
                                    </p>
                                    <span className="rounded bg-[var(--accent)]/10 px-1.5 py-0.2 text-[10.5px] font-semibold text-[var(--accent)]">
                                        {activeCase.caseType ?? 'DBD'}
                                    </span>
                                </div>
                                <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <span className="font-medium text-foreground">
                                        {activeCase.institutionName
                                            ? `${activeCase.institutionType === 'PUSKESMAS' ? 'PKM' : 'RS'} ${activeCase.institutionName}`
                                            : activeCase.sourceType === 'PUSKESMAS_POLI'
                                              ? 'Puskesmas'
                                              : 'Rumah Sakit'}
                                    </span>
                                </div>
                                <p className="truncate text-[12px] text-muted-foreground mt-0.5">
                                    Kel. {activeCase.kelurahan ?? '-'}
                                    {activeCase.kecamatan ? `, Kec. ${activeCase.kecamatan}` : ''}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                    Status: <span className="font-medium text-foreground">{activeCase.status}</span>
                                </p>
                                {activeCase.clusterId && (
                                    <p className="mt-1 font-mono text-[11px] font-semibold text-[#e11d48]">
                                        ● Klaster 100m ({activeCase.clusterId})
                                    </p>
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
                                className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-[var(--raised)] hover:text-foreground"
                            >
                                <X className="size-3.5" aria-hidden />
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                        {(
                            [
                                { id: 'faskes', label: `Faskes (${points.length})` },
                                { id: 'klaster', label: `Kasus GPS (${cases.length})` },
                                { id: 'zona', label: `Zona Kelurahan (${zones.length})` },
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
                                                Belum ada faskes dengan koordinat GPS.
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
                                                Belum ada kasus dengan titik koordinat GPS.
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
                                                    <span className="font-semibold text-[11px] text-[var(--accent)]">
                                                        {c.caseType ?? 'DBD'}
                                                    </span>
                                                </td>
                                                <td className="text-[12px] text-muted-foreground">
                                                    {c.institutionName
                                                        ? `${c.institutionType === 'PUSKESMAS' ? 'PKM' : 'RS'} ${c.institutionName}`
                                                        : c.sourceType === 'PUSKESMAS_POLI'
                                                          ? 'Puskesmas'
                                                          : 'Rumah Sakit'}
                                                </td>
                                                <td>{c.kelurahan ?? '-'}</td>
                                                <td className="text-[12px]">
                                                    {c.status}
                                                </td>
                                                <td className="font-mono text-[11.5px]">
                                                    {c.clusterId ? (
                                                        <span className="text-[#e11d48] font-semibold">
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
                                                Belum ada poligon zonasi kelurahan.
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
    if (selectedZoneId && showZones) {
        const target = zones.find((z) => z.id === selectedZoneId);
        if (target) {
            const bounds = computeBoundaryBounds(target.boundaryGeojson);
            if (bounds) {
                map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
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
        map.setView(coords[0], 13);
        return;
    }

    map.fitBounds(L.latLngBounds(coords), {
        padding: [28, 28],
        maxZoom: 14,
    });
}
