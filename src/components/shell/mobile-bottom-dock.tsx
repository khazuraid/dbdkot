'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Activity,
    FilePlus2,
    FileText,
    LayoutDashboard,
    PlusCircle,
    Search,
    ShieldCheck,
} from 'lucide-react';
import type { Role } from '@/lib/roles';
import { cn } from '@/lib/utils';

type DockItem = {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    primary?: boolean;
};

const DOCK_BY_ROLE: Record<Role, DockItem[]> = {
    RUMAH_SAKIT: [
        { href: '/dasbor', label: 'Dasbor', icon: LayoutDashboard },
        { href: '/laporan', label: 'Laporan', icon: FileText },
        {
            href: '/laporan/baru',
            label: 'Lapor',
            icon: FilePlus2,
            primary: true,
        },
        { href: '/laporan/analitik', label: 'Peta', icon: Activity },
    ],
    PUSKESMAS: [
        { href: '/dasbor', label: 'Dasbor', icon: LayoutDashboard },
        { href: '/laporan', label: 'Kasus', icon: FileText },
        { href: '/pe/baru', label: 'Buat PE', icon: PlusCircle, primary: true },
        { href: '/tindak-lanjut', label: 'Fogging', icon: Activity },
    ],
    DINKES: [
        { href: '/dasbor', label: 'Dasbor', icon: LayoutDashboard },
        { href: '/laporan', label: 'Kasus', icon: FileText },
        {
            href: '/pe/verifikasi',
            label: 'Verifikasi',
            icon: Search,
            primary: true,
        },
        { href: '/tindak-lanjut', label: 'Fogging', icon: Activity },
    ],
    ADMIN: [
        { href: '/dasbor', label: 'Dasbor', icon: LayoutDashboard },
        { href: '/laporan', label: 'Kasus', icon: FileText },
        {
            href: '/admin/pengguna',
            label: 'Kelola',
            icon: ShieldCheck,
            primary: true,
        },
        { href: '/tindak-lanjut', label: 'Fogging', icon: Activity },
    ],
};

export function MobileBottomDock({ role }: { role: Role }) {
    const pathname = usePathname();
    const items = DOCK_BY_ROLE[role] ?? DOCK_BY_ROLE.PUSKESMAS;

    return (
        <nav
            aria-label="Navigasi cepat bawah"
            className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)]/95 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
        >
            <ul className="mx-auto grid max-w-md grid-cols-4 items-center gap-1">
                {items.map((item) => {
                    const Icon = item.icon;
                    const active =
                        pathname === item.href ||
                        (item.href !== '/dasbor' &&
                            pathname.startsWith(`${item.href}/`));
                    return (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                className={cn(
                                    'flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] px-2 py-1 text-[11px] font-medium transition-colors active:scale-[0.98]',
                                    item.primary
                                        ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                                        : active
                                          ? 'bg-[var(--active)] text-[var(--accent)]'
                                          : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <Icon className="size-4" aria-hidden />
                                <span className="truncate">{item.label}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
