import {
    and,
    count,
    eq,
    ilike,
    or,
    sql,
    type SQL,
} from 'drizzle-orm';
import type { BoundaryGeoJson } from '@/lib/geo/boundary-schema';
import { getDb } from '@/db';
import { assets, institutions, kelurahan, users } from '@/db/schema';
import { audit } from '@/lib/audit';
import { scopeToInstitution, type Actor } from '@/lib/session';
import type { Role } from '@/lib/roles';
import type {
    AssetInput,
    InstitutionInput,
    KelurahanInput,
} from './form-contracts';

/**
 * Reads and writes for the screens an administrator keeps by hand: institutions
 * (with the kelurahan coverage that decides report assignment), kelurahan, and
 * assets. The flows they feed — report assignment, PE, approval — keep their
 * own modules; this one never writes a report.
 *
 * Every write is audited with the before/after of the fields that changed, so
 * "who edited the puskesmas coverage" is answerable from audit_logs alone.
 */

export type WriteResult<
    E extends string = 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT',
> = { ok: true; id: string } | { ok: false; error: E; message: string };

export type ListQuery = { q?: string; page?: number; perPage?: number };

function pageOf(q: ListQuery, defaultSize = 25) {
    const size = Math.min(100, Math.max(1, q.perPage ?? defaultSize));
    const page = Math.max(1, Math.floor(q.page ?? 1));
    return { size, page, offset: (page - 1) * size };
}

/**
 * An administratively-kept table belongs to ADMIN and DINKES.
 *
 * `requireRole` on the page that rendered the form is decoration — a server
 * action is a public POST endpoint — so the check has to live here, on the
 * write itself. DINKES is included because it is the tier that maintains the
 * facility list operationally; the account roster stays ADMIN-only in its own
 * module.
 */
const REGISTRY_EDITORS: Role[] = ['ADMIN', 'DINKES'];

function isAdmin(actor: Actor) {
    return REGISTRY_EDITORS.includes(actor.role);
}

function duplicate(error: unknown) {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === '23505'
    );
}

/** `undefined` in the input means "leave as is" on update, NULL on create. */
function changedFields<T extends Record<string, unknown>>(
    before: T,
    after: Partial<T>,
) {
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(after) as (keyof T)[]) {
        const next = after[key];
        if (next === undefined) continue;
        if (JSON.stringify(before[key]) !== JSON.stringify(next)) {
            changes[String(key)] = { from: before[key], to: next };
        }
    }
    return changes;
}

/* ── institusi ─────────────────────────────────────────────────────────── */

export type InstitutionTypeFilter =
    | 'RUMAH_SAKIT'
    | 'PUSKESMAS'
    | 'DINAS_KESEHATAN';

export async function listInstitutionsPaged(
    q: ListQuery & { type?: InstitutionTypeFilter } = {},
) {
    const db = getDb();
    const { size, page, offset } = pageOf(q);
    const search = q.q?.trim();
    const conditions: SQL[] = [];
    if (search) {
        const searchCond = or(
            ilike(institutions.name, `%${search}%`),
            ilike(institutions.city, `%${search}%`),
        );
        if (searchCond) conditions.push(searchCond);
    }
    if (q.type) {
        conditions.push(eq(institutions.type, q.type));
    }
    const where: SQL | undefined =
        conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totals], [summaryRow]] = await Promise.all([
        db
            .select({
                id: institutions.id,
                name: institutions.name,
                type: institutions.type,
                city: institutions.city,
                province: institutions.province,
                // Selected because the edit dialog seeds from these: a form
                // field with no stored value in the row it seeds from saves
                // blank, which is how an edit used to erase them.
                address: institutions.address,
                phoneNumber: institutions.phoneNumber,
                latitude: institutions.latitude,
                longitude: institutions.longitude,
                kelurahanList: institutions.kelurahanList,
                isActive: institutions.isActive,
                userCount:
                    sql<number>`(select count(*) from ${users} where ${users.institutionId} = ${institutions.id})`.mapWith(
                        Number,
                    ),
            })
            .from(institutions)
            .where(where)
            .orderBy(institutions.name)
            .limit(size)
            .offset(offset),
        db.select({ n: count() }).from(institutions).where(where),
        db
            .select({
                total: count(),
                puskesmas: sql<number>`count(*) filter (where ${institutions.type} = 'PUSKESMAS')`.mapWith(
                    Number,
                ),
                rumahSakit: sql<number>`count(*) filter (where ${institutions.type} = 'RUMAH_SAKIT')`.mapWith(
                    Number,
                ),
                uncoveredPuskesmas:
                    sql<number>`count(*) filter (where ${institutions.type} = 'PUSKESMAS' and ${institutions.isActive} = true and coalesce(array_length(${institutions.kelurahanList}, 1), 0) = 0)`.mapWith(
                        Number,
                    ),
            })
            .from(institutions),
    ]);

    return {
        rows,
        page,
        perPage: size,
        total: Number(totals?.n ?? 0),
        summary: {
            total: Number(summaryRow?.total ?? 0),
            puskesmas: Number(summaryRow?.puskesmas ?? 0),
            rumahSakit: Number(summaryRow?.rumahSakit ?? 0),
            uncoveredPuskesmas: Number(summaryRow?.uncoveredPuskesmas ?? 0),
        },
    };
}

