'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useSyncExternalStore } from 'react';
import {
    Activity,
    Building2,
    PanelLeftClose,
    PanelLeftOpen,
    Search,
} from 'lucide-react';
import { NAV, ROLE_LABEL } from '@/lib/nav';
import { NAV_ICON } from '@/lib/nav-icons';
import type { Role } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { UserMenu } from './user-menu';

type ShellBranding = {
    title: string;
    tagline: string;
    logoUrl: string | null;
};

type Props = {
    role: Role;
    name: string;
    email: string;
    institution: string | null;
    branding?: ShellBranding;
};

export function isNavActive(
    pathname: string,
    href: string,
    allHrefs: string[],
) {
    if (pathname === href) return true;
    if (!pathname.startsWith(`${href}/`)) return false;
    return !allHrefs.some(
        (other) =>
            other !== href &&
            other.length > href.length &&
            (pathname === other || pathname.startsWith(`${other}/`)),
    );
}

const COLLAPSE_KEY = 'wali-epi:sidebar-collapsed';
const COLLAPSE_EVENT = 'wali-epi:sidebar-collapsed-change';

function readCollapsed() {
    try {
        return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
        return false;
    }
}

function subscribeCollapse(onChange: () => void) {
    window.addEventListener(COLLAPSE_EVENT, onChange);
    return () => window.removeEventListener(COLLAPSE_EVENT, onChange);
}

/**
 * Desktop navigation rail. Uses a quiet clinical surface and a single crisp
 * pine-teal active indicator so operators can scan up to a dozen routes without
 * chrome noise.
 */
