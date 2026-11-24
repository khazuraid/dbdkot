import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/session';
import { consumeRateLimit } from '@/lib/rate-limit';
import { isValidWilayahCode } from '@/lib/security';
import {
    getProvinces,
    getCities,
    getDistricts,
    getVillages,
} from '@/lib/services/sumopod';

export async function GET(req: Request) {
    let actor;
    try {
        actor = await requireActor();
    } catch {
        return NextResponse.json(
            { error: 'Sesi berakhir. Masuk ulang.' },
            { status: 401 },
        );
    }

    const limit = await consumeRateLimit(`api:wilayah:${actor.userId}`, 60, 60);
    if (!limit.allowed) {
        return NextResponse.json(
            { error: 'Terlalu banyak permintaan. Coba sebentar lagi.' },
            {
                status: 429,
                headers: { 'Retry-After': String(limit.retryAfter ?? 60) },
            },
        );
    }

    const { searchParams } = new URL(req.url);
    const level = searchParams.get('level') || 'provinsi';
    const q = searchParams.get('q')?.trim().slice(0, 100) || undefined;

    try {
        if (level === 'provinsi') {
            const provinces = await getProvinces(q);
            return NextResponse.json({ data: provinces });
        }

        if (level === 'kota') {
            const provinsiCode = (searchParams.get('provinsi') || '32').trim();
            if (!isValidWilayahCode(provinsiCode)) {
                return NextResponse.json(
                    { error: 'Kode provinsi tidak valid' },
                    { status: 400 },
                );
            }
            const cities = await getCities(provinsiCode, q);
            return NextResponse.json({ data: cities });
        }

        if (level === 'kecamatan') {
            const kotaCode = (searchParams.get('kota') || '3274').trim();
            if (!isValidWilayahCode(kotaCode)) {
                return NextResponse.json(
                    { error: 'Kode kota tidak valid' },
                    { status: 400 },
                );
            }
            const districts = await getDistricts(kotaCode, q);
            return NextResponse.json({ data: districts });
        }

        if (level === 'kelurahan') {
            const kecamatanCode = (searchParams.get('kecamatan') || '').trim();
            if (kecamatanCode && !isValidWilayahCode(kecamatanCode)) {
                return NextResponse.json(
                    { error: 'Kode kecamatan tidak valid' },
                    { status: 400 },
                );
            }
            const kecamatanName =
                searchParams.get('kecamatanName')?.trim().slice(0, 100) || undefined;
            const villages = await getVillages(kecamatanCode, kecamatanName, q);
            return NextResponse.json({ data: villages });
        }

        return NextResponse.json(
            { error: 'Level wilayah tidak valid (pilihan: provinsi, kota, kecamatan, kelurahan)' },
            { status: 400 },
        );
    } catch (error) {
        console.error('Error fetching wilayah:', error);
        return NextResponse.json(
            { error: 'Gagal memuat data wilayah' },
            { status: 500 },
        );
    }
}
