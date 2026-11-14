import { NextResponse } from 'next/server';
import {
    getProvinces,
    getCities,
    getDistricts,
    getVillages,
} from '@/lib/services/sumopod';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const level = searchParams.get('level') || 'provinsi';
    const q = searchParams.get('q')?.trim() || undefined;

    try {
        if (level === 'provinsi') {
            const provinces = await getProvinces(q);
            return NextResponse.json({ data: provinces });
        }

        if (level === 'kota') {
            const provinsiCode = searchParams.get('provinsi') || '32'; // Default Jawa Barat
            const cities = await getCities(provinsiCode, q);
            return NextResponse.json({ data: cities });
        }

        if (level === 'kecamatan') {
            const kotaCode = searchParams.get('kota') || '3274'; // Default Kota Cirebon (32.74)
            const districts = await getDistricts(kotaCode, q);
            return NextResponse.json({ data: districts });
        }

        if (level === 'kelurahan') {
            const kecamatanCode = searchParams.get('kecamatan') || '';
            const kecamatanName = searchParams.get('kecamatanName') || undefined;
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
