/**
 * The display half of a report row: the labels and the shape of what a list
 * screen renders. It is deliberately separate from `domain/reports.ts`, which
 * imports the database — a client component that reaches for a label must not
 * pull a Postgres driver into the browser bundle with it.
 *
 * `STATUSES` here is the source of truth for the status values; the enum in
 * `db/schema.ts` declares the same ones. Nothing here imports from `@/db`,
 * so this file stays safe on both sides of the boundary.
 */

export const STATUSES = [
    'DRAFT',
    'SUBMITTED',
    'ASSIGNED',
    'ASSIGNED_ACCEPTED',
    'PUSKESMAS_REJECTED',
    'PE_COMPLETED',
    'VERIFIED',
    'REJECTED',
] as const;

export type ReportStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<ReportStatus, string> = {
    DRAFT: 'Draf',
    SUBMITTED: 'Terkirim',
    ASSIGNED: 'Menunggu puskesmas',
    ASSIGNED_ACCEPTED: 'Diterima puskesmas',
    PUSKESMAS_REJECTED: 'Ditolak puskesmas',
    PE_COMPLETED: 'PE selesai',
    VERIFIED: 'Terverifikasi',
    REJECTED: 'Ditolak',
};

export const CASE_TYPE_LABEL: Record<string, string> = {
    DENGUE: 'DBD',
    SUSPECTED_DENGUE: 'Suspek DBD',
    DHF: 'DHF',
    DSS: 'DSS',
};

/** One report as a list screen shows it. No PII: name and NIK are absent. */
export type ReportListRow = {
    id: string;
    reportNumber: string;
    age: number;
    gender: 'L' | 'P';
    caseType: string;
    kelurahan: string | null;
    kecamatan: string | null;
    status: ReportStatus;
    createdAt: Date;
};
