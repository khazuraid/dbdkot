import { NextResponse } from 'next/server';

/**
 * Tile proxy. The browser asks this origin for a tile, this server asks the
 * upstream, so `img-src 'self'` and `connect-src 'self'` keep holding and no
 * viewer's IP reaches the tile server.
 *
 * The upstream is one fixed host (override with TILE_UPSTREAM to point at your
 * own tile server; OSM's usage policy only tolerates light use and forbids
 * redistributing their tiles as part of a product, so self-hosted tiles are
 * the right answer if this app sees real traffic).
 *
 * Only z/x/y integers that exist at that zoom are accepted, so the route can
 * never be aimed somewhere else.
 */

const UPSTREAM = process.env.TILE_UPSTREAM ?? 'https://tile.openstreetmap.org';
const MAX_ZOOM = 19;

export type TileStyle = 'osm' | 'positron' | 'dark_matter';

/** Tiles are immutable per coordinate; a small in-process cache stops a
 *  panning user from re-hitting the upstream for a tile already fetched. */
const CACHE_MAX = 256;

/** Well above a 512px PNG tile, well below anything that threatens the heap. */
const MAX_TILE_BYTES = 1_000_000;
const cache = new Map<string, ArrayBuffer>();

function cacheGet(key: string) {
    const hit = cache.get(key);
    if (hit) {
        // Re-insert so the oldest entry is the first to be evicted.
        cache.delete(key);
        cache.set(key, hit);
    }
    return hit;
}

function cacheSet(key: string, body: ArrayBuffer) {
    if (cache.size >= CACHE_MAX) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, body);
}

export async function proxyTile(
    zs: string,
    xs: string,
    ys: string,
    style: TileStyle = 'osm',
): Promise<NextResponse> {
    const z = Number(zs);
    const x = Number(xs);
    const y = Number(ys);
    const limit = 2 ** z;

    if (
        !Number.isInteger(z) ||
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        z < 0 ||
        z > MAX_ZOOM ||
        x < 0 ||
        y < 0 ||
        x >= limit ||
        y >= limit
    ) {
        return NextResponse.json(
            { error: 'Koordinat petak tidak valid.' },
            { status: 400 },
        );
    }

    const baseUpstream = UPSTREAM;
    const coord = `${z}/${x}/${y}`;
    const cacheKey = style === 'osm' ? coord : `${style}/${coord}`;
    const cached = cacheGet(cacheKey);
    if (cached) return tileResponse(cached);

    let upstream: Response;
    try {
        upstream = await fetch(`${baseUpstream}/${coord}.png`, {
            // The upstream is operator-set; a redirect away from it would turn
            // a tile request into a request to whatever host it names.
            redirect: 'error',
            headers: {
                // Both OSM and most self-hosted servers reject a generic agent.
                'User-Agent':
                    process.env.TILE_USER_AGENT ??
                    'app-dbd/1.0 (Sistem Surveilans DBD)',
                Accept: 'image/png,image/*',
            },
            signal: AbortSignal.timeout(8000),
        });
    } catch {
        return NextResponse.json(
            { error: 'Petak peta tidak dapat dimuat.' },
            { status: 504 },
        );
    }

    if (!upstream.ok) {
        return NextResponse.json(
            { error: 'Petak peta tidak dapat dimuat.' },
            { status: 502 },
        );
    }

    // A tile is a few tens of KB. An unbounded read lets an upstream (or a
    // misconfigured one) fill the process heap with 256 cached bodies.
    if (Number(upstream.headers.get('content-length') ?? 0) > MAX_TILE_BYTES) {
        return NextResponse.json(
            { error: 'Petak peta terlalu besar.' },
            { status: 502 },
        );
    }

    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_TILE_BYTES) {
        return NextResponse.json(
            { error: 'Petak peta terlalu besar.' },
            { status: 502 },
        );
    }
    cacheSet(cacheKey, body);
    return tileResponse(body);
}

function tileResponse(body: ArrayBuffer) {
    return new NextResponse(body, {
        headers: {
            'Content-Type': 'image/png',
            // A tile for a coordinate never changes.
            'Cache-Control': 'public, max-age=604800, immutable',
        },
    });
}
