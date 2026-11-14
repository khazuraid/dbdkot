'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Building2, Menu, Search, Wifi, WifiOff, X } from 'lucide-react';
import { NAV, ROLE_LABEL } from '@/lib/nav';
import { NAV_ICON } from '@/lib/nav-icons';
import type { Role } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { isNavActive } from './sidebar';
import { UserMenu } from './user-menu';

function subscribeOnline(cb: () => void) {
    window.addEventListener('online', cb);
    window.addEventListener('offline', cb);
    return () => {
        window.removeEventListener('online', cb);
        window.removeEventListener('offline', cb);
    };
}

/**
 * Mobile header + slide-over navigation drawer below `md`.
 */
export function MobileNav({
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
    const [open, setOpen] = useState(false);
    const online = useSyncExternalStore(
        subscribeOnline,
        () => navigator.onLine,
        () => true,
    );
    const closeRef = useRef<HTMLButtonElement>(null);
    const groups = useMemo(() => NAV[role] ?? [], [role]);
    const allHrefs = useMemo(
        () => groups.flatMap((g) => g.items.map((i) => i.href)),
        [groups],
    );

    useEffect(() => {
        if (!open) return;
        closeRef.current?.focus();
        function onKey(event: KeyboardEvent) {
            if (event.key === 'Escape') setOpen(false);
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    return (
        <div className="md:hidden">
            <header className="sticky top-0 z-20 flex h-[var(--topbar-height)] items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 backdrop-blur-md">
                <div className="flex min-w-0 items-center gap-2.5">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setOpen(true)}
                        aria-label="Buka menu navigasi"
                        aria-expanded={open}
                        className="size-9 shrink-0"
                    >
                        <Menu className="size-5" aria-hidden />
                    </Button>
                    <Link
                        href="/dasbor"
                        className="flex min-w-0 items-center gap-2"
                    >
                        <span
                            aria-hidden
                            className="grid size-7 shrink-0 place-items-center rounded-[7px] bg-[var(--accent)] text-[var(--accent-ink)]"
                        >
                            <Activity className="size-3.5" strokeWidth={2.2} />
                        </span>
                        <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-foreground">
                            WALI-EPI
                        </span>
                    </Link>
                </div>

                <div className="flex items-center gap-1.5">
                    <span
                        title={online ? 'Koneksi aktif' : 'Mode luring'}
                        className={cn(
                            'inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2 py-0.5 text-[11px] font-medium',
                            online
                                ? 'border-[var(--pill-positive-border)] bg-[var(--pill-positive-bg)] text-[var(--pill-positive-ink)]'
                                : 'border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)]',
                        )}
                    >
                        {online ? (
                            <Wifi className="size-3" aria-hidden />
                        ) : (
                            <WifiOff className="size-3" aria-hidden />
                        )}
                        <span className="sr-only sm:not-sr-only">
                            {online ? 'Online' : 'Offline'}
                        </span>
                    </span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Pencarian cepat (Ctrl+K)"
                        onClick={() =>
                            window.dispatchEvent(
                                new Event('wali-epi:open-command'),
                            )
                        }
                    >
                        <Search className="size-4" aria-hidden />
                    </Button>
                </div>
            </header>

            {open && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Navigasi utama"
                    className="fixed inset-0 z-50 flex"
                >
                    <div
                        className="fixed inset-0 bg-[var(--text)]/25 backdrop-blur-[1px]"
                        aria-hidden
                        onClick={() => setOpen(false)}
                    />
                    <nav className="relative flex h-full w-[min(292px,86vw)] flex-col border-r border-[var(--border)] bg-[var(--surface)] shadow-[var(--elev-pop)]">
                        <div className="flex h-[var(--topbar-height)] items-center justify-between border-b border-[var(--rule)] px-4">
                            <div className="flex items-center gap-2">
                                <span
                                    aria-hidden
                                    className="grid size-7 place-items-center rounded-[7px] bg-[var(--accent)] text-[var(--accent-ink)]"
                                >
                                    <Activity
                                        className="size-3.5"
                                        strokeWidth={2.2}
                                    />
                                </span>
                                <span className="text-[14px] font-semibold text-foreground">
                                    WALI-EPI
                                </span>
                            </div>
                            <Button
                                ref={closeRef}
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setOpen(false)}
                                aria-label="Tutup menu"
                                className="size-9"
                            >
                                <X className="size-4" aria-hidden />
                            </Button>
                        </div>

                        {institution && (
                            <div className="flex items-center gap-2 border-b border-[var(--rule)] bg-[var(--raised)]/50 px-4 py-2.5">
                                <Building2
                                    className="size-3.5 shrink-0 text-[var(--accent)]"
                                    strokeWidth={1.75}
                                    aria-hidden
                                />
                                <div className="min-w-0">
                                    <p className="truncate text-[12px] font-medium text-foreground">
                                        {institution}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {ROLE_LABEL[role]}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
                            {groups.map((group) => (
                                <div key={group.label}>
                                    <p className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-[0.02em] text-faint">
                                        {group.label}
                                    </p>
                                    <ul className="space-y-1">
                                        {group.items.map((item) => {
                                            const active = isNavActive(
                                                pathname,
                                                item.href,
                                                allHrefs,
                                            );
                                            const Icon = NAV_ICON[item.href];
                                            return (
                                                <li key={item.href}>
                                                    <Link
                                                        href={item.href}
                                                        onClick={() =>
                                                            setOpen(false)
                                                        }
                                                        aria-current={
                                                            active
                                                                ? 'page'
                                                                : undefined
                                                        }
                                                        className={cn(
                                                            'relative flex min-h-10 items-center gap-3 rounded-[var(--radius-control)] px-2.5 text-[14px] transition-colors',
                                                            active
                                                                ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent)]'
                                                                : 'font-medium text-muted-foreground hover:bg-[var(--raised)] hover:text-foreground',
                                                        )}
                                                    >
                                                        {Icon && (
                                                            <Icon
                                                                className={cn(
                                                                    'size-4 shrink-0',
                                                                    active
                                                                        ? 'text-[var(--accent)]'
                                                                        : 'text-muted-foreground',
                                                                )}
                                                                strokeWidth={
                                                                    active
                                                                        ? 2
                                                                        : 1.75
                                                                }
                                                                aria-hidden
                                                            />
                                                        )}
                                                        <span>
                                                            {item.label}
                                                        </span>
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-[var(--rule)] p-2.5">
                            <UserMenu
                                name={name}
                                email={email}
                                roleLabel={ROLE_LABEL[role]}
                                institution={institution}
                            />
                        </div>
                    </nav>
                </div>
            )}
        </div>
    );
}
