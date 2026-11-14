import { proxyTile, type TileStyle } from '@/lib/tiles';

/**
 * Map tiles, proxied so the browser never talks to a third-party tile server.
 * Supports CartoDB Positron (`?style=positron`) and Dark Matter (`?style=dark_matter`)
 * while preserving `img-src 'self'` CSP.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
    const { z, x, y } = await params;
    const rawStyle = new URL(request.url).searchParams.get('style');
    const style: TileStyle =
        rawStyle === 'positron' || rawStyle === 'dark_matter' ? rawStyle : 'osm';
    return proxyTile(z, x, y, style);
}
