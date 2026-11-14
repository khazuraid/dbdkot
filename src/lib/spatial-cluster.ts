/**
 * Spatial cluster detection (radius <= 100m within 14 days).
 * Uses the WGS-84 spherical Haversine distance formula so no PostGIS
 * extension is required on standard Postgres instances.
 */

export const CLUSTER_RADIUS_METERS = 100;
export const CLUSTER_WINDOW_DAYS = 14;

const EARTH_RADIUS_METERS = 6_371_000;

export function haversineMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

export type SpatialCandidate = {
    id: string;
    latitude: number;
    longitude: number;
    clusterId: string | null;
    createdAt: Date;
};

/**
 * Given a target point/date and recent geolocated reports, returns all
 * neighbors within `radiusMeters` and `windowDays` and the suggested clusterId
 * (reusing an existing neighbor's clusterId when present).
 */
export function findSpatialClusterMatches(
    target: { id?: string; latitude: number; longitude: number; createdAt: Date },
    candidates: SpatialCandidate[],
    radiusMeters = CLUSTER_RADIUS_METERS,
    windowDays = CLUSTER_WINDOW_DAYS,
): {
    neighbors: Array<SpatialCandidate & { distanceMeters: number }>;
    existingClusterId: string | null;
} {
    const windowMs = windowDays * 24 * 3600 * 1000;
    const targetMs = target.createdAt.getTime();
    const neighbors: Array<SpatialCandidate & { distanceMeters: number }> = [];
    let existingClusterId: string | null = null;

    for (const c of candidates) {
        if (target.id && c.id === target.id) continue;
        if (Math.abs(targetMs - c.createdAt.getTime()) > windowMs) continue;
        const distanceMeters = haversineMeters(
            target.latitude,
            target.longitude,
            c.latitude,
            c.longitude,
        );
        if (distanceMeters <= radiusMeters) {
            neighbors.push({ ...c, distanceMeters: Math.round(distanceMeters) });
            if (!existingClusterId && c.clusterId) {
                existingClusterId = c.clusterId;
            }
        }
    }

    neighbors.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return { neighbors, existingClusterId };
}
