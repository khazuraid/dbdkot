/**
 * Service integrasi API Wilayah Indonesia dari Sumopod (https://api-services-docs.sumopod.com).
 * Menyediakan data administratif terstandarisasi:
 * - Provinsi (38 provinsi)
 * - Kota / Kabupaten
 * - Kecamatan
 * - Kelurahan / Desa
 */

import { getDb } from '@/db';
import { kelurahan, systemSettings } from '@/db/schema';
import { and, eq, ilike, or, sql } from 'drizzle-orm';

export type SumopodProvince = {
    kode: string;
    nama: string;
};

export type SumopodRegencyCity = {
    kode: string;
    kode_provinsi: string;
    nama: string;
    tipe: 'kabupaten' | 'kota';
};

export type SumopodDistrict = {
    kode: string;
    kode_kota: string;
    nama: string;
};

export type SumopodVillage = {
    kode: string;
    kode_kecamatan: string;
    nama: string;
    tipe: 'kelurahan' | 'desa' | 'desa_adat';
};

// Cache sederhana di memory (TTL 30 menit)
type CacheEntry<T> = { data: T; expiresAt: number };
const memoryCache = new Map<string, CacheEntry<unknown>>();

function getFromCache<T>(key: string): T | null {
    const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        memoryCache.delete(key);
        return null;
    }
    return entry.data;
}

function setToCache<T>(key: string, data: T, ttlMs = 30 * 60 * 1000): void {
    memoryCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export async function getSumopodConfig() {
    let apiKey = process.env.SUMOPOD_API_KEY?.trim() || '';
    let baseUrl =
        process.env.SUMOPOD_BASE_URL?.trim() || 'https://api-services.sumopod.com';

    try {
        const db = getDb();
        const rows = await db
            .select({ key: systemSettings.key, value: systemSettings.value })
            .from(systemSettings)
            .where(
                or(
                    eq(systemSettings.key, 'SUMOPOD_API_KEY'),
                    eq(systemSettings.key, 'REGIONAL_API_KEY'),
                    eq(systemSettings.key, 'SUMOPOD_BASE_URL'),
                    eq(systemSettings.key, 'REGIONAL_API_BASE_URL'),
                ),
            );
        for (const r of rows) {
            if (
                (r.key === 'SUMOPOD_API_KEY' || r.key === 'REGIONAL_API_KEY') &&
                r.value
            ) {
                apiKey = r.value.trim();
            }
            if (
                (r.key === 'SUMOPOD_BASE_URL' ||
                    r.key === 'REGIONAL_API_BASE_URL') &&
                r.value
            ) {
                baseUrl = r.value.trim();
            }
        }
    } catch {
        // Fallback to env
    }

    return { apiKey, baseUrl };
}

async function fetchFromSumopod<T>(
    endpoint: string,
    params?: Record<string, string>,
    retries = 3,
): Promise<T | null> {
    const { apiKey, baseUrl } = await getSumopodConfig();
    if (!apiKey) {
        return null;
    }

    const url = new URL(`${baseUrl}${endpoint}`);
    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            if (v) url.searchParams.set(k, v);
        });
    }

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'x-api-key': apiKey,
                    Accept: 'application/json',
                },
                next: { revalidate: 3600 }, // 1 jam ISR cache Next.js
            });

            if (response.status === 429) {
                // Rate limited: backoff 500ms * (attempt + 1)
                await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
                continue;
            }

            if (!response.ok) {
                console.warn(
                    `Sumopod API returned status ${response.status} for ${endpoint}`,
                );
                return null;
            }

            const json = await response.json();
            return (json?.data ?? json) as T;
        } catch (error) {
            if (attempt === retries - 1) {
                console.error(`Failed to fetch from Sumopod (${endpoint}):`, error);
                return null;
            }
            await new Promise((r) => setTimeout(r, 300));
        }
    }
    return null;
}

/**
 * Mengambil daftar 38 provinsi di Indonesia.
 */
