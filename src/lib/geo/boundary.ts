import {
    parseBoundaryGeoJson,
    type BoundaryGeoJson,
} from './boundary-schema';

export type BoundaryCandidate = {
    placeId: number;
    displayName: string;
    name: string;
    category: string;
    type: string;
    addresstype: string;
    lat: number;
    lng: number;
    geojson: BoundaryGeoJson;
};

type CacheEntry = {
    expiresAt: number;
    candidates: BoundaryCandidate[];
};

const NOMINATIM_SEARCH =
    process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org/search';
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 128;
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): BoundaryCandidate[] | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
        cache.delete(key);
        return null;
    }
    cache.delete(key);
    cache.set(key, entry);
    return entry.candidates;
}

function cacheSet(key: string, candidates: BoundaryCandidate[]) {
    if (cache.size >= CACHE_MAX) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        candidates,
    });
}

type NominatimItem = {
    place_id?: number;
    display_name?: string;
    name?: string;
    category?: string;
    type?: string;
    addresstype?: string;
    lat?: string;
    lon?: string;
    geojson?: unknown;
};

function scoreCandidate(item: NominatimItem): number {
    let score = 0;
    if (item.category === 'boundary' || item.type === 'administrative') {
        score += 4;
    }
    if (
        item.addresstype === 'village' ||
        item.addresstype === 'suburb' ||
        item.addresstype === 'quarter' ||
        item.addresstype === 'neighbourhood'
    ) {
        score += 3;
    }
    return score;
}

async function fetchNominatim(query: string): Promise<BoundaryCandidate[]> {
    const url = new URL(NOMINATIM_SEARCH);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('polygon_geojson', '1');
    url.searchParams.set('countrycodes', 'id');
    url.searchParams.set('limit', '6');

    const res = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'Accept-Language': 'id,en;q=0.8',
            'User-Agent': 'wali-epi-surveilans/1.0 (https://localhost)',
        },
        signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
        throw new Error(`Nominatim HTTP ${res.status}`);
    }

    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw)) return [];

    const scored: { score: number; candidate: BoundaryCandidate }[] = [];
    for (const item of raw as NominatimItem[]) {
        const geojson = parseBoundaryGeoJson(item.geojson);
        if (!geojson) continue;
        const lat = Number(item.lat);
        const lng = Number(item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        scored.push({
            score: scoreCandidate(item),
            candidate: {
                placeId: Number(item.place_id ?? scored.length + 1),
                displayName: String(item.display_name ?? query),
                name: String(item.name ?? item.display_name ?? query),
                category: String(item.category ?? ''),
                type: String(item.type ?? ''),
                addresstype: String(item.addresstype ?? ''),
                lat,
                lng,
                geojson,
            },
        });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.candidate);
}

/**
 * Queries OpenStreetMap Nominatim for administrative polygon boundaries in
 * Indonesia. Runs strictly server-side so `connect-src 'self'` CSP remains
 * intact and viewer IPs never reach external geocoders.
 */
export async function searchBoundaryCandidates(
    rawQuery: string,
): Promise<BoundaryCandidate[]> {
    const q = rawQuery.trim().replace(/\s+/g, ' ');
    if (q.length < 2 || q.length > 160) return [];

    const cacheKey = q.toLowerCase();
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    let candidates = await fetchNominatim(q);

    // Users often type just "Kesambi Cirebon" without "Kelurahan"; try a gentle
    // fallback if the bare query returned no polygon.
    if (
        candidates.length === 0 &&
        !/\b(kelurahan|desa|kecamatan)\b/i.test(q)
    ) {
        candidates = await fetchNominatim(`Kelurahan ${q}`);
    }

    cacheSet(cacheKey, candidates);
    return candidates;
}
