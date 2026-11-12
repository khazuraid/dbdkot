import { count, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import {
    assets,
    institutions,
    kelurahan,
    masterData,
    systemSettings,
} from '@/db/schema';
import { scopeToInstitution, type Actor } from '@/lib/session';

export async function listAssets(actor: Actor, page?: number, perPage = 25) {
    const db = getDb();
    const institutionId = scopeToInstitution(actor);
    const size = Math.min(100, Math.max(1, perPage));
    const current = Math.max(1, Math.floor(page ?? 1));
    const scope = institutionId
        ? eq(assets.institutionId, institutionId)
        : sql`true`;

    const [rows, [totals]] = await Promise.all([
        db
            .select({
                id: assets.id,
                code: assets.code,
                name: assets.name,
                category: assets.category,
                unit: assets.unit,
                currentStock: assets.currentStock,
                minimumStock: assets.minimumStock,
                institutionName: institutions.name,
            })
            .from(assets)
            .leftJoin(institutions, eq(institutions.id, assets.institutionId))
            .where(scope)
            .orderBy(assets.name)
            .limit(size)
            .offset((current - 1) * size),
        db.select({ n: count() }).from(assets).where(scope),
    ]);

    return {
        rows,
        page: current,
        perPage: size,
        total: Number(totals?.n ?? 0),
    };
}

export async function listKelurahan() {
    return getDb()
        .select({
            id: kelurahan.id,
            name: kelurahan.name,
            kecamatan: kelurahan.kecamatan,
            kota: kelurahan.kota,
            provinsi: kelurahan.provinsi,
        })
        .from(kelurahan)
        .orderBy(kelurahan.kota, kelurahan.kecamatan, kelurahan.name)
        .limit(500);
}

export async function listMasterData() {
    return getDb()
        .select({
            id: masterData.id,
            type: masterData.type,
            code: masterData.code,
            name: masterData.name,
            isActive: masterData.isActive,
        })
        .from(masterData)
        .orderBy(masterData.type, masterData.name)
        .limit(500);
}

/** Settings are global, but secrets must never render: `isPublic` gates them. */
export async function listSettings(onlyPublic: boolean) {
    return getDb()
        .select({
            id: systemSettings.id,
            key: systemSettings.key,
            value: systemSettings.value,
            category: systemSettings.category,
            description: systemSettings.description,
        })
        .from(systemSettings)
        .where(onlyPublic ? eq(systemSettings.isPublic, true) : sql`true`)
        .orderBy(systemSettings.category, systemSettings.key)
        .limit(200);
}
