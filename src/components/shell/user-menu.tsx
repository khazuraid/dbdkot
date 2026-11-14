'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
    Check,
    ChevronsUpDown,
    LogOutIcon,
    MonitorIcon,
    MoonIcon,
    SettingsIcon,
    SunIcon,
} from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export function UserMenu({
    name,
    email,
    roleLabel,
    institution,
    compact = false,
}: {
    name: string;
    email: string;
    roleLabel: string;
    institution: string | null;
    compact?: boolean;
}) {
    const router = useRouter();
    const { theme, setTheme } = useTheme();

    async function signOut() {
        await authClient.signOut();
        router.replace('/masuk');
    }

    const initials = name
        .split(/\s+/)
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                className={cn(
                    'flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-2 text-left transition-colors hover:bg-[var(--raised)] data-popup-open:bg-[var(--active)]',
                    compact && 'justify-center px-0',
                )}
                aria-label="Menu akun"
                title={compact ? `${name} (${roleLabel})` : undefined}
            >
                <Avatar size="sm" aria-hidden>
                    <AvatarFallback className="bg-[var(--accent)] text-[10.5px] font-semibold text-[var(--accent-ink)]">
                        {initials || 'WE'}
                    </AvatarFallback>
                </Avatar>
                {!compact && (
                    <>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] leading-tight font-medium text-foreground">
                                {name}
                            </p>
                            <p className="truncate text-[11px] leading-tight text-muted-foreground">
                                {roleLabel}
                            </p>
                        </div>
                        <ChevronsUpDown
                            className="size-3.5 shrink-0 text-faint"
                            aria-hidden
                        />
                    </>
                )}
            </DropdownMenuTrigger>

            <DropdownMenuContent side="top" align="start" className="w-60">
                <DropdownMenuLabel className="font-normal">
                    <p className="truncate text-[13px] font-semibold text-foreground">
                        {name}
                    </p>
                    <p className="truncate text-[11.5px] text-muted-foreground">
                        {email}
                    </p>
                    {institution && (
                        <p className="mt-0.5 truncate text-[11px] text-faint">
                            {institution}
                        </p>
                    )}
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground">
                    Tampilan
                </DropdownMenuLabel>

                <DropdownMenuItem
                    onClick={() => setTheme('light')}
                    className="justify-between"
                >
                    <span className="flex items-center gap-2">
                        <SunIcon className="size-4" aria-hidden />
                        Terang
                    </span>
                    {theme === 'light' && (
                        <Check
                            className="size-3.5 text-[var(--accent)]"
                            aria-hidden
                        />
                    )}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => setTheme('dark')}
                    className="justify-between"
                >
                    <span className="flex items-center gap-2">
                        <MoonIcon className="size-4" aria-hidden />
                        Gelap
                    </span>
                    {theme === 'dark' && (
                        <Check
                            className="size-3.5 text-[var(--accent)]"
                            aria-hidden
                        />
                    )}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => setTheme('system')}
                    className="justify-between"
                >
                    <span className="flex items-center gap-2">
                        <MonitorIcon className="size-4" aria-hidden />
                        Ikuti sistem
                    </span>
                    {theme === 'system' && (
                        <Check
                            className="size-3.5 text-[var(--accent)]"
                            aria-hidden
                        />
                    )}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                    <Link href="/pengaturan" className="flex items-center gap-2">
                        <SettingsIcon className="size-4" aria-hidden />
                        Pengaturan akun
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={signOut}
                    variant="destructive"
                    className="flex items-center gap-2"
                >
                    <LogOutIcon className="size-4" aria-hidden />
                    Keluar
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
