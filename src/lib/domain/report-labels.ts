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

import type { StatusTone } from './account-labels';

export const STATUSES = [
    'DRAFT',
    'SUBMITTED',
    'CROSS_BORDER_PENDING',
    'ARCHIVED_CROSS_BORDER',
    'ASSIGNED',
    'ASSIGNED_ACCEPTED',
    'PUSKESMAS_REJECTED',
    'PE_IN_PROGRESS',
    'PE_COMPLETED',
    'VERIFIED',
    'FOGGING_REQUIRED',
    'SIKLUS_1_DONE',
    'SIKLUS_2_SCHEDULED',
    'SIKLUS_2_DONE',
    'CLOSED',
    'REJECTED',
] as const;

export type ReportStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<ReportStatus, string> = {
    DRAFT: 'Draf',
    SUBMITTED: 'Terkirim',
    CROSS_BORDER_PENDING: 'Luar wilayah (Disposisi Dinkes)',
    ARCHIVED_CROSS_BORDER: 'Diteruskan ke Dinkes Daerah',
    ASSIGNED: 'Menunggu respon Puskesmas',
    ASSIGNED_ACCEPTED: 'Diterima Puskesmas',
    PUSKESMAS_REJECTED: 'Ditolak Puskesmas',
    PE_IN_PROGRESS: 'PE sedang berlangsung',
    PE_COMPLETED: 'PE selesai',
    VERIFIED: 'Terverifikasi Dinkes',
    FOGGING_REQUIRED: 'Wajib Fogging Fokus',
    SIKLUS_1_DONE: 'Fogging Siklus 1 selesai',
    SIKLUS_2_SCHEDULED: 'Fogging Siklus 2 terjadwal',
    SIKLUS_2_DONE: 'Fogging Siklus 2 selesai',
    CLOSED: 'Tuntas & Arsip',
    REJECTED: 'Ditolak',
};

export const STATUS_TONE: Record<ReportStatus, StatusTone> = {
    DRAFT: 'neutral',
    SUBMITTED: 'neutral',
    CROSS_BORDER_PENDING: 'warn',
    ARCHIVED_CROSS_BORDER: 'neutral',
    ASSIGNED: 'warn',
    ASSIGNED_ACCEPTED: 'warn',
    PUSKESMAS_REJECTED: 'bad',
    PE_IN_PROGRESS: 'warn',
    PE_COMPLETED: 'warn',
    VERIFIED: 'good',
    FOGGING_REQUIRED: 'bad',
    SIKLUS_1_DONE: 'warn',
    SIKLUS_2_SCHEDULED: 'warn',
    SIKLUS_2_DONE: 'good',
    CLOSED: 'good',
    REJECTED: 'bad',
};

export const CASE_TYPE_LABEL: Record<string, string> = {
    DENGUE: 'DBD',
    SUSPECTED_DENGUE: 'Suspek DBD',
    DHF: 'DHF',
    DSS: 'DSS',
};

/**
 * Single source of truth for which report statuses require action from each
 * role. Shared between `reportCounts()`, the dashboard, and `/laporan/perlu-action`
 * so the badge count, KPI card, and action queue can never disagree.
 */
export const NEED_ACTION_STATUSES: Record<string, readonly ReportStatus[]> = {
    RUMAH_SAKIT: ['PUSKESMAS_REJECTED', 'REJECTED'],
    PUSKESMAS: [
        'ASSIGNED',
        'ASSIGNED_ACCEPTED',
        'PE_IN_PROGRESS',
        'FOGGING_REQUIRED',
        'SIKLUS_1_DONE',
        'SIKLUS_2_SCHEDULED',
    ],
    DINKES: ['CROSS_BORDER_PENDING', 'PUSKESMAS_REJECTED', 'PE_COMPLETED'],
    ADMIN: ['SUBMITTED'],
};

export function needActionStatusesFor(role: string): readonly ReportStatus[] {
    return NEED_ACTION_STATUSES[role] ?? ['SUBMITTED', 'ASSIGNED'];
}

/** One report as a list screen shows it. No PII: name and NIK are absent. */
export type ReportListRow = {
    id: string;
    reportNumber: string;
    age: number;
    gender: 'L' | 'P';
    caseType: string;
    kelurahan: string | null;
    kecamatan: string | null;
    kota?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    clusterId?: string | null;
    assignedAt?: Date | null;
    acceptedAt?: Date | null;
    sourceType?: string | null;
    status: ReportStatus;
    createdAt: Date;
};
