'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Building2 } from 'lucide-react';
import { NAV, ROLE_LABEL } from '@/lib/nav';
import { NAV_ICON } from '@/lib/nav-icons';
import type { Role } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { UserMenu } from './user-menu';

function isActive(pathname: string, href: string) {
    return (
        pathname === href ||
        (href !== '/laporan' && pathname.startsWith(`${href}/`))
    );
}

/**
 * The sidebar under `md`. A left sheet holds no chat log or picture, only a
 * list, so it is a full-height panel that slides in — not a dialog doing a
 * panel's job. It opens on the button, closes on a link or on Escape.
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

    return (
        <div className="md:hidden">
            <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-[var(--ground)] px-4">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label="Buka navigasi"
                    aria-expanded={open}
                    className="-ml-2 grid size-9 place-items-center rounded-[var(--radius-control)] text-muted-foreground hover:bg-[var(--raised)] hover:text-foreground"
                >
                    <Menu className="size-5" strokeWidth={1.5} />
                </button>
                <span className="text-[14px] font-medium">WALI-EPI</span>
            </header>

            {open && (
                <div className="fixed inset-0 z-30">
                    <button
                        type="button"
                        aria-label="Tutup navigasi"
                        onClick={() => setOpen(false)}
                        className="absolute inset-0 bg-black/25"
                    />
                    <nav
                        aria-label="Navigasi utama"
                        className="absolute inset-y-0 left-0 flex w-[82vw] max-w-[320px] flex-col bg-[var(--surface)]"
                    >
                        <div className="flex h-14 items-center justify-between border-b border-border px-4">
                            <span className="text-[14px] font-medium">
                                WALI-EPI
                            </span>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Tutup navigasi"
                                className="grid size-9 place-items-center rounded-[var(--radius-control)] text-muted-foreground hover:bg-[var(--raised)]"
                            >
                                <X className="size-5" strokeWidth={1.5} />
                            </button>
                        </div>

                        <div className="flex items-center gap-1.5 px-4 py-3 text-[12px] text-muted-foreground">
                            <Building2
                                className="size-3.5 shrink-0"
                                strokeWidth={1.5}
                            />
                            <span className="truncate">
                                {institution ?? ROLE_LABEL[role]}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto px-3 pb-4">
                            {NAV[role].map((group) => (
                                <div key={group.label} className="mt-4 first:mt-0">
                                    <div className="px-1 pb-1 text-[12px] text-muted-foreground">
                                        {group.label}
                                    </div>
                                    <ul>
                                        {group.items.map((item) => {
                                            const active = isActive(
                                                pathname,
                                                item.href,
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
                                                            'flex h-10 items-center gap-2.5 rounded-md px-2 text-[14px]',
                                                            active
                                                                ? 'bg-[var(--active)] font-medium text-foreground'
                                                                : 'text-muted-foreground',
                                                        )}
                                                    >
                                                        {Icon && (
                                                            <Icon
                                                                aria-hidden
                                                                className="size-4 shrink-0"
                                                                strokeWidth={
                                                                    1.5
                                                                }
                                                            />
                                                        )}
                                                        <span className="truncate">
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

                        <div className="border-t border-border p-3">
                            <UserMenu
                                name={name}
                                email={email}
                                role={role}
                            />
                        </div>
                    </nav>
                </div>
            )}
        </div>
    );
}
