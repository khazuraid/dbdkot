import {
    and,
    count,
    eq,
    isNotNull,
    notExists,
    sql,
    type SQL,
} from 'drizzle-orm';
import { getDb } from '@/db';
import { institutions, kelurahan, reportsRS } from '@/db/schema';
import type { BoundaryGeoJson } from '@/lib/geo/boundary-schema';
import { scopeToInstitution, type Actor } from '@/lib/session';

export type FacilityPoint = {
    id: string;
    name: string;
    type: string;
    lat: number;
    lng: number;
    /** Reports that name this facility as the origin. */
    n: number;
};

/**
 * Facilities with a coordinate, for the map. Aggregates and institution names
 * only — no patient row is read, so the map cannot leak what the ledger hides.
 */
export async function facilityPoints(actor: Actor): Promise<FacilityPoint[]> {
    const institutionId = scopeToInstitution(actor);

    const conditions: SQL[] = [
        isNotNull(institutions.latitude),
        isNotNull(institutions.longitude),
        eq(institutions.isActive, true),
    ];
    if (institutionId) conditions.push(eq(institutions.id, institutionId));

    const rows = await getDb()
        .select({
            id: institutions.id,
            name: institutions.name,
            type: institutions.type,
            lat: institutions.latitude,
            lng: institutions.longitude,
            n: count(reportsRS.id),
        })
        .from(institutions)
        .leftJoin(reportsRS, eq(reportsRS.institutionId, institutions.id))
        .where(and(...conditions))
        .groupBy(
            institutions.id,
            institutions.name,
            institutions.type,
            institutions.latitude,
            institutions.longitude,
        )
        .orderBy(sql`count(${reportsRS.id}) desc`, institutions.name);

    return rows.map((r) => ({
        ...r,
        lat: Number(r.lat),
        lng: Number(r.lng),
        n: Number(r.n),
    }));
}

export type KelurahanStat = { kelurahan: string; kecamatan: string; n: number };

/**
 * Kelurahan that appear in reports but sit in no active facility's coverage
 * list, so a gap is visible rather than hidden behind a blank map. Reads no
 * PII column, and is scoped like every other report aggregate.
 */
export async function uncoveredKelurahan(
    actor: Actor,
    limit = 25,
): Promise<{ rows: KelurahanStat[]; total: number }> {
    const institutionId = scopeToInstitution(actor);

    const conditions: SQL[] = [
        sql`${reportsRS.kelurahan} is not null and btrim(${reportsRS.kelurahan}) <> ''`,
        notExists(
            getDb()
                .select({ one: sql`1` })
                .from(institutions)
                .where(
                    and(
                        eq(institutions.type, 'PUSKESMAS'),
                        eq(institutions.isActive, true),
                        // Mirror assignment.ts exactly: case- and whitespace-insensitive
                        // match against active PUSKESMAS coverage only.
                        sql`exists (
                            select 1 from unnest(${institutions.kelurahanList}) as k
                            where lower(btrim(k)) = lower(btrim(${reportsRS.kelurahan}))
                        )`,
                    ),
                ),
        ),
    ];
    if (institutionId) {
        conditions.push(
            sql`(${reportsRS.institutionId} = ${institutionId} or ${reportsRS.assignedPuskesmasId} = ${institutionId})`,
        );
    }

    const [rows, [totals]] = await Promise.all([
        getDb()
            .select({
                kelurahan: reportsRS.kelurahan,
                kecamatan: reportsRS.kecamatan,
                n: count(),
            })
            .from(reportsRS)
            .where(and(...conditions))
            .groupBy(reportsRS.kelurahan, reportsRS.kecamatan)
            .orderBy(sql`count(*) desc`)
            .limit(limit),
        // count over distinct groups, not rows: one kelurahan is one gap.
        getDb()
            .select({ n: sql<number>`count(*)` })
            .from(
                getDb()
                    .select({
                        kelurahan: reportsRS.kelurahan,
                        kecamatan: reportsRS.kecamatan,
                    })
                    .from(reportsRS)
                    .where(and(...conditions))
                    .groupBy(reportsRS.kelurahan, reportsRS.kecamatan)
                    .as('gaps'),
            ),
    ]);

    return {
        rows: rows.map((r) => ({
            kelurahan: r.kelurahan ?? '—',
            kecamatan: r.kecamatan ?? '—',
            n: Number(r.n),
        })),
        total: Number(totals?.n ?? 0),
    };
}

export type KelurahanZone = {
    id: string;
    name: string;
    kecamatan: string;
    kota: string;
    boundaryGeojson: BoundaryGeoJson;
    puskesmasNames: string[];
    reportCount: number;
};

/**
 * Saved kelurahan polygon boundaries for the analytics map. Respects
 * tenant scoping: a PUSKESMAS actor only sees its own coverage kelurahan, while
 * DINKES/ADMIN see all saved zones. Aggregates report counts without PII.
 */
