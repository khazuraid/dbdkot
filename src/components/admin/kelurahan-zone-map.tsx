'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@/app/map.css';
import type { GeoJsonObject } from 'geojson';
import {
    Check,
    Loader2,
    MapPin,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { KelurahanZoneOption } from '@/lib/domain/master';
import type { BoundaryCandidate } from '@/lib/geo/boundary';
import {
    computeBoundaryBounds,
    type BoundaryGeoJson,
    type LatLngBoundsPair,
} from '@/lib/geo/boundary-schema';
import { saveKelurahanBoundaryAction } from '@/app/(dashboard)/admin/kelurahan/actions';
import { Button } from '@/components/ui/button';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from '@/components/ui/input-group';
import { escapeHtml } from '@/lib/security';
import { cn } from '@/lib/utils';

const DEFAULT_CENTER: [number, number] = [-6.72, 108.55];
const DEFAULT_ZOOM = 6;

const SELECT_CONTROL =
    'h-9 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[13px] text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/15';

/** Red dashed boundary style matching maps administrative zone highlight. */
const ACTIVE_ZONE_STYLE: L.PathOptions = {
    color: '#dc2626',
    weight: 2.5,
    dashArray: '7 5',
    fillColor: '#dc2626',
    fillOpacity: 0.08,
};

const SAVED_ZONE_STYLE: L.PathOptions = {
    color: '#0f766e',
    weight: 1.75,
    dashArray: '4 4',
    fillColor: '#0f766e',
    fillOpacity: 0.06,
};

function mergeBounds(boxes: (LatLngBoundsPair | null)[]): LatLngBoundsPair | null {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const box of boxes) {
        if (!box) continue;
        minLat = Math.min(minLat, box[0][0]);
        minLng = Math.min(minLng, box[0][1]);
        maxLat = Math.max(maxLat, box[1][0]);
        maxLng = Math.max(maxLng, box[1][1]);
    }

    if (!Number.isFinite(minLat)) return null;
    return [
        [minLat, minLng],
        [maxLat, maxLng],
    ];
}

/**
 * Compact preview map used inside the Kelurahan create/edit dialog so
 * operators can inspect the red dashed polygon before clicking Simpan.
 * Uses native Leaflet to ensure strict DOM cleanup and eliminate concurrency race conditions.
 */
export function BoundaryPreviewMap({
    boundary,
    height = 200,
}: {
    boundary: BoundaryGeoJson;
    height?: number;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);

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
            zoom: 13,
            zoomControl: false,
            scrollWheelZoom: false,
            attributionControl: true,
        });
        mapRef.current = map;

        L.tileLayer('/api/tiles/{z}/{x}/{y}', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
        }).addTo(map);

        if (boundary) {
            try {
                const geo = L.geoJSON(boundary as unknown as GeoJsonObject, {
                    style: () => ACTIVE_ZONE_STYLE,
                }).addTo(map);
                const b = geo.getBounds();
                if (b.isValid()) {
                    map.fitBounds(b, { padding: [16, 16], maxZoom: 16 });
                }
            } catch {}
        }

        return () => {
            if (mapRef.current) {
                try {
                    mapRef.current.remove();
                } catch {}
                mapRef.current = null;
            }
            if (el && (el as any)._leaflet_id) {
                delete (el as any)._leaflet_id;
            }
        };
    }, [boundary]);

    return (
        <div
            ref={containerRef}
            className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)]"
            style={{ height }}
        />
    );
}

/**
 * Interactive administrative boundary map for /admin/kelurahan.
 * Searches OpenStreetMap polygons via `/api/geo/boundary`, highlights them with
 * a Google-Maps-style red dashed perimeter, and lets admins bind a polygon to
 * any registered kelurahan row in one click.
 */