export async function getProvinces(q?: string): Promise<SumopodProvince[]> {
    const cacheKey = `provinces:${q ?? ''}`;
    const cached = getFromCache<SumopodProvince[]>(cacheKey);
    if (cached) return cached;

    const data = await fetchFromSumopod<SumopodProvince[]>('/api/v1/wilayah/provinsi', {
        ...(q ? { q } : {}),
        perPage: '100',
    });

    if (data && Array.isArray(data) && data.length > 0) {
        setToCache(cacheKey, data);
        return data;
    }

    // Fallback: Daftar provinsi umum di Indonesia
    return [
        { kode: '32', nama: 'Jawa Barat' },
        { kode: '31', nama: 'DKI Jakarta' },
        { kode: '33', nama: 'Jawa Tengah' },
        { kode: '35', nama: 'Jawa Timur' },
        { kode: '34', nama: 'DI Yogyakarta' },
        { kode: '36', nama: 'Banten' },
        { kode: '51', nama: 'Bali' },
        { kode: '12', nama: 'Sumatera Utara' },
        { kode: '13', nama: 'Sumatera Barat' },
        { kode: '73', nama: 'Sulawesi Selatan' },
    ];
}

/**
 * Mengambil daftar kota/kabupaten berdasarkan kode provinsi (cth: "32" untuk Jawa Barat).
 */
export async function getCities(provinceCode: string, q?: string): Promise<SumopodRegencyCity[]> {
    const cacheKey = `cities:${provinceCode}:${q ?? ''}`;
    const cached = getFromCache<SumopodRegencyCity[]>(cacheKey);
    if (cached) return cached;

    const data = await fetchFromSumopod<SumopodRegencyCity[]>(`/api/v1/wilayah/provinsi/${provinceCode}/kota`, {
        ...(q ? { q } : {}),
        perPage: '100',
    });

    if (data && Array.isArray(data) && data.length > 0) {
        setToCache(cacheKey, data);
        return data;
    }

    // Fallback lokal jika Jawa Barat (32)
    if (provinceCode === '32') {
        return [
            { kode: '3273', kode_provinsi: '32', nama: 'Kota Bandung', tipe: 'kota' },
            { kode: '3204', kode_provinsi: '32', nama: 'Kabupaten Bandung', tipe: 'kabupaten' },
            { kode: '3217', kode_provinsi: '32', nama: 'Kabupaten Bandung Barat', tipe: 'kabupaten' },
            { kode: '3277', kode_provinsi: '32', nama: 'Kota Cimahi', tipe: 'kota' },
            { kode: '3211', kode_provinsi: '32', nama: 'Kabupaten Sumedang', tipe: 'kabupaten' },
        ];
    }

    return [];
}

/**
 * Mengambil daftar kecamatan berdasarkan kode kota/kabupaten (cth: "3273" untuk Kota Bandung).
 */
export async function getDistricts(cityCode: string, q?: string): Promise<SumopodDistrict[]> {
    const cacheKey = `districts:${cityCode}:${q ?? ''}`;
    const cached = getFromCache<SumopodDistrict[]>(cacheKey);
    if (cached) return cached;

    const data = await fetchFromSumopod<SumopodDistrict[]>(`/api/v1/wilayah/kota/${cityCode}/kecamatan`, {
        ...(q ? { q } : {}),
        perPage: '100',
    });

    if (data && Array.isArray(data) && data.length > 0) {
        setToCache(cacheKey, data);
        return data;
    }

    // Fallback ke database lokal kelurahan WALI-EPI jika query kota Bandung
    try {
        const db = getDb();
        const results = await db
            .select({ kecamatan: kelurahan.kecamatan })
            .from(kelurahan)
            .where(q ? ilike(kelurahan.kecamatan, `%${q}%`) : sql`true`)
            .groupBy(kelurahan.kecamatan)
            .orderBy(kelurahan.kecamatan);

        return results.map((r, idx) => ({
            kode: `${cityCode}${String(idx + 1).padStart(2, '0')}`,
            kode_kota: cityCode,
            nama: r.kecamatan,
        }));
    } catch {
        return [];
    }
}

/**
 * Mengambil daftar kelurahan/desa berdasarkan kode kecamatan.
 */
