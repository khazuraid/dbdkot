import type { Role } from '@/lib/roles';

export type NavItem = {
    href: string;
    label: string;
};

export type NavGroup = {
    label: string;
    items: NavItem[];
};

/**
 * Navigation per role. Mirrors the legacy 41-page tree but flattened into
 * groups; routes that only existed to duplicate another tree (dinkes/reports/*
 * and dinkes/penyelidikan-epidemiologi/* were near-clones) are folded into one.
 */
export const NAV: Record<Role, NavGroup[]> = {
    RUMAH_SAKIT: [
        {
            label: 'Ringkasan',
            items: [{ href: '/dasbor', label: 'Dasbor' }],
        },
        {
            label: 'Laporan',
            items: [
                { href: '/laporan', label: 'Semua laporan' },
                { href: '/laporan/baru', label: 'Lapor kasus' },
                { href: '/laporan/perlu-action', label: 'Perlu action' },
                { href: '/laporan/analitik', label: 'Analitik' },
            ],
        },
        {
            label: 'Akun',
            items: [
                { href: '/notifikasi', label: 'Notifikasi' },
                { href: '/pesan', label: 'Pesan' },
            ],
        },
    ],
    PUSKESMAS: [
        {
            label: 'Ringkasan',
            items: [{ href: '/dasbor', label: 'Dasbor' }],
        },
        {
            label: 'Laporan',
            items: [
                { href: '/laporan', label: 'Semua laporan' },
                { href: '/laporan/perlu-action', label: 'Perlu action' },
                { href: '/pe', label: 'Penyelidikan epidemiologi' },
                { href: '/pe/tugas', label: 'Tugas PE' },
                { href: '/pe/baru', label: 'Buat PE' },
            ],
        },
        {
            label: 'Akun',
            items: [
                { href: '/notifikasi', label: 'Notifikasi' },
                { href: '/pesan', label: 'Pesan' },
            ],
        },
    ],
    DINKES: [
        {
            label: 'Ringkasan',
            items: [{ href: '/dasbor', label: 'Dasbor' }],
        },
        {
            label: 'Pengawasan',
            items: [
                { href: '/laporan', label: 'Semua laporan' },
                { href: '/laporan/perlu-action', label: 'Perlu action' },
                { href: '/laporan/monitoring', label: 'Monitoring' },
                { href: '/laporan/analitik', label: 'Analitik' },
            ],
        },
        {
            label: 'Penyelidikan',
            items: [
                { href: '/pe', label: 'Laporan PE' },
                { href: '/pe/verifikasi', label: 'Verifikasi PE' },
                { href: '/pe/analitik', label: 'Analitik PE' },
            ],
        },
        {
            label: 'Akun',
            items: [
                { href: '/notifikasi', label: 'Notifikasi' },
                { href: '/pesan', label: 'Pesan' },
                { href: '/pengaturan', label: 'Pengaturan' },
            ],
        },
    ],
    ADMIN: [
        {
            label: 'Ringkasan',
            items: [{ href: '/dasbor', label: 'Dasbor' }],
        },
        {
            label: 'Pengawasan',
            items: [
                { href: '/laporan', label: 'Semua laporan' },
                { href: '/pe', label: 'Laporan PE' },
            ],
        },
        {
            label: 'Master data',
            items: [
                { href: '/admin/pengguna', label: 'Pengguna' },
                { href: '/admin/institusi', label: 'Institusi' },
                { href: '/admin/kelurahan', label: 'Kelurahan' },
                { href: '/admin/koreksi-wilayah', label: 'Koreksi wilayah' },
            ],
        },
        {
            label: 'Sistem',
            items: [
                { href: '/admin/audit-log', label: 'Audit log' },
                { href: '/aset', label: 'Aset' },
            ],
        },
    ],
};

export const ROLE_LABEL: Record<Role, string> = {
    ADMIN: 'Administrator',
    DINKES: 'Dinas Kesehatan',
    PUSKESMAS: 'Puskesmas',
    RUMAH_SAKIT: 'Rumah Sakit',
};