/** Every institution, for a picker. Small enough by design (tens, not thousands). */
export async function institutionChoices() {
    return getDb()
        .select({
            id: institutions.id,
            name: institutions.name,
            type: institutions.type,
        })
        .from(institutions)
        .where(eq(institutions.isActive, true))
        .orderBy(institutions.name);
}

function institutionValues(input: InstitutionInput) {
    return {
        name: input.name,
        type: input.type,
        address: input.address ?? null,
        province: input.province ?? null,
        city: input.city ?? null,
        subDistrict: input.subDistrict ?? null,
        phoneNumber: input.phoneNumber ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        kelurahanList:
            input.type === 'PUSKESMAS' ? (input.kelurahanList ?? []) : [],
        isActive: input.isActive ?? true,
    };
}

/**
 * For an UPDATE: only the columns the parsed input actually carries. An absent
 * key means the form did not render that field, not that the operator cleared
 * it, so it must not be written — `undefined` on a value the create path maps
 * to `null` is the difference between "untouched" and "wiped".
 */
function presentValues(input: InstitutionInput) {
    const full = institutionValues(input);
    // Filter on the VALUE, not on key presence: the contract keeps a blanked
    // field as `undefined`, and that is exactly the "operator cleared it"
    // case that must write NULL.
    return Object.fromEntries(
        Object.entries(full).filter(([, value]) => value !== undefined),
    ) as Partial<typeof full>;
}

export async function createInstitution(
    actor: Actor,
    input: InstitutionInput,
): Promise<WriteResult> {
    if (!isAdmin(actor)) {
        return {
            ok: false,
            error: 'FORBIDDEN',
            message: 'Hanya admin atau dinkes.',
        };
    }

    try {
        const [row] = await getDb()
            .insert(institutions)
            .values(institutionValues(input))
            .returning({ id: institutions.id });

        await audit({
            actor,
            action: 'CREATE',
            entityType: 'INSTITUTION',
            entityId: row.id,
            changes: { name: { from: null, to: input.name } },
        });

        return { ok: true, id: row.id };
    } catch (error) {
        console.error('createInstitution failed', error);
        return {
            ok: false,
            error: 'CONFLICT',
            message: 'Institusi gagal dibuat.',
        };
    }
}

export async function updateInstitution(
    actor: Actor,
    id: string,
    input: InstitutionInput,
): Promise<WriteResult> {
    if (!isAdmin(actor)) {
        return {
            ok: false,
            error: 'FORBIDDEN',
            message: 'Hanya admin atau dinkes.',
        };
    }

    const db = getDb();
    const [before] = await db
        .select()
        .from(institutions)
        .where(eq(institutions.id, id))
        .limit(1);

    if (!before) {
        return {
            ok: false,
            error: 'NOT_FOUND',
            message: 'Institusi tidak ditemukan.',
        };
    }

    // Only the columns this submit actually carries are written. `toValues` on
    // the edit dialog sends the fields the dialog shows, and a full
    // `set(institutionValues(input))` turned every absent optional into NULL —
    // editing a name silently wiped the stored address, phone and coordinates,
    // and the audit row recorded that wipe. Blanking a field on purpose still
    // works: the form sends '' for it, which lands as NULL. `name`, `type` and
    // `kelurahanList` are always sent, so they are always written.
    const values = presentValues(input);
    const changes = changedFields(before, values);

    if (Object.keys(changes).length === 0) return { ok: true, id };

    await db.update(institutions).set(values).where(eq(institutions.id, id));
    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'INSTITUTION',
        entityId: id,
        changes,
    });

    return { ok: true, id };
}

