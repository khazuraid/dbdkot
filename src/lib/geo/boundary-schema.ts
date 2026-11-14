import { z } from 'zod';

export type Position = [number, number];

export type PolygonGeoJson = {
    type: 'Polygon';
    coordinates: Position[][];
};

export type MultiPolygonGeoJson = {
    type: 'MultiPolygon';
    coordinates: Position[][][];
};

export type BoundaryGeoJson = PolygonGeoJson | MultiPolygonGeoJson;

const positionSchema = z
    .tuple([
        z.number().finite().min(-180).max(180),
        z.number().finite().min(-90).max(90),
    ])
    .rest(z.number().finite());

const ringSchema = z.array(positionSchema).min(4);

const polygonSchema = z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(ringSchema).min(1),
});

const multiPolygonSchema = z.object({
    type: z.literal('MultiPolygon'),
    coordinates: z.array(z.array(ringSchema).min(1)).min(1),
});

export const MAX_BOUNDARY_JSON_BYTES = 512 * 1024;

export const boundaryGeoJsonSchema = z
    .union([polygonSchema, multiPolygonSchema])
    .refine(
        (value) => JSON.stringify(value).length <= MAX_BOUNDARY_JSON_BYTES,
        'Data batas wilayah terlalu besar (maksimal 512 KB).',
    );

export function parseBoundaryGeoJson(raw: unknown): BoundaryGeoJson | null {
    if (raw === null || raw === undefined || raw === '') return null;
    let value = raw;
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return null;
        if (trimmed.length > MAX_BOUNDARY_JSON_BYTES) return null;
        try {
            value = JSON.parse(trimmed);
        } catch {
            return null;
        }
    }
    const parsed = boundaryGeoJsonSchema.safeParse(value);
    if (!parsed.success) return null;
    return parsed.data as BoundaryGeoJson;
}

export type LatLngBoundsPair = [[number, number], [number, number]];

export function computeBoundaryBounds(
    geojson: BoundaryGeoJson,
): LatLngBoundsPair | null {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    const visitRing = (ring: Position[]) => {
        for (const [lng, lat] of ring) {
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
        }
    };

    if (geojson.type === 'Polygon') {
        for (const ring of geojson.coordinates) visitRing(ring);
    } else {
        for (const poly of geojson.coordinates) {
            for (const ring of poly) visitRing(ring);
        }
    }

    if (!Number.isFinite(minLat)) return null;
    return [
        [minLat, minLng],
        [maxLat, maxLng],
    ];
}
