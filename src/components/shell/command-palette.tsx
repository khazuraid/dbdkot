'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, MapPin, Search } from 'lucide-react';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command';
import { NAV } from '@/lib/nav';
import { NAV_ICON } from '@/lib/nav-icons';
import type { Role } from '@/lib/roles';

type QuickReportHit = {
    id: string;
    reportNumber: string;
    kelurahan: string | null;
    kecamatan: string | null;
    status: string;
    caseType: string;
};

export function CommandPalette({ role }: { role: Role }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [hits, setHits] = useState<QuickReportHit[]>([]);
    const [searching, setSearching] = useState(false);
    const router = useRouter();
    const groups = useMemo(() => NAV[role] ?? [], [role]);

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
        }
        function onTrigger() {
            setOpen(true);
        }
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('wali-epi:open-command', onTrigger);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('wali-epi:open-command', onTrigger);
        };
    }, []);

    useEffect(() => {
        const q = query.trim();
        if (!open || q.length < 2) {
            return;
        }

        const ctrl = new AbortController();
        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(
                    `/api/reports/quick-search?q=${encodeURIComponent(q)}`,
                    { signal: ctrl.signal },
                );
                if (res.ok) {
                    const data = (await res.json()) as {
                        reports?: QuickReportHit[];
                    };
                    setHits(data.reports ?? []);
                }
            } catch {
                // Ignore aborts
            } finally {
                setSearching(false);
            }
        }, 180);

        return () => {
            clearTimeout(timer);
            ctrl.abort();
        };
    }, [open, query]);

    const visibleHits = query.trim().length >= 2 ? hits : [];

    function handleQueryChange(next: string) {
        setQuery(next);
        if (next.trim().length < 2) {
            setHits([]);
            setSearching(false);
        }
    }

    function go(href: string) {
        setOpen(false);
        setQuery('');
        setHits([]);
        router.push(href);
    }

    return (
        <CommandDialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) {
                    setQuery('');
                    setHits([]);
                    setSearching(false);
                }
            }}
            title="Pencarian cepat WALI-EPI"
            description="Cari nomor KDRS, kelurahan, atau navigasi cepat antar modul."
        >
            <CommandInput
                value={query}
                onValueChange={handleQueryChange}
                placeholder="Ketik nomor KDRS, kelurahan, atau menu…"
            />
            <CommandList>
                <CommandEmpty>
                    {searching
                        ? 'Mencari laporan KDRS…'
                        : 'Tidak ada hasil yang cocok.'}
                </CommandEmpty>

                {visibleHits.length > 0 && (
                    <>
                        <CommandGroup heading="Laporan KDRS & Kelurahan">
                            {visibleHits.map((r) => (
                                <CommandItem
                                    key={r.id}
                                    value={`${r.reportNumber} ${r.kelurahan ?? ''} ${r.kecamatan ?? ''}`}
                                    onSelect={() => go(`/laporan/${r.id}`)}
                                >
                                    <FileText className="size-4 shrink-0" />
                                    <span className="font-mono font-medium">
                                        {r.reportNumber}
                                    </span>
                                    <span className="ml-2 flex items-center gap-1 text-[12px] text-muted-foreground">
                                        <MapPin className="size-3" />
                                        {r.kelurahan ?? '-'}
                                    </span>
                                    <span className="ml-auto text-[11px] text-muted-foreground">
                                        {r.status}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                    </>
                )}

                {groups.map((group, idx) => (
                    <div key={group.label}>
                        {idx > 0 && <CommandSeparator />}
                        <CommandGroup heading={group.label}>
                            {group.items.map((item) => {
                                const Icon = NAV_ICON[item.href] ?? Search;
                                return (
                                    <CommandItem
                                        key={item.href}
                                        value={`${item.label} ${item.href}`}
                                        onSelect={() => go(item.href)}
                                    >
                                        <Icon aria-hidden />
                                        <span>{item.label}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </div>
                ))}
            </CommandList>
        </CommandDialog>
    );
}