/**
 * Deleting is refused while anything still points at the row: users carry an
 * institution and assets are owned by one, and the FK is `set null` — which
 * would quietly orphan an account instead of telling the operator. Deactivate
 * (`isActive = false`) is the intended retire path and stays available.
 */
export async function deleteInstitution(
    actor: Actor,
    id: string,
): Promise<WriteResult> {
    if (!isAdmin(actor)) {
        return {
            ok: false,
            error: 'FORBIDDEN',
            message: 'Hanya admin atau dinkes.',
        };
    }

    const db = getDb();
    const [usage] = await db
        .select({
            users: sql<number>`(select count(*) from ${users} where ${users.institutionId} = ${id})`.mapWith(
                Number,
            ),
            assets: sql<number>`(select count(*) from ${assets} where ${assets.institutionId} = ${id})`.mapWith(
                Number,
            ),
            reports:
                sql<number>`(select count(*) from reports_rs where institution_id = ${id} or assigned_puskesmas_id = ${id})`.mapWith(
                    Number,
                ),
        })
        .from(institutions)
        .where(eq(institutions.id, id))
        .limit(1);

    if (!usage) {
        return {
            ok: false,
            error: 'NOT_FOUND',
            message: 'Institusi tidak ditemukan.',
        };
    }

    const inUse = usage.users + usage.assets + usage.reports;
    if (inUse > 0) {
        return {
            ok: false,
            error: 'CONFLICT',
            message: `Masih dipakai ${usage.users} akun, ${usage.assets} aset, ${usage.reports} laporan. Nonaktifkan saja, atau pindahkan dulu.`,
        };
    }

    const [row] = await db
        .select({ name: institutions.name })
        .from(institutions)
        .where(eq(institutions.id, id));
    await db.delete(institutions).where(eq(institutions.id, id));
    await audit({
        actor,
        action: 'DELETE',
        entityType: 'INSTITUTION',
        entityId: id,
        changes: { name: { from: row?.name ?? null, to: null } },
    });

    return { ok: true, id };
}

/* ── kelurahan ─────────────────────────────────────────────────────────── */

export async function listKelurahanOptions() {
    return getDb()
        .select({
            name: kelurahan.name,
            kecamatan: kelurahan.kecamatan,
            kota: kelurahan.kota,
            provinsi: kelurahan.provinsi,
        })
        .from(kelurahan)
        .orderBy(kelurahan.name, kelurahan.kecamatan);
}

export async function listKelurahanPaged(q: ListQuery = {}) {
    const db = getDb();
    const { size, page, offset } = pageOf(q, 50);
    const search = q.q?.trim();
    const where: SQL | undefined = search
        ? or(
              ilike(kelurahan.name, `%${search}%`),
              ilike(kelurahan.kecamatan, `%${search}%`),
              ilike(kelurahan.kota, `%${search}%`),
          )
        : undefined;

    const [rawRows, [totals], [summaryRow], puskesmasRows, allKelurahanRows] =
        await Promise.all([
            db
                .select({
                    id: kelurahan.id,
                    name: kelurahan.name,
                    kecamatan: kelurahan.kecamatan,
                    kota: kelurahan.kota,
                    provinsi: kelurahan.provinsi,
                    boundaryGeojson: kelurahan.boundaryGeojson,
                })
                .from(kelurahan)
                .where(where)
                .orderBy(kelurahan.kota, kelurahan.kecamatan, kelurahan.name)
                .limit(size)
                .offset(offset),
            db.select({ n: count() }).from(kelurahan).where(where),
            db
                .select({
                    total: count(),
                    kecamatan: sql<number>`count(distinct lower(btrim(${kelurahan.kecamatan})))`.mapWith(
                        Number,
                    ),
                    kota: sql<number>`count(distinct lower(btrim(${kelurahan.kota})))`.mapWith(
                        Number,
                    ),
                    withBoundary: sql<number>`count(*) filter (where ${kelurahan.boundaryGeojson} is not null)`.mapWith(
                        Number,
                    ),
                })
                .from(kelurahan),
            db
                .select({
                    name: institutions.name,
                    kelurahanList: institutions.kelurahanList,
                })
                .from(institutions)
                .where(
                    and(
                        eq(institutions.type, 'PUSKESMAS'),
                        eq(institutions.isActive, true),
                    ),
                ),
            db.select({ name: kelurahan.name }).from(kelurahan),
        ]);

    const coverageMap = new Map<string, string[]>();
    for (const p of puskesmasRows) {
        for (const k of p.kelurahanList ?? []) {
            const norm = k.trim().toLowerCase();
            if (!norm) continue;
            const list = coverageMap.get(norm) ?? [];
            list.push(p.name);
            coverageMap.set(norm, list);
        }
    }

    const uncoveredTotal = allKelurahanRows.filter(
        (k) => !coverageMap.has(k.name.trim().toLowerCase()),
    ).length;

    const rows = rawRows.map((k) => ({
        ...k,
        puskesmasNames: coverageMap.get(k.name.trim().toLowerCase()) ?? [],
    }));

    return {
        rows,
        page,
        perPage: size,
        total: Number(totals?.n ?? 0),
        summary: {
            total: Number(summaryRow?.total ?? 0),
            kecamatan: Number(summaryRow?.kecamatan ?? 0),
            kota: Number(summaryRow?.kota ?? 0),
            uncovered: uncoveredTotal,
            withBoundary: Number(summaryRow?.withBoundary ?? 0),
        },
    };
}