export async function kelurahanZones(actor: Actor): Promise<KelurahanZone[]> {
    const db = getDb();
    const institutionId = scopeToInstitution(actor);

    const puskesmasWhere =
        actor.role === 'PUSKESMAS' && institutionId
            ? and(
                  eq(institutions.type, 'PUSKESMAS'),
                  eq(institutions.id, institutionId),
              )
            : and(
                  eq(institutions.type, 'PUSKESMAS'),
                  eq(institutions.isActive, true),
              );

    const reportConditions: SQL[] = [
        sql`${reportsRS.kelurahan} is not null and btrim(${reportsRS.kelurahan}) <> ''`,
    ];
    if (institutionId) {
        reportConditions.push(
            sql`(${reportsRS.institutionId} = ${institutionId} or ${reportsRS.assignedPuskesmasId} = ${institutionId})`,
        );
    }

    const [kelRows, puskesmasRows, reportCountsByKel] = await Promise.all([
        db
            .select({
                id: kelurahan.id,
                name: kelurahan.name,
                kecamatan: kelurahan.kecamatan,
                kota: kelurahan.kota,
                boundaryGeojson: kelurahan.boundaryGeojson,
            })
            .from(kelurahan)
            .where(isNotNull(kelurahan.boundaryGeojson))
            .orderBy(kelurahan.kota, kelurahan.kecamatan, kelurahan.name),
        db
            .select({
                name: institutions.name,
                kelurahanList: institutions.kelurahanList,
            })
            .from(institutions)
            .where(puskesmasWhere),
        db
            .select({
                key: sql<string>`lower(btrim(${reportsRS.kelurahan}))`,
                n: count(),
            })
            .from(reportsRS)
            .where(and(...reportConditions))
            .groupBy(sql`lower(btrim(${reportsRS.kelurahan}))`),
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

    const reportCountMap = new Map<string, number>();
    for (const r of reportCountsByKel) {
        if (r.key) reportCountMap.set(r.key, Number(r.n));
    }

    return kelRows
        .filter((k) => {
            if (!k.boundaryGeojson) return false;
            if (actor.role === 'PUSKESMAS') {
                return coverageMap.has(k.name.trim().toLowerCase());
            }
            return true;
        })
        .map((k) => {
            const norm = k.name.trim().toLowerCase();
            return {
                id: k.id,
                name: k.name,
                kecamatan: k.kecamatan,
                kota: k.kota,
                boundaryGeojson: k.boundaryGeojson as BoundaryGeoJson,
                puskesmasNames: coverageMap.get(norm) ?? [],
                reportCount: reportCountMap.get(norm) ?? 0,
            };
        });
}

export type CaseGeoPoint = {
    id: string;
    reportNumber: string;
    lat: number;
    lng: number;
    status: string;
    caseType?: string;
    admissionDate?: Date | null;
    kelurahan: string | null;
    kecamatan?: string | null;
    clusterId: string | null;
    sourceType?: string | null;
    institutionName?: string | null;
    institutionType?: string | null;
};

/**
 * Non-PII geo coordinates of reported cases for Leaflet MarkerCluster & 100m
 * cluster radius ring visualization. Respects tenant scoping.
 */
export async function caseGeoPoints(actor: Actor): Promise<CaseGeoPoint[]> {
    const institutionId = scopeToInstitution(actor);
    const rows = await getDb()
        .select({
            id: reportsRS.id,
            reportNumber: reportsRS.reportNumber,
            lat: reportsRS.latitude,
            lng: reportsRS.longitude,
            status: reportsRS.status,
            caseType: reportsRS.caseType,
            admissionDate: reportsRS.admissionDate,
            kelurahan: reportsRS.kelurahan,
            kecamatan: reportsRS.kecamatan,
            clusterId: reportsRS.clusterId,
            sourceType: reportsRS.sourceType,
            institutionName: institutions.name,
            institutionType: institutions.type,
        })
        .from(reportsRS)
        .leftJoin(institutions, eq(institutions.id, reportsRS.institutionId))
        .where(
            and(
                isNotNull(reportsRS.latitude),
                isNotNull(reportsRS.longitude),
                institutionId
                    ? sql`(${reportsRS.institutionId} = ${institutionId} or ${reportsRS.assignedPuskesmasId} = ${institutionId})`
                    : sql`true`,
            ),
        )
        .limit(500);

    return rows.map((r) => ({
        id: r.id,
        reportNumber: r.reportNumber,
        lat: Number(r.lat),
        lng: Number(r.lng),
        status: r.status,
        caseType: r.caseType,
        admissionDate: r.admissionDate,
        kelurahan: r.kelurahan,
        kecamatan: r.kecamatan,
        clusterId: r.clusterId,
        sourceType: r.sourceType,
        institutionName: r.institutionName,
        institutionType: r.institutionType,
    }));
}