export function Sidebar({ role, name, email, institution, branding }: Props) {
    const brandTitle = branding?.title || 'WALI-EPI';
    const brandTagline = branding?.tagline || 'Surveilans DBD';
    const brandLogo = branding?.logoUrl ?? null;
    const pathname = usePathname();
    const groups = useMemo(() => NAV[role] ?? [], [role]);
    const allHrefs = useMemo(
        () => groups.flatMap((g) => g.items.map((i) => i.href)),
        [groups],
    );
    const collapsed = useSyncExternalStore(
        subscribeCollapse,
        readCollapsed,
        () => false,
    );

    function toggleCollapse() {
        const next = !collapsed;
        try {
            localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
            window.dispatchEvent(new Event(COLLAPSE_EVENT));
        } catch {
            // Private window / blocked storage: keep default state.
        }
    }

    return (
        <nav
            aria-label="Navigasi utama"
            className={cn(
                'surface flex h-full shrink-0 flex-col transition-[width] duration-150 ease-out',
                collapsed
                    ? 'w-[var(--sidebar-collapsed)]'
                    : 'w-[var(--sidebar-width)]',
            )}
        >
            <div
                className={cn(
                    'flex h-[var(--topbar-height)] shrink-0 items-center border-b border-[var(--rule)] px-3',
                    collapsed ? 'justify-center' : 'justify-between gap-2',
                )}
            >
                {!collapsed && (
                    <Link
                        href="/dasbor"
                        className="flex min-w-0 items-center gap-3 rounded-[var(--radius-control)] py-1 pr-1"
                    >
                        <span
                            aria-hidden
                            className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--accent-ink)]"
                        >
                            {brandLogo ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                    src={brandLogo}
                                    alt={brandTitle}
                                    className="size-8 rounded-[var(--radius-control)] object-contain"
                                />
                            ) : (
                                <Activity
                                    className="size-4"
                                    strokeWidth={1.5}
                                />
                            )}
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate text-[14px] leading-tight font-medium text-foreground">
                                {brandTitle}
                            </span>
                            <span className="block truncate text-[12px] text-muted-foreground">
                                {brandTagline}
                            </span>
                        </span>
                    </Link>
                )}

                <button
                    type="button"
                    onClick={toggleCollapse}
                    aria-expanded={!collapsed}
                    aria-label={
                        collapsed ? 'Perluas bilah sisi' : 'Ciutkan bilah sisi'
                    }
                    title={
                        collapsed ? 'Perluas bilah sisi' : 'Ciutkan bilah sisi'
                    }
                    className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-control)] text-muted-foreground transition-colors duration-150 hover:bg-[var(--raised)] hover:text-foreground"
                >
                    {collapsed ? (
                        <PanelLeftOpen
                            className="size-4"
                            strokeWidth={1.5}
                            aria-hidden
                        />
                    ) : (
                        <PanelLeftClose
                            className="size-4"
                            strokeWidth={1.5}
                            aria-hidden
                        />
                    )}
                </button>
            </div>

            {!collapsed && (
                <div className="border-b border-[var(--rule)] bg-[var(--raised)]/45 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Building2
                            className="size-4 shrink-0 text-muted-foreground"
                            strokeWidth={1.5}
                            aria-hidden
                        />
                        <div className="min-w-0">
                            <p className="truncate text-[12px] leading-tight font-medium text-foreground">
                                {institution ??
                                    (role === 'DINKES'
                                        ? 'Dinas Kesehatan'
                                        : role === 'ADMIN'
                                          ? 'Pusat Administrator'
                                          : 'Fasilitas Kesehatan')}
                            </p>
                            <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                                {ROLE_LABEL[role] ?? role}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="px-3 pt-3">
                <button
                    type="button"
                    onClick={() =>
                        window.dispatchEvent(new Event('wali-epi:open-command'))
                    }
                    className={cn(
                        'flex h-9 w-full items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--ground)]/65 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-[var(--raised)] hover:text-foreground',
                        collapsed ? 'justify-center' : 'justify-between px-3',
                    )}
                    title="Pencarian cepat (Ctrl+K)"
                >
                    <span className="flex items-center gap-2">
                        <Search
                            className="size-4 shrink-0"
                            strokeWidth={1.5}
                            aria-hidden
                        />
                        {!collapsed && <span>Cari</span>}
                    </span>
                    {!collapsed && (
                        <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                            ⌘K
                        </kbd>
                    )}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
                {groups.map((group) => (
                    <div key={group.label} className="mt-6 first:mt-0">
                        {!collapsed && (
                            <p className="mb-2 px-3 text-[12px] font-medium text-muted-foreground">
                                {group.label}
                            </p>
                        )}
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
                                            title={
                                                collapsed
                                                    ? item.label
                                                    : undefined
                                            }
                                            aria-label={
                                                collapsed
                                                    ? item.label
                                                    : undefined
                                            }
                                            aria-current={
                                                active ? 'page' : undefined
                                            }
                                            className={cn(
                                                'relative flex h-9 items-center gap-3 rounded-[var(--radius-control)] text-[13px] whitespace-nowrap transition-colors duration-150',
                                                collapsed
                                                    ? 'justify-center px-0'
                                                    : 'px-3',
                                                active
                                                    ? 'bg-[var(--active)] font-medium text-[var(--accent)]'
                                                    : 'font-normal text-muted-foreground hover:bg-[var(--raised)] hover:text-foreground',
                                            )}
                                        >
                                            {active && !collapsed && (
                                                <span
                                                    aria-hidden
                                                    className="absolute top-2 bottom-2 left-0 w-[2px] rounded-r-full bg-[var(--accent)]"
                                                />
                                            )}
                                            {Icon && (
                                                <Icon
                                                    className={cn(
                                                        'size-4 shrink-0',
                                                        active
                                                            ? 'text-[var(--accent)]'
                                                            : 'text-muted-foreground',
                                                    )}
                                                    strokeWidth={1.5}
                                                    aria-hidden
                                                />
                                            )}
                                            {!collapsed && (
                                                <span className="truncate">
                                                    {item.label}
                                                </span>
                                            )}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>

            <div className="shrink-0 border-t border-[var(--rule)] p-3">
                <UserMenu
                    name={name}
                    email={email}
                    roleLabel={ROLE_LABEL[role]}
                    institution={institution}
                    compact={collapsed}
                />
            </div>
        </nav>
    );
}
