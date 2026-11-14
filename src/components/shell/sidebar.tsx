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

type Props = {
    role: Role;
    name: string;
    email: string;
    institution: string | null;
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
export function Sidebar({ role, name, email, institution }: Props) {
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
                        className="flex min-w-0 items-center gap-2.5 rounded-[var(--radius-control)] py-1 pr-1"
                    >
                        <span
                            aria-hidden
                            className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-[var(--accent)] text-[var(--accent-ink)]"
                        >
                            <Activity className="size-4" strokeWidth={2.2} />
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate text-[14px] leading-tight font-semibold tracking-[-0.01em] text-foreground">
                                WALI-EPI
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                                Surveilans DBD
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
                    className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-[var(--raised)] hover:text-foreground"
                >
                    {collapsed ? (
                        <PanelLeftOpen
                            className="size-4"
                            strokeWidth={1.75}
                            aria-hidden
                        />
                    ) : (
                        <PanelLeftClose
                            className="size-4"
                            strokeWidth={1.75}
                            aria-hidden
                        />
                    )}
                </button>
            </div>

            {institution && !collapsed && (
                <div className="border-b border-[var(--rule)] bg-[var(--raised)]/45 px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                        <Building2
                            className="size-3.5 shrink-0 text-[var(--accent)]"
                            strokeWidth={1.75}
                            aria-hidden
                        />
                        <div className="min-w-0">
                            <p className="truncate text-[12px] leading-tight font-medium text-foreground">
                                {institution}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                {ROLE_LABEL[role]}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="px-2 pt-2.5">
                <button
                    type="button"
                    onClick={() =>
                        window.dispatchEvent(new Event('wali-epi:open-command'))
                    }
                    className={cn(
                        'flex w-full items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--ground)]/65 text-[12.5px] text-muted-foreground transition-colors hover:bg-[var(--raised)] hover:text-foreground',
                        collapsed
                            ? 'h-9 justify-center'
                            : 'h-9 justify-between px-2.5',
                    )}
                    title="Pencarian cepat (Ctrl+K)"
                >
                    <span className="flex items-center gap-2">
                        <Search className="size-3.5 shrink-0" aria-hidden />
                        {!collapsed && <span>Cari cepat…</span>}
                    </span>
                    {!collapsed && (
                        <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            ⌘K
                        </kbd>
                    )}
                </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-2.5 py-3.5">
                {groups.map((group) => (
                    <div key={group.label}>
                        {!collapsed && (
                            <p className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-[0.02em] text-faint">
                                {group.label}
                            </p>
                        )}
                        <ul className="space-y-0.5">
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
                                                'relative flex h-9 items-center gap-2.5 rounded-[var(--radius-control)] text-[13.5px] whitespace-nowrap transition-colors',
                                                collapsed
                                                    ? 'justify-center px-0'
                                                    : 'px-2.5',
                                                active
                                                    ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent)]'
                                                    : 'font-medium text-muted-foreground hover:bg-[var(--raised)] hover:text-foreground',
                                            )}
                                        >
                                            {active && !collapsed && (
                                                <span
                                                    aria-hidden
                                                    className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r-full bg-[var(--accent)]"
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
                                                    strokeWidth={
                                                        active ? 2 : 1.75
                                                    }
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

            <div className="shrink-0 border-t border-[var(--rule)] p-2">
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
