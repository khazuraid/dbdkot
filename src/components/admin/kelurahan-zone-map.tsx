'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
import {
    GeoJSON,
    MapContainer,
    TileLayer,
    Tooltip,
    useMap,
} from 'react-leaflet';
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
import { cn } from '@/lib/utils';

const DEFAULT_CENTER: [number, number] = [-6.72, 108.55];
const DEFAULT_ZOOM = 6;

const SELECT_CONTROL =
    'h-9 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[13px] text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/15';

/** Red dashed boundary style matching maps administrative zone highlight. */
const ACTIVE_ZONE_STYLE = {
    color: '#dc2626',
    weight: 2.5,
    dashArray: '7 5',
    fillColor: '#dc2626',
    fillOpacity: 0.08,
};

const SAVED_ZONE_STYLE = {
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

function FitBoundaryBounds({ bounds }: { bounds: LatLngBoundsPair | null }) {
    const map = useMap();

    useEffect(() => {
        if (!bounds) return;
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    }, [map, bounds]);

    return null;
}

/**
 * Compact preview map used inside the Kelurahan create/edit dialog so
 * operators can inspect the red dashed polygon before clicking Simpan.
 */
export function BoundaryPreviewMap({
    boundary,
    height = 200,
}: {
    boundary: BoundaryGeoJson;
    height?: number;
}) {
    const bounds = useMemo(() => computeBoundaryBounds(boundary), [boundary]);
    const renderKey = useMemo(() => {
        const s = JSON.stringify(boundary);
        return `${boundary.type}-${s.length}-${s.slice(0, 40)}`;
    }, [boundary]);

    return (
        <div
            className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)]"
            style={{ height }}
        >
            <MapContainer
                center={DEFAULT_CENTER}
                zoom={13}
                scrollWheelZoom={false}
                className="h-full w-full"
                attributionControl
            >
                <FitBoundaryBounds bounds={bounds} />
                <TileLayer
                    url="/api/tiles/{z}/{x}/{y}"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    maxZoom={19}
                />
                <GeoJSON
                    key={renderKey}
                    data={boundary as unknown as GeoJsonObject}
                    style={() => ACTIVE_ZONE_STYLE}
                />
            </MapContainer>
        </div>
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
            return mergeBounds(
                savedZones.map((z) => computeBoundaryBounds(z.boundaryGeojson)),
            );
        }
        return null;
    }, [activeCandidate, focusedSaved, savedZones]);

    async function runSearch(e?: React.FormEvent) {
        e?.preventDefault();
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            setSearchError('Ketik minimal 2 karakter nama kelurahan atau kota.');
            return;
        }
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
                setSearchError(
                    data.error ?? 'Pencarian batas wilayah gagal.',
                );
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
                `Zonasi peta disimpan untuk ${target?.name ?? 'kelurahan'}.`,
            );
            setSelectedZoneId(targetKelurahanId);
            setCandidates([]);
            router.refresh();
        });
    }

    function handleClearSaved(id: string, name: string) {
        startTransition(async () => {
            const res = await saveKelurahanBoundaryAction(id, null);
            if (!res.ok) {
                toast.error(res.error ?? 'Gagal menghapus zonasi.');
                return;
            }
            toast.success(`Zonasi peta ${name} dihapus.`);
            if (selectedZoneId === id) setSelectedZoneId('');
            router.refresh();
        });
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                <form
                    onSubmit={runSearch}
                    className="flex flex-1 flex-wrap items-center gap-2"
                >
                    <InputGroup className="h-9 min-w-[220px] flex-1 sm:max-w-[360px]">
                        <InputGroupAddon>
                            <Search className="size-4" aria-hidden />
                        </InputGroupAddon>
                        <InputGroupInput
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Cari zonasi kelurahan (mis. Kesambi, Cirebon)…"
                            aria-label="Cari zonasi kelurahan di peta"
                        />
                    </InputGroup>
                    <Button type="submit" size="sm" disabled={searching}>
                        {searching ? (
                            <>
                                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                                Mencari…
                            </>
                        ) : (
                            'Cari zonasi'
                        )}
                    </Button>
                    {candidates.length > 0 && (
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setCandidates([]);
                                setSearchError(null);
                            }}
                        >
                            <X className="size-3.5" aria-hidden /> Bersihkan hasil
                        </Button>
                    )}
                </form>

                {savedZones.length > 0 && (
                    <div className="flex items-center gap-2">
                        <label
                            htmlFor="saved-zone-select"
                            className="shrink-0 text-[12px] text-muted-foreground"
                        >
                            Zonasi tersimpan:
                        </label>
                        <select
                            id="saved-zone-select"
                            value={selectedZoneId}
                            onChange={(e) => {
                                setSelectedZoneId(e.target.value);
                                setTargetKelurahanId(e.target.value);
                                setCandidates([]);
                            }}
                            className={cn(SELECT_CONTROL, 'w-[220px]')}
                        >
                            <option value="">
                                Semua ({savedZones.length} kelurahan)
                            </option>
                            {savedZones.map((z) => (
                                <option key={z.id} value={z.id}>
                                    {z.name} · {z.kota}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {searchError && (
                <p
                    role="alert"
                    className="rounded-[var(--radius-control)] border border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] px-3 py-2 text-[12.5px] text-[var(--pill-warning-ink)]"
                >
                    {searchError}
                </p>
            )}

            {candidates.length > 0 && (
                <div className="space-y-2.5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/45 p-3">
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

                    {zones.length > 0 && activeCandidate && (
                        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--rule)] pt-2.5">
                            <span className="text-[12px] text-muted-foreground">
                                Simpan batas ini ke:
                            </span>
                            <select
                                aria-label="Pilih kelurahan terdaftar"
                                value={targetKelurahanId}
                                onChange={(e) =>
                                    setTargetKelurahanId(e.target.value)
                                }
                                className={cn(SELECT_CONTROL, 'w-[240px]')}
                            >
                                <option value="">Pilih kelurahan…</option>
                                {zones.map((z) => (
                                    <option key={z.id} value={z.id}>
                                        {z.name} ({z.kecamatan}, {z.kota})
                                    </option>
                                ))}
                            </select>
                            <Button
                                type="button"
                                size="sm"
                                disabled={!targetKelurahanId || saving}
                                onClick={handleSaveCandidate}
                            >
                                <Check className="size-3.5" aria-hidden />
                                {saving ? 'Menyimpan…' : 'Simpan zonasi'}
                            </Button>
                        </div>
                    )}
                </div>
            )}

            <div
                className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)]"
                style={{ height: 340 }}
            >
                <MapContainer
                    center={DEFAULT_CENTER}
                    zoom={DEFAULT_ZOOM}
                    scrollWheelZoom={false}
                    className="h-full w-full"
                    attributionControl
                >
                    <FitBoundaryBounds bounds={activeBounds} />
                    <TileLayer
                        url="/api/tiles/{z}/{x}/{y}"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        maxZoom={19}
                    />

                    {savedZones.map((z) => {
                        const highlighted =
                            !activeCandidate && z.id === selectedZoneId;
                        return (
                            <GeoJSON
                                key={`saved-${z.id}-${highlighted ? 'hi' : 'base'}-${JSON.stringify(z.boundaryGeojson).length}`}
                                data={
                                    z.boundaryGeojson as unknown as GeoJsonObject
                                }
                                style={() =>
                                    highlighted
                                        ? ACTIVE_ZONE_STYLE
                                        : SAVED_ZONE_STYLE
                                }
                                eventHandlers={{
                                    click: () => {
                                        setCandidates([]);
                                        setSelectedZoneId(z.id);
                                        setTargetKelurahanId(z.id);
                                    },
                                }}
                            >
                                <Tooltip sticky>
                                    <span className="font-semibold text-foreground">
                                        Kel. {z.name}
                                    </span>
                                    <br />
                                    <span className="text-[11.5px] text-muted-foreground">
                                        {z.kecamatan}, {z.kota}
                                    </span>
                                    <br />
                                    <span className="text-[11px] text-muted-foreground">
                                        {z.puskesmasNames.length > 0
                                            ? `Puskesmas: ${z.puskesmasNames.join(', ')}`
                                            : 'Belum ada puskesmas pengampu'}
                                    </span>
                                </Tooltip>
                            </GeoJSON>
                        );
                    })}

                    {activeCandidate && (
                        <GeoJSON
                            key={`candidate-${activeCandidate.placeId}`}
                            data={
                                activeCandidate.geojson as unknown as GeoJsonObject
                            }
                            style={() => ACTIVE_ZONE_STYLE}
                        >
                            <Tooltip sticky>
                                <span className="font-semibold text-foreground">
                                    {activeCandidate.name}
                                </span>
                                <br />
                                <span className="text-[11px] text-muted-foreground">
                                    Pratinjau batas OpenStreetMap
                                </span>
                            </Tooltip>
                        </GeoJSON>
                    )}
                </MapContainer>
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
                        onClick={() =>
                            handleClearSaved(focusedSaved.id, focusedSaved.name)
                        }
                        className="text-muted-foreground hover:text-[var(--negative)]"
                    >
                        <Trash2 className="size-3" aria-hidden /> Hapus zonasi{' '}
                        {focusedSaved.name}
                    </Button>
                )}
            </div>
        </div>
    );
}
