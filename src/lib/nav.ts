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
            label: 'Pelaporan Kasus',
            items: [
                { href: '/laporan', label: 'Semua Laporan' },
                { href: '/laporan/baru', label: 'Lapor Kasus Baru' },
                { href: '/laporan/perlu-action', label: 'Perlu Kelengkapan' },
                { href: '/laporan/analitik', label: 'Peta & Tren Kasus' },
                { href: '/laporan/rekap', label: 'Rekap Laporan RS' },
            ],
        },
        {
            label: 'Akun & Komunikasi',
            items: [
                { href: '/notifikasi', label: 'Notifikasi' },
                { href: '/pesan', label: 'Pesan' },
                { href: '/pengaturan', label: 'Pengaturan' },
            ],
        },
    ],
    PUSKESMAS: [
        {
            label: 'Surveilans Kasus',
            items: [
                { href: '/dasbor', label: 'Dasbor' },
                { href: '/laporan', label: 'Daftar Laporan' },
                { href: '/laporan/perlu-action', label: 'Perlu Tindakan' },
                { href: '/laporan/baru', label: 'Lapor Poli' },
                { href: '/laporan/analitik', label: 'Peta & Klaster' },
                { href: '/laporan/rekap', label: 'Rekap Laporan' },
            ],
        },
        {
            label: 'Penyelidikan Lapangan (PE)',
            items: [
                { href: '/pe/tugas', label: 'Tugas PE Aktif' },
                { href: '/pe/baru', label: 'Formulir PE' },
                { href: '/pe', label: 'Riwayat PE' },
            ],
        },
        {
            label: 'Pengendalian & Logistik',
            items: [
                { href: '/tindak-lanjut', label: 'Tindak Lanjut & Fogging' },
                { href: '/logistik', label: 'Logistik Vektor' },
                { href: '/aset', label: 'Aset & Alat' },
            ],
        },
        {
            label: 'Akun & Komunikasi',
            items: [
                { href: '/notifikasi', label: 'Notifikasi' },
                { href: '/pesan', label: 'Pesan' },
                { href: '/pengaturan', label: 'Pengaturan' },
            ],
        },
    ],
    DINKES: [
        {
            label: 'Ringkasan',
            items: [
                { href: '/dasbor', label: 'Dasbor' },
            ],
        },
        {
            label: 'Pengawasan Surveilans',
            items: [
                { href: '/laporan', label: 'Semua Laporan' },
                { href: '/laporan/perlu-action', label: 'Perlu Verifikasi' },
                { href: '/laporan/lintas-wilayah', label: 'Lintas Wilayah' },
                { href: '/laporan/analitik', label: 'Peta & Klaster Kota' },
                { href: '/laporan/rekap', label: 'Rekap Laporan Kemenkes' },
            ],
        },
        {
            label: 'Penyelidikan & Vektor',
            items: [
                { href: '/pe', label: 'Monitoring PE' },
                { href: '/pe/verifikasi', label: 'Verifikasi PE' },
                { href: '/pe/analitik', label: 'Analitik Entomologi' },
                { href: '/tindak-lanjut', label: 'Tindak Lanjut & Fogging' },
                { href: '/logistik', label: 'Logistik Vektor' },
                { href: '/aset', label: 'Aset & Alat' },
            ],
        },
        {
            label: 'Master Wilayah & Faskes',
            items: [
                { href: '/admin/institusi', label: 'Institusi (RS & Puskesmas)' },
                { href: '/admin/kelurahan', label: 'Kelurahan & Zonasi' },
                { href: '/admin/koreksi-wilayah', label: 'Koreksi Wilayah' },
            ],
        },
        {
            label: 'Akun & Komunikasi',
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
            items: [
                { href: '/dasbor', label: 'Dasbor' },
                { href: '/admin', label: 'Pusat Admin' },
            ],
        },
        {
            label: 'Pengawasan Sistem',
            items: [
                { href: '/laporan', label: 'Semua Laporan' },
                { href: '/laporan/rekap', label: 'Rekap Laporan' },
                { href: '/pe', label: 'Laporan PE' },
                { href: '/pe/verifikasi', label: 'Verifikasi PE' },
                { href: '/tindak-lanjut', label: 'Tindak Lanjut' },
            ],
        },
        {
            label: 'Master Data & Keamanan',
            items: [
                { href: '/admin/pengguna', label: 'Pengguna & Hak Akses' },
                { href: '/admin/institusi', label: 'Institusi Faskes' },
                { href: '/admin/kelurahan', label: 'Kelurahan & Batas' },
                { href: '/admin/koreksi-wilayah', label: 'Koreksi Wilayah' },
                { href: '/admin/audit-log', label: 'Audit Log Keamanan' },
            ],
        },
        {
            label: 'Logistik & Sistem',
            items: [
                { href: '/logistik', label: 'Logistik' },
                { href: '/aset', label: 'Aset & Alat' },
                { href: '/pengaturan', label: 'Pengaturan & API Wilayah' },
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