export type KelurahanZoneOption = {
    id: string;
    name: string;
    kecamatan: string;
    kota: string;
    provinsi: string;
    boundaryGeojson: BoundaryGeoJson | null;
    puskesmasNames: string[];
};

export async function listKelurahanZoneOptions(): Promise<
    KelurahanZoneOption[]
> {
    const db = getDb();
    const [rows, puskesmasRows] = await Promise.all([
        db
            .select({
                id: kelurahan.id,
                name: kelurahan.name,
                kecamatan: kelurahan.kecamatan,
                kota: kelurahan.kota,
                provinsi: kelurahan.provinsi,
                boundaryGeojson: kelurahan.boundaryGeojson,
            })
            .from(kelurahan)
            .orderBy(kelurahan.kota, kelurahan.kecamatan, kelurahan.name),
        db
            .select({
                name: institutions.name,
                kelurahanList: institutions.kelurahanList,
            })
            .from(institutions)
            .where(
                and(
                    eq(institutions.type, 'PUSKESMAS'),
                    eq(institutions.isActive, true),
                ),
            ),
    ]);

    const coverageMap = new Map<string, string[]>();
    for (const p of puskesmasRows) {
        for (const k of p.kelurahanList ?? []) {
            const norm = k.trim().toLowerCase();
            if (!norm) continue;
            const list = coverageMap.get(norm) ?? [];
            list.push(p.name);
            coverageMap.set(norm, list);
        }
    }

    return rows.map((k) => ({
        ...k,
        puskesmasNames: coverageMap.get(k.name.trim().toLowerCase()) ?? [],
    }));
}

export async function createKelurahan(
    actor: Actor,
    input: KelurahanInput,
): Promise<WriteResult> {
    if (!isAdmin(actor)) {
        return {
            ok: false,
            error: 'FORBIDDEN',
            message: 'Hanya admin atau dinkes.',
        };
    }

    try {
        const [row] = await getDb()
            .insert(kelurahan)
            .values(input)
            .returning({ id: kelurahan.id });
        await audit({
            actor,
            action: 'CREATE',
            entityType: 'KELURAHAN',
            entityId: row.id,
            changes: { name: { from: null, to: input.name } },
        });
        return { ok: true, id: row.id };
    } catch (error) {
        console.error('createKelurahan failed', error);
        return {
            ok: false,
            error: 'CONFLICT',
            message: 'Kelurahan gagal dibuat.',
        };
    }
}

