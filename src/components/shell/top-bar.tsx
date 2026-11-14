'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Bell, Moon, Search, Sun } from 'lucide-react';
import type { Role } from '@/lib/roles';
import { ROLE_LABEL } from '@/lib/nav';
import { Button } from '@/components/ui/button';
import { UserMenu } from './user-menu';

const ROUTE_TITLES: Record<string, string> = {
    dasbor: 'Dasbor',
    laporan: 'Kasus DBD',
    'perlu-action': 'Perlu Tindakan',
    monitoring: 'Monitoring SLA',
    analitik: 'Analitik Epidemiologi',
    'lintas-wilayah': 'Lintas Wilayah',
    baru: 'Formulir Baru',
    pe: 'Penyelidikan Epidemiologi',
    tugas: 'Daftar Tugas',
    verifikasi: 'Verifikasi PE',
    'tindak-lanjut': 'Tindak Lanjut & Fogging',
    logistik: 'Logistik',
    aset: 'Manajemen Aset',
    notifikasi: 'Notifikasi',
    pesan: 'Pesan Lapangan',
    pengaturan: 'Pengaturan',
    admin: 'Administrasi',
    pengguna: 'Kelola Pengguna',
    institusi: 'Fasilitas Kesehatan',
    kelurahan: 'Master Kelurahan',
    'audit-log': 'Audit Log',
};

export function TopBar({
    role,
    name,
    email,
    institution,
}: {
    role: Role;
    name: string;
    email: string;
    institution: string | null;
}) {
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();

    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbItems = segments.map((seg, idx) => {
        const href = `/${segments.slice(0, idx + 1).join('/')}`;
        const label = ROUTE_TITLES[seg] ?? seg;
        return { href, label };
    });

    function openCommandPalette() {
        window.dispatchEvent(new CustomEvent('wali-epi:open-command'));
    }

    function toggleTheme() {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    }

    return (
        <header className="hidden h-14 w-full shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)]/95 px-6 backdrop-blur-md md:flex z-20">
            {/* Breadcrumb path */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px]">
                <Link
                    href="/dasbor"
                    className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                    WALI-EPI
                </Link>
                {breadcrumbItems.map((item, index) => (
                    <span key={item.href} className="flex items-center gap-2">
                        <span className="text-muted-foreground/40" aria-hidden>/</span>
                        {index === breadcrumbItems.length - 1 ? (
                            <span className="font-semibold text-foreground">
                                {item.label}
                            </span>
                        ) : (
                            <Link
                                href={item.href}
                                className="text-muted-foreground transition-colors hover:text-foreground"
                            >
                                {item.label}
                            </Link>
                        )}
                    </span>
                ))}
            </nav>

            {/* Quick Actions & Utilities */}
            <div className="flex items-center gap-3">
                {/* Search Bar Button */}
                <button
                    type="button"
                    onClick={openCommandPalette}
                    className="flex h-8 items-center gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground"
                    aria-label="Pencarian cepat (Tekan Cmd+K)"
                >
                    <Search className="size-3.5" aria-hidden />
                    <span className="hidden xl:inline">Cari kasus, faskes, kelurahan...</span>
                    <span className="inline xl:hidden">Cari...</span>
                    <kbd className="hidden rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground shadow-xs sm:inline-block">
                        ⌘K
                    </kbd>
                </button>

                {/* Role & Faskes Badge */}
                <div className="hidden items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--raised)] px-2.5 py-1 text-[11.5px] lg:flex">
                    <span className="size-1.5 rounded-full bg-[var(--accent)]" aria-hidden />
                    <span className="font-semibold text-foreground">
                        {ROLE_LABEL[role] ?? role}
                    </span>
                    {institution && (
                        <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="max-w-[140px] truncate text-muted-foreground" title={institution}>
                                {institution}
                            </span>
                        </>
                    )}
                </div>

                {/* Notification Bell */}
                <Button asChild variant="ghost" size="icon-sm" className="relative text-muted-foreground hover:text-foreground">
                    <Link href="/notifikasi" aria-label="Lihat notifikasi">
                        <Bell className="size-4" aria-hidden />
                    </Link>
                </Button>

                {/* Theme Toggle Button */}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggleTheme}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Ganti mode tampilan"
                >
                    <Sun className="size-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" aria-hidden />
                    <Moon className="absolute size-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" aria-hidden />
                </Button>

                <div className="h-4 w-px bg-[var(--border)]" aria-hidden />

                {/* User Menu */}
                <div className="w-44">
                    <UserMenu
                        name={name}
                        email={email}
                        roleLabel={ROLE_LABEL[role] ?? role}
                        institution={institution}
                    />
                </div>
            </div>
        </header>
    );
}
