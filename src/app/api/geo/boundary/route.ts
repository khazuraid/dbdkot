import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/session';
import { searchBoundaryCandidates } from '@/lib/geo/boundary';

/**
 * Proxies administrative boundary polygon lookups to OpenStreetMap Nominatim.
 * Requires an authenticated session so unauthenticated visitors cannot use the
 * server as an open geocoder proxy.
 */
export async function GET(request: Request) {
    try {
        await requireActor();
    } catch {
        return NextResponse.json(
            { error: 'Sesi berakhir. Masuk ulang.' },
            { status: 401 },
        );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() ?? '';

    if (q.length < 2) {
        return NextResponse.json(
            { error: 'Masukkan minimal 2 karakter nama kelurahan atau wilayah.' },
            { status: 400 },
        );
    }
    if (q.length > 160) {
        return NextResponse.json(
            { error: 'Kata kunci terlalu panjang.' },
            { status: 400 },
        );
    }

    try {
        const candidates = await searchBoundaryCandidates(q);
        return NextResponse.json({ candidates });
    } catch (error) {
        console.error('boundary lookup failed', error);
        return NextResponse.json(
            {
                error: 'Layanan pencarian batas wilayah tidak merespons. Coba sesaat lagi.',
            },
            { status: 502 },
        );
    }
}