export async function updateKelurahan(
    actor: Actor,
    id: string,
    input: KelurahanInput,
): Promise<WriteResult> {
    if (!isAdmin(actor)) {
        return {
            ok: false,
            error: 'FORBIDDEN',
            message: 'Hanya admin atau dinkes.',
        };
    }

    const db = getDb();
    const [before] = await db
        .select()
        .from(kelurahan)
        .where(eq(kelurahan.id, id))
        .limit(1);

    if (!before) {
        return {
            ok: false,
            error: 'NOT_FOUND',
            message: 'Kelurahan tidak ditemukan.',
        };
    }

    const { boundaryGeojson, ...textFields } = input;
    const changes = changedFields(before, textFields);
    const boundaryChanged =
        boundaryGeojson !== undefined &&
        JSON.stringify(before.boundaryGeojson ?? null) !==
            JSON.stringify(boundaryGeojson ?? null);

    if (boundaryChanged) {
        changes.boundaryGeojson = {
            from: before.boundaryGeojson?.type ?? null,
            to: boundaryGeojson?.type ?? null,
        };
    }

    if (Object.keys(changes).length === 0) return { ok: true, id };

    const updateSet: Partial<typeof kelurahan.$inferInsert> = { ...textFields };
    if (boundaryGeojson !== undefined) {
        updateSet.boundaryGeojson = boundaryGeojson;
    }

    await db.update(kelurahan).set(updateSet).where(eq(kelurahan.id, id));
    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'KELURAHAN',
        entityId: id,
        changes,
    });
    return { ok: true, id };
}

export async function updateKelurahanBoundary(
    actor: Actor,
    id: string,
    boundaryGeojson: BoundaryGeoJson | null,
): Promise<WriteResult> {
    if (!isAdmin(actor)) {
        return {
            ok: false,
            error: 'FORBIDDEN',
            message: 'Hanya admin atau dinkes.',
        };
    }

    const db = getDb();
    const [before] = await db
        .select({
            id: kelurahan.id,
            boundaryGeojson: kelurahan.boundaryGeojson,
        })
        .from(kelurahan)
        .where(eq(kelurahan.id, id))
        .limit(1);

    if (!before) {
        return {
            ok: false,
            error: 'NOT_FOUND',
            message: 'Kelurahan tidak ditemukan.',
        };
    }

    await db
        .update(kelurahan)
        .set({ boundaryGeojson })
        .where(eq(kelurahan.id, id));

    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'KELURAHAN',
        entityId: id,
        changes: {
            boundaryGeojson: {
                from: before.boundaryGeojson?.type ?? null,
                to: boundaryGeojson?.type ?? null,
            },
        },
    });
    return { ok: true, id };
}

/**
 * A kelurahan is referenced by name from institutions.kelurahan_list and from
 * reports already filed; removing the reference row does not rewrite either,
 * which would silently change where future reports are assigned. So the delete
 * is refused while a puskesmas covers this name.
 */
export async function deleteKelurahan(
    actor: Actor,
    id: string,
): Promise<WriteResult> {
    if (!isAdmin(actor)) {
        return {
            ok: false,
            error: 'FORBIDDEN',
            message: 'Hanya admin atau dinkes.',
        };
    }

    const db = getDb();
    const [row] = await db
        .select({ name: kelurahan.name })
        .from(kelurahan)
        .where(eq(kelurahan.id, id))
        .limit(1);

    if (!row) {
        return {
            ok: false,
            error: 'NOT_FOUND',
            message: 'Kelurahan tidak ditemukan.',
        };
    }

    const [covering] = await db
        .select({ n: count() })
        .from(institutions)
        .where(
            sql`exists (select 1 from unnest(${institutions.kelurahanList}) as k where lower(k) = lower(${row.name}))`,
        );

    if (Number(covering?.n ?? 0) > 0) {
        return {
            ok: false,
            error: 'CONFLICT',
            message: `Kelurahan ini masih jadi wilayah ${covering?.n} puskesmas. Hapus dari daftar wilayah dulu.`,
        };
    }

    await db.delete(kelurahan).where(eq(kelurahan.id, id));
    await audit({
        actor,
        action: 'DELETE',
        entityType: 'KELURAHAN',
        entityId: id,
        changes: { name: { from: row.name, to: null } },
    });
    return { ok: true, id };
}

/* ── aset ──────────────────────────────────────────────────────────────── */

export async function listAssetsPaged(actor: Actor, q: ListQuery = {}) {
    const db = getDb();
    const { size, page, offset } = pageOf(q);
    const scoped = scopeToInstitution(actor);
    const search = q.q?.trim();

    const conditions: SQL[] = [];
    if (scoped) conditions.push(eq(assets.institutionId, scoped));
    if (search) {
        const match = or(
            ilike(assets.name, `%${search}%`),
            ilike(assets.code, `%${search}%`),
        );
        if (match) conditions.push(match);
    }
    const where = conditions.length ? and(...conditions) : undefined;

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
                isActive: assets.isActive,
                institutionId: assets.institutionId,
                institutionName: institutions.name,
            })
            .from(assets)
            .leftJoin(institutions, eq(institutions.id, assets.institutionId))
            .where(where)
            .orderBy(assets.name)
            .limit(size)
            .offset(offset),
        db.select({ n: count() }).from(assets).where(where),
    ]);

    return { rows, page, perPage: size, total: Number(totals?.n ?? 0) };
}