export default function KelurahanZoneMap({
    zones,
    initialFocusId,
}: {
    zones: KelurahanZoneOption[];
    initialFocusId?: string | null;
}) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [candidates, setCandidates] = useState<BoundaryCandidate[]>([]);
    const [activeCandidateIdx, setActiveCandidateIdx] = useState(0);
    const [selectedZoneId, setSelectedZoneId] = useState<string>(
        initialFocusId ?? '',
    );
    const [targetKelurahanId, setTargetKelurahanId] = useState<string>(
        initialFocusId ?? '',
    );
    const [saving, startTransition] = useTransition();

    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layersGroupRef = useRef<L.LayerGroup | null>(null);

    const savedZones = useMemo(
        () =>
            zones.filter(
                (z): z is KelurahanZoneOption & { boundaryGeojson: BoundaryGeoJson } =>
                    z.boundaryGeojson !== null,
            ),
        [zones],
    );

    const activeCandidate = candidates[activeCandidateIdx] ?? null;

    const focusedSaved = useMemo(
        () => savedZones.find((z) => z.id === selectedZoneId) ?? null,
        [savedZones, selectedZoneId],
    );

    const activeBounds = useMemo(() => {
        if (activeCandidate) {
            return computeBoundaryBounds(activeCandidate.geojson);
        }
        if (focusedSaved) {
            return computeBoundaryBounds(focusedSaved.boundaryGeojson);
        }
        if (savedZones.length > 0) {
            const boxes = savedZones.map((z) =>
                computeBoundaryBounds(z.boundaryGeojson),
            );
            return mergeBounds(boxes);
        }
        return null;
    }, [activeCandidate, focusedSaved, savedZones]);

    // Initialize native Leaflet map once
    useEffect(() => {
        const el = mapContainerRef.current;
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
            scrollWheelZoom: false,
            attributionControl: true,
        });
        mapRef.current = map;

        L.tileLayer('/api/tiles/{z}/{x}/{y}', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
        }).addTo(map);

        L.control.zoom({ position: 'topright' }).addTo(map);

        const layerGroup = L.layerGroup().addTo(map);
        layersGroupRef.current = layerGroup;

        return () => {
            if (mapRef.current) {
                try {
                    mapRef.current.remove();
                } catch {}
                mapRef.current = null;
            }
            layersGroupRef.current = null;
            if (el && (el as any)._leaflet_id) {
                delete (el as any)._leaflet_id;
            }
        };
    }, []);

    // Synchronize layers and fit bounds on data changes
    useEffect(() => {
        const map = mapRef.current;
        const layerGroup = layersGroupRef.current;
        if (!map || !layerGroup) return;

        layerGroup.clearLayers();

        savedZones.forEach((z) => {
            const highlighted = !activeCandidate && z.id === selectedZoneId;
            const geoLayer = L.geoJSON(z.boundaryGeojson as unknown as GeoJsonObject, {
                style: () => (highlighted ? ACTIVE_ZONE_STYLE : SAVED_ZONE_STYLE),
            });

            const tooltipContent = `
                <div class="space-y-0.5 text-left text-xs">
                    <span class="font-semibold text-foreground">Kel. ${escapeHtml(z.name)}</span><br/>
                    <span class="text-[11.5px] text-muted-foreground">${escapeHtml(z.kecamatan)}, ${escapeHtml(z.kota)}</span><br/>
                    <span class="text-[11px] text-muted-foreground">${
                        z.puskesmasNames.length > 0
                            ? `Puskesmas: ${escapeHtml(z.puskesmasNames.join(', '))}`
                            : 'Belum ada puskesmas pengampu'
                    }</span>
                </div>
            `;
            geoLayer.bindTooltip(tooltipContent, { sticky: true });

            geoLayer.on('click', () => {
                setCandidates([]);
                setSelectedZoneId(z.id);
                setTargetKelurahanId(z.id);
            });

            geoLayer.addTo(layerGroup);
        });

        if (activeCandidate) {
            const candidateLayer = L.geoJSON(
                activeCandidate.geojson as unknown as GeoJsonObject,
                {
                    style: () => ACTIVE_ZONE_STYLE,
                },
            );
            const candTooltip = `
                <div class="space-y-0.5 text-left text-xs">
                    <span class="font-semibold text-[#b91c1c]">${escapeHtml(activeCandidate.displayName)}</span><br/>
                    <span class="text-[11px] text-muted-foreground">Kandidat zonasi belum tersimpan</span>
                </div>
            `;
            candidateLayer.bindTooltip(candTooltip, { sticky: true });
            candidateLayer.addTo(layerGroup);
        }

        if (activeBounds) {
            try {
                map.fitBounds(activeBounds, { padding: [24, 24], maxZoom: 15, animate: false });
            } catch {}
        }
    }, [savedZones, selectedZoneId, activeCandidate, activeBounds]);

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = query.trim();
        if (!trimmed) return;
        setSearching(true);
        setSearchError(null);
        try {
            const res = await fetch(
                `/api/geo/boundary?q=${encodeURIComponent(trimmed)}`,
            );
            const data = (await res.json()) as {
                candidates?: BoundaryCandidate[];
                error?: string;
            };
            if (!res.ok) {
                setSearchError(data.error ?? 'Gagal mencari batas wilayah.');
                setCandidates([]);
                return;
            }
            const list = data.candidates ?? [];
            setCandidates(list);
            setActiveCandidateIdx(0);

            if (list.length === 0) {
                setSearchError(
                    'Poligon batas wilayah tidak ditemukan. Coba lengkapi dengan nama kota (mis. "Kesambi, Cirebon").',
                );
                return;
            }

            // Pre-select matching registered kelurahan if its name appears in the result.
            const first = list[0];
            const candidateLower = first.name.toLowerCase();
            const match = zones.find(
                (z) =>
                    z.name.trim().toLowerCase() === candidateLower ||
                    first.displayName
                        .toLowerCase()
                        .includes(z.name.trim().toLowerCase()),
            );
            if (match) {
                setTargetKelurahanId(match.id);
                setSelectedZoneId(match.id);
            }
        } catch {
            setSearchError('Tidak dapat terhubung ke server pencarian peta.');
        } finally {
            setSearching(false);
        }
    }

    function handleSaveCandidate() {
        if (!activeCandidate) return;
        if (!targetKelurahanId) {
            toast.error('Pilih kelurahan tujuan lebih dulu.');
            return;
        }
        startTransition(async () => {
            const res = await saveKelurahanBoundaryAction(
                targetKelurahanId,
                activeCandidate.geojson,
            );
            if (!res.ok) {
                toast.error(res.error ?? 'Gagal menyimpan zonasi.');
                return;
            }
            const target = zones.find((z) => z.id === targetKelurahanId);
            toast.success(
                `Batas zonasi berhasil disimpan untuk Kelurahan ${target?.name ?? ''}.`,
            );
            setCandidates([]);
            setSelectedZoneId(targetKelurahanId);
            router.refresh();
        });
    }

    function handleDeleteBoundary(kelurahanId: string) {
        startTransition(async () => {
            const res = await saveKelurahanBoundaryAction(kelurahanId, null);
            if (!res.ok) {
                toast.error(res.error ?? 'Gagal menghapus zonasi.');
                return;
            }
            toast.success('Batas zonasi berhasil dihapus.');
            if (selectedZoneId === kelurahanId) {
                setSelectedZoneId('');
            }
            router.refresh();
        });
    }

    return (
        <div className="space-y-3.5">
            {/* Search and mapping control bar */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <form
                    onSubmit={handleSearch}
                    className="flex flex-1 items-center gap-2"
                >
                    <InputGroup className="h-9 flex-1">
                        <InputGroupAddon>
                            <Search className="size-4 text-muted-foreground" aria-hidden />
                        </InputGroupAddon>
                        <InputGroupInput
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Cari batas wilayah OSM (mis. Kesambi, Cirebon)..."
                        />
                    </InputGroup>
                    <Button
                        type="submit"
                        size="sm"
                        disabled={searching || !query.trim()}
                        className="h-9 shrink-0 gap-1.5"
                    >
                        {searching ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                            <Search className="size-3.5" aria-hidden />
                        )}
                        <span>Cari Peta</span>
                    </Button>
                </form>

                {/* Direct kelurahan selector to inspect already saved polygons */}
                <div className="w-full sm:w-64 shrink-0">
                    <select
                        aria-label="Pilih kelurahan untuk inspeksi zonasi"
                        value={selectedZoneId}
                        onChange={(e) => {
                            const val = e.target.value;
                            setSelectedZoneId(val);
                            if (val) setTargetKelurahanId(val);
                            setCandidates([]);
                        }}
                        className={SELECT_CONTROL}
                    >
                        <option value="">-- Lihat Batas Tersimpan --</option>
                        {zones.map((z) => (
                            <option key={z.id} value={z.id}>
                                {z.name} {z.boundaryGeojson ? '✓' : '(belum ada)'}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {searchError && (
                <div className="rounded-[var(--radius-control)] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-900 dark:text-amber-200">
                    {searchError}
                </div>
            )}

            {/* Candidate selection and save bar */}
            {candidates.length > 0 && activeCandidate && (
                <div className="space-y-2 rounded-[var(--radius-control)] border border-[#dc2626]/30 bg-[#dc2626]/5 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[12px] font-medium text-foreground">
                            Hasil pencarian OpenStreetMap ({candidates.length})
                        </p>
                        <span className="text-[11.5px] text-muted-foreground">
                            Pilih hasil untuk melihat garis batas merah putus-putus
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        {candidates.map((c, idx) => {
                            const active = idx === activeCandidateIdx;
                            return (
                                <button
                                    key={c.placeId}
                                    type="button"
                                    onClick={() => setActiveCandidateIdx(idx)}
                                    className={cn(
                                        'inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-1 text-left text-[12px] transition-colors',
                                        active
                                            ? 'border-[#dc2626] bg-[#dc2626]/10 font-medium text-[#b91c1c] dark:text-[#fca5a5]'
                                            : 'border-[var(--border)] bg-[var(--surface)] text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <MapPin className="size-3 shrink-0" aria-hidden />
                                    <span className="truncate max-w-[320px]">
                                        {c.displayName}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-1 items-center gap-2">
                            <label
                                htmlFor="target-kelurahan"
                                className="text-[12px] text-muted-foreground shrink-0"
                            >
                                Simpan ke kelurahan:
                            </label>
                            <select
                                id="target-kelurahan"
                                value={targetKelurahanId}
                                onChange={(e) => setTargetKelurahanId(e.target.value)}
                                className={cn(SELECT_CONTROL, 'h-8 text-[12.5px]')}
                            >
                                <option value="">-- Pilih Kelurahan --</option>
                                {zones.map((z) => (
                                    <option key={z.id} value={z.id}>
                                        {z.name} ({z.kecamatan})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setCandidates([])}
                                className="h-8 gap-1 text-[12px]"
                            >
                                <X className="size-3" aria-hidden />
                                <span>Batal</span>
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                disabled={saving || !targetKelurahanId}
                                onClick={handleSaveCandidate}
                                className="h-8 gap-1.5 bg-[#dc2626] text-white hover:bg-[#b91c1c] text-[12px]"
                            >
                                {saving ? (
                                    <Loader2 className="size-3 animate-spin" aria-hidden />
                                ) : (
                                    <Check className="size-3" aria-hidden />
                                )}
                                <span>Terapkan Zonasi</span>
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Interactive Map Canvas */}
            <div
                className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)]"
                style={{ height: 340 }}
            >
                <div
                    ref={mapContainerRef}
                    className="h-full w-full"
                />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
                <div className="flex flex-wrap items-center gap-4">
                    <span className="inline-flex items-center gap-1.5">
                        <span
                            aria-hidden
                            className="inline-block w-4 border-t-2 border-dashed border-[#dc2626]"
                        />
                        Zonasi aktif / pencarian
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span
                            aria-hidden
                            className="inline-block w-4 border-t-2 border-dashed border-[#0f766e]"
                        />
                        Zonasi tersimpan ({savedZones.length})
                    </span>
                </div>

                {focusedSaved && !activeCandidate && (
                    <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        disabled={saving}
                        onClick={() => handleDeleteBoundary(focusedSaved.id)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1"
                    >
                        <Trash2 className="size-3" aria-hidden />
                        <span>Hapus zonasi {focusedSaved.name}</span>
                    </Button>
                )}
            </div>
        </div>
    );
}