export async function getVillages(districtCode: string, districtName?: string, q?: string): Promise<SumopodVillage[]> {
    const cacheKey = `villages:${districtCode}:${q ?? ''}`;
    const cached = getFromCache<SumopodVillage[]>(cacheKey);
    if (cached) return cached;

    const data = await fetchFromSumopod<SumopodVillage[]>(`/api/v1/wilayah/kecamatan/${districtCode}/kelurahan`, {
        ...(q ? { q } : {}),
        perPage: '100',
    });

    if (data && Array.isArray(data) && data.length > 0) {
        setToCache(cacheKey, data);
        return data;
    }

    // Fallback ke database lokal WALI-EPI
    try {
        const db = getDb();
        const conditions = [];
        if (districtName) {
            conditions.push(ilike(kelurahan.kecamatan, districtName));
        }
        if (q) {
            conditions.push(ilike(kelurahan.name, `%${q}%`));
        }

        const results = await db
            .select({ name: kelurahan.name, kecamatan: kelurahan.kecamatan })
            .from(kelurahan)
            .where(conditions.length ? sql.join(conditions, sql` and `) : sql`true`)
            .orderBy(kelurahan.name);

        return results.map((r, idx) => ({
            kode: `${districtCode}${String(idx + 1).padStart(4, '0')}`,
            kode_kecamatan: districtCode,
            nama: r.name,
            tipe: 'kelurahan',
        }));
    } catch {
        return [];
    }
}

export type SumopodSyncResult = {
    ok: boolean;
    error?: string;
    totalDistricts: number;
    totalVillagesFromApi: number;
    createdCount: number;
    existingCount: number;
    items: Array<{
        name: string;
        kecamatan: string;
        status: 'CREATED' | 'EXISTING';
    }>;
};

/**
 * Sinkronisasi otomatis seluruh kelurahan Kota Cirebon (5 Kecamatan, 22 Kelurahan)
 * langsung dari API Sumopod resmi ke database WALI-EPI.
 */
export async function syncAllKelurahanKotaCirebon(): Promise<SumopodSyncResult> {
    const { apiKey } = await getSumopodConfig();
    if (!apiKey) {
        return {
            ok: false,
            error: 'API Key Sumopod belum dikonfigurasi di Pengaturan > API Wilayah.',
            totalDistricts: 0,
            totalVillagesFromApi: 0,
            createdCount: 0,
            existingCount: 0,
            items: [],
        };
    }

    const cityCode = '3274'; // Kota Cirebon
    const districts = await getDistricts(cityCode);
    if (!districts || districts.length === 0) {
        return {
            ok: false,
            error: 'Gagal memuat daftar kecamatan Kota Cirebon dari Sumopod API.',
            totalDistricts: 0,
            totalVillagesFromApi: 0,
            createdCount: 0,
            existingCount: 0,
            items: [],
        };
    }

    const db = getDb();
    let totalVillages = 0;
    let createdCount = 0;
    let existingCount = 0;
    const items: Array<{
        name: string;
        kecamatan: string;
        status: 'CREATED' | 'EXISTING';
    }> = [];

    for (const district of districts) {
        // Jeda 250ms untuk menghindari rate-limit burst
        await new Promise((r) => setTimeout(r, 250));
        const villages = await getVillages(district.kode, district.nama);
        if (!villages || villages.length === 0) continue;

        totalVillages += villages.length;

        for (const v of villages) {
            const trimmedName = v.nama.trim();
            const trimmedDistrict = district.nama.trim();

            const existing = await db
                .select({ id: kelurahan.id })
                .from(kelurahan)
                .where(
                    and(
                        ilike(kelurahan.name, trimmedName),
                        ilike(kelurahan.kecamatan, trimmedDistrict),
                    ),
                )
                .limit(1);

            if (existing.length === 0) {
                const now = new Date();
                await db.insert(kelurahan).values({
                    id: crypto.randomUUID(),
                    name: trimmedName,
                    kecamatan: trimmedDistrict,
                    kota: 'Kota Cirebon',
                    provinsi: 'Jawa Barat',
                    boundaryGeojson: null,
                    createdAt: now,
                    updatedAt: now,
                });
                createdCount++;
                items.push({
                    name: trimmedName,
                    kecamatan: trimmedDistrict,
                    status: 'CREATED',
                });
            } else {
                existingCount++;
                items.push({
                    name: trimmedName,
                    kecamatan: trimmedDistrict,
                    status: 'EXISTING',
                });
            }
        }
    }

    return {
        ok: true,
        totalDistricts: districts.length,
        totalVillagesFromApi: totalVillages,
        createdCount,
        existingCount,
        items,
    };
}
