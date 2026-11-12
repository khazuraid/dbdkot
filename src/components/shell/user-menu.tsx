'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { authClient } from '@/lib/auth-client';
import { ROLE_LABEL } from '@/lib/nav';
import type { Role } from '@/lib/roles';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Props = { name: string; email: string; role: Role };

export function UserMenu({ name, email, role }: Props) {
    const router = useRouter();
    const { resolvedTheme, setTheme } = useTheme();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md p-1.5 text-left hover:bg-[var(--raised)]">
                <span
                    aria-hidden
                    className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--raised)] text-[11px] font-medium"
                >
                    {initials(name)}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">
                        {name}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                        {ROLE_LABEL[role]}
                    </span>
                </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56">
                <div className="px-2 py-1.5">
                    <div className="truncate text-[13px] font-medium">
                        {name}
                    </div>
                    <div className="truncate text-[12px] text-muted-foreground">
                        {email}
                    </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={() =>
                        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
                    }
                >
                    {resolvedTheme === 'dark' ? (
                        <Sun className="size-4" strokeWidth={1.5} />
                    ) : (
                        <Moon className="size-4" strokeWidth={1.5} />
                    )}
                    Tema {resolvedTheme === 'dark' ? 'terang' : 'gelap'}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={async () => {
                        await authClient.signOut();
                        router.push('/masuk');
                        router.refresh();
                    }}
                >
                    <LogOut className="size-4" strokeWidth={1.5} />
                    Keluar
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function initials(name: string) {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
}