function assetValues(input: AssetInput) {
    return {
        name: input.name,
        code: input.code,
        category: input.category,
        unit: input.unit,
        currentStock: input.currentStock,
        minimumStock: input.minimumStock,
        institutionId: input.institutionId,
        isActive: input.isActive ?? true,
    };
}

/** Stocks a storekeeper owns; an administrator may seed it for any institution. */
function mayWriteAssets(actor: Actor, institutionId: string) {
    if (actor.role === 'ADMIN') return true;
    return (
        actor.role === 'PUSKESMAS' &&
        scopeToInstitution(actor) === institutionId
    );
}

export async function createAsset(
    actor: Actor,
    input: AssetInput,
): Promise<WriteResult> {
    if (!mayWriteAssets(actor, input.institutionId)) {
        return {
            ok: false,
            error: 'FORBIDDEN',
            message: 'Tidak berhak atas institusi ini.',
        };
    }

    try {
        const [row] = await getDb()
            .insert(assets)
            .values({ ...assetValues(input), createdById: actor.userId })
            .returning({ id: assets.id });
        await audit({
            actor,
            action: 'CREATE',
            entityType: 'ASSET',
            entityId: row.id,
            changes: { code: { from: null, to: input.code } },
        });
        return { ok: true, id: row.id };
    } catch (error) {
        if (duplicate(error)) {
            return {
                ok: false,
                error: 'CONFLICT',
                message: 'Kode aset sudah dipakai.',
            };
        }
        console.error('createAsset failed', error);
        return { ok: false, error: 'CONFLICT', message: 'Aset gagal dibuat.' };
    }
}

export async function updateAsset(
    actor: Actor,
    id: string,
    input: AssetInput,
): Promise<WriteResult> {
    if (!mayWriteAssets(actor, input.institutionId)) {
        return {
            ok: false,
            error: 'FORBIDDEN',
            message: 'Tidak berhak atas institusi ini.',
        };
    }

    const db = getDb();
    const [before] = await db
        .select()
        .from(assets)
        .where(eq(assets.id, id))
        .limit(1);

    if (!before) {
        return {
            ok: false,
            error: 'NOT_FOUND',
            message: 'Aset tidak ditemukan.',
        };
    }

    // The check above guards the NEW institution; this one guards the row's
    // current owner. Without it a puskesmas could POST any asset id with its
    // own institution and pull another tenant's stock into its own ledger.
    if (!mayWriteAssets(actor, before.institutionId)) {
        return {
            ok: false,
            error: 'FORBIDDEN',
            message: 'Tidak berhak atas institusi ini.',
        };
    }

    const values = assetValues(input);
    const changes = changedFields(before, values);
    if (Object.keys(changes).length === 0) return { ok: true, id };

    try {
        await db.update(assets).set(values).where(eq(assets.id, id));
    } catch (error) {
        if (duplicate(error)) {
            return {
                ok: false,
                error: 'CONFLICT',
                message: 'Kode aset sudah dipakai.',
            };
        }
        throw error;
    }

    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'ASSET',
        entityId: id,
        changes,
    });
    return { ok: true, id };
}

/** Kept as a soft delete: asset_transactions and requests point at the row. */
export async function deleteAsset(
    actor: Actor,
    id: string,
): Promise<WriteResult> {
    const db = getDb();
    const [before] = await db
        .select({
            name: assets.name,
            isActive: assets.isActive,
            institutionId: assets.institutionId,
        })
        .from(assets)
        .where(eq(assets.id, id))
        .limit(1);

    if (!before) {
        return {
            ok: false,
            error: 'NOT_FOUND',
            message: 'Aset tidak ditemukan.',
        };
    }
    if (!mayWriteAssets(actor, before.institutionId)) {
        return {
            ok: false,
            error: 'FORBIDDEN',
            message: 'Tidak berhak atas aset ini.',
        };
    }

    await db.update(assets).set({ isActive: false }).where(eq(assets.id, id));
    await audit({
        actor,
        action: 'DELETE',
        entityType: 'ASSET',
        entityId: id,
        changes: { isActive: { from: before.isActive, to: false } },
    });
    return { ok: true, id };
}
