'use server';

import { revalidatePath } from 'next/cache';
import { requireActor } from '@/lib/session';
import { createReport, createReportSchema } from '@/lib/domain/report-create';

export type FormState = {
    error?: string;
    fieldErrors?: Record<string, string>;
    ok?: boolean;
};

export async function submitReport(
    _prev: FormState,
    formData: FormData,
): Promise<FormState> {
    const parsed = createReportSchema.safeParse(Object.fromEntries(formData));

    if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
            const key = String(issue.path[0] ?? 'form');
            fieldErrors[key] ??= issue.message;
        }
        return { fieldErrors };
    }

    const actor = await requireActor();
    const result = await createReport(actor, parsed.data);

    if (!result.ok) {
        return { error: result.error };
    }

    revalidatePath('/laporan');
    revalidatePath('/dasbor');

    return { ok: true };
}

export type GeocodeResult = {
    ok: boolean;
    lat?: number;
    lng?: number;
    displayName?: string;
    isFallback?: boolean;
    error?: string;
};

export async function geocodePatientAddress(params: {
    address?: string;
    kelurahan?: string;
    kecamatan?: string;
    kota?: string;
}): Promise<GeocodeResult> {
    await requireActor();

    const NOMINATIM_SEARCH =
        process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org/search';

    const clean = (s?: string) => (s ?? '').trim();
    const addr = clean(params.address);
    const kel = clean(params.kelurahan);
    const kec = clean(params.kecamatan);
    const kota = clean(params.kota);

    const queries: { q: string; isFallback: boolean }[] = [];

    if (addr && (kel || kec || kota)) {
        queries.push({
            q: [addr, kel, kec, kota, 'Indonesia'].filter(Boolean).join(', '),
            isFallback: false,
        });
    }

    if (kel && (kec || kota)) {
        queries.push({
            q: [`Kelurahan ${kel}`, kec, kota, 'Indonesia'].filter(Boolean).join(', '),
            isFallback: true,
        });
        queries.push({
            q: [kel, kec, kota, 'Indonesia'].filter(Boolean).join(', '),
            isFallback: true,
        });
    }

    if (kec && kota) {
        queries.push({
            q: [`Kecamatan ${kec}`, kota, 'Indonesia'].filter(Boolean).join(', '),
            isFallback: true,
        });
    } else if (kota) {
        queries.push({
            q: [kota, 'Indonesia'].filter(Boolean).join(', '),
            isFallback: true,
        });
    }

    if (queries.length === 0) {
        return {
            ok: false,
            error: 'Mohon isi alamat domisili atau pilih kelurahan/kecamatan terlebih dahulu.',
        };
    }

    for (const { q, isFallback } of queries) {
        try {
            const url = new URL(NOMINATIM_SEARCH);
            url.searchParams.set('q', q);
            url.searchParams.set('format', 'jsonv2');
            url.searchParams.set('countrycodes', 'id');
            url.searchParams.set('limit', '1');

            const res = await fetch(url, {
                headers: {
                    Accept: 'application/json',
                    'Accept-Language': 'id,en;q=0.8',
                    'User-Agent': 'wali-epi-surveilans/1.0 (https://localhost)',
                },
                signal: AbortSignal.timeout(6000),
            });

            if (!res.ok) continue;

            const items = (await res.json()) as {
                lat?: string;
                lon?: string;
                display_name?: string;
            }[];

            if (Array.isArray(items) && items.length > 0) {
                const first = items[0];
                const lat = Number(first?.lat);
                const lng = Number(first?.lon);
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    return {
                        ok: true,
                        lat: Math.round(lat * 1_000_000) / 1_000_000,
                        lng: Math.round(lng * 1_000_000) / 1_000_000,
                        displayName: first?.display_name ?? q,
                        isFallback,
                    };
                }
            }
        } catch {
            // Coba query berikutnya
        }
    }

    return {
        ok: false,
        error: 'Koordinat tidak ditemukan di peta untuk alamat tersebut. Silakan periksa kembali nama kelurahan/kecamatan.',
    };
}
