export type PageInfo = {
    page: number;
    perPage: number;
    total: number;
};

/** Clamp a `?page=` search param. Shared by every paginated list and its links. */
export function readPage(value: string | string[] | undefined): number {
    const raw = Array.isArray(value) ? value[0] : value;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}
