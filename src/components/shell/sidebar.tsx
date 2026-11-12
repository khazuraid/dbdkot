'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { NAV, ROLE_LABEL } from '@/lib/nav';
import { NAV_ICON } from '@/lib/nav-icons';
import type { Role } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { UserMenu } from './user-menu';
import { MobileNav } from './mobile-nav';

type Props = {
    role: Role;
    name: string;
    email: string;
    institution: string | null;
};

function isActive(pathname: string, href: string) {
    return (
        pathname === href ||
        (href !== '/laporan' && pathname.startsWith(`${href}/`))
    );
}

/**
 * Open plane shell: labelled sidebar on the page ground, one hairline, no top
 * bar. Active item is a neutral grey pill, never a coloured bar (the study has
 * exactly one coloured active bar across 23 screens).
 *
 * Below `md` the sidebar is replaced by `MobileNav`, which reads the same NAV
 * tree — before this the sidebar was simply hidden and no route was reachable
 * on a phone.
 */
export function Sidebar({ role, name, email, institution }: Props) {
    const pathname = usePathname();
    const groups = NAV[role];

    return (
        <>
            <MobileNav
                role={role}
                name={name}
                email={email}
                institution={institution}
            />

            <nav
                aria-label="Navigasi utama"
                className="hidden w-[var(--sidebar-width)] shrink-0 bg-sidebar md:flex md:flex-col"
            >
                <div className="flex h-14 items-center gap-2 px-4">
                    <span
                        aria-hidden
                        className="grid size-6 place-items-center rounded-[5px] bg-primary text-[11px] font-semibold text-primary-foreground"
                    >
                        WE
                    </span>
                    <span className="text-[14px] font-medium">WALI-EPI</span>
                </div>

                <div className="px-3 pb-2">
                    <div className="flex items-center gap-1.5 px-1 text-[12px] text-muted-foreground">
                        <Building2
                            className="size-3.5 shrink-0"
                            strokeWidth={1.5}
                        />
                        <span className="truncate">
                            {institution ?? ROLE_LABEL[role]}
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-3">
                    {groups.map((group) => (
                        <div key={group.label} className="mt-5 first:mt-3">
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
                                                aria-current={
                                                    active ? 'page' : undefined
                                                }
                                                className={cn(
                                                    'flex h-8 items-center gap-2.5 rounded-md px-2 text-[14px] transition-colors',
                                                    active
                                                        ? 'bg-[var(--active)] font-medium text-foreground'
                                                        : 'text-muted-foreground hover:text-foreground',
                                                )}
                                            >
                                                {Icon && (
                                                    <Icon
                                                        aria-hidden
                                                        className="size-4 shrink-0"
                                                        strokeWidth={1.5}
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
        </>
    );
}

export { isActive };
