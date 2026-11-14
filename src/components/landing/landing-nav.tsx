'use client';

import Link from 'next/link';
import { Activity, ArrowRight } from 'lucide-react';

export function LandingNav() {
    return (
        <header className="sticky top-4 z-40 px-4 md:px-6">
            <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between rounded-full border border-[var(--border)] bg-[var(--surface)]/85 px-4 sm:px-6 shadow-sm backdrop-blur-xl">
                {/* Brand */}
                <Link
                    href="/"
                    className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
                    aria-label="WALI-EPI Beranda"
                >
                    <span className="grid size-8 place-items-center rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] shadow-xs">
                        <Activity className="size-4" strokeWidth={2.2} />
                    </span>
                    <span className="flex flex-col">
                        <span className="text-[14px] leading-tight font-bold tracking-tight text-foreground">
                            WALI-EPI
                        </span>
                        <span className="text-[10.5px] font-medium text-muted-foreground flex items-center gap-1">
                            <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Surveilans Aktif
                        </span>
                    </span>
                </Link>

                {/* Quick Anchor Links (Desktop) */}
                <div className="hidden md:flex items-center gap-6 text-[13px] font-medium text-muted-foreground">
                    <a href="#alur" className="transition-colors hover:text-foreground">
                        Alur Kerja
                    </a>
                    <a href="#fitur" className="transition-colors hover:text-foreground">
                        Fitur Unggulan
                    </a>
                    <a href="#edukasi" className="transition-colors hover:text-foreground">
                        Pencegahan 3M+
                    </a>
                    <a href="#kontak" className="transition-colors hover:text-foreground">
                        Kontak Darurat
                    </a>
                </div>

                {/* CTA Button */}
                <div className="flex items-center gap-2">
                    <Link
                        href="/masuk"
                        className="group inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-[12.5px] font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-[0.98]"
                    >
                        <span>Portal Petugas</span>
                        <span className="grid size-5 place-items-center rounded-full bg-primary-foreground/15 transition-transform group-hover:translate-x-0.5">
                            <ArrowRight className="size-3" />
                        </span>
                    </Link>
                </div>
            </nav>
        </header>
    );
}
