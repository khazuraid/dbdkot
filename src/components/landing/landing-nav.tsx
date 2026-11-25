'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity, Menu, X } from 'lucide-react';

const NAV_LINKS = [
    { href: '#alur', label: 'Alur kerja' },
    { href: '#fitur', label: 'Kemampuan' },
    { href: '#edukasi', label: 'Pencegahan 3M+' },
    { href: '#kontak', label: 'Kontak darurat' },
];

export function LandingNav({
    branding,
}: {
    branding?: { title: string; tagline: string; logoUrl: string | null };
}) {
    const title = branding?.title || 'WALI-EPI';
    const tagline = branding?.tagline || 'Surveilans DBD';
    const logoUrl = branding?.logoUrl ?? null;
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-sm">
            <nav
                aria-label="Navigasi utama"
                className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 md:px-6"
            >
                <Link
                    href="/"
                    className="flex items-center gap-3 transition-opacity duration-150 hover:opacity-85"
                    aria-label={`${title} Beranda`}
                >
                    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--accent-ink)]">
                        {logoUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={logoUrl}
                                alt={title}
                                className="size-8 object-contain"
                            />
                        ) : (
                            <Activity className="size-4" strokeWidth={1.75} />
                        )}
                    </span>
                    <span className="flex flex-col">
                        <span className="text-[14px] leading-tight font-medium text-foreground">
                            {title}
                        </span>
                        <span className="text-[12px] leading-tight text-muted-foreground">
                            {tagline}
                        </span>
                    </span>
                </Link>

                <div className="hidden items-center gap-6 text-[13px] text-muted-foreground md:flex">
                    {NAV_LINKS.map((item) => (
                        <a
                            key={item.href}
                            href={item.href}
                            className="transition-colors duration-150 hover:text-foreground"
                        >
                            {item.label}
                        </a>
                    ))}
                </div>

                <div className="flex items-center gap-4">
                    <Link
                        href="/daftar"
                        className="hidden text-[13px] text-muted-foreground transition-colors duration-150 hover:text-foreground sm:inline-block"
                    >
                        Registrasi
                    </Link>
                    <Link
                        href="/masuk"
                        className="inline-flex h-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-[13px] font-medium text-[var(--accent-ink)] transition-colors duration-150 hover:bg-[var(--accent)]/90 active:scale-[0.98]"
                    >
                        Masuk portal
                    </Link>
                    <button
                        type="button"
                        onClick={() => setMenuOpen((prev) => !prev)}
                        aria-expanded={menuOpen}
                        aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
                        className="inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] text-muted-foreground transition-colors duration-150 hover:bg-[var(--raised)] hover:text-foreground md:hidden"
                    >
                        {menuOpen ? (
                            <X className="size-4" strokeWidth={1.5} />
                        ) : (
                            <Menu className="size-4" strokeWidth={1.5} />
                        )}
                    </button>
                </div>
            </nav>

            {menuOpen && (
                <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 md:hidden">
                    <div className="flex flex-col gap-1">
                        {NAV_LINKS.map((item) => (
                            <a
                                key={item.href}
                                href={item.href}
                                onClick={() => setMenuOpen(false)}
                                className="flex h-10 items-center rounded-[var(--radius-control)] px-3 text-[14px] text-muted-foreground transition-colors duration-150 hover:bg-[var(--raised)] hover:text-foreground"
                            >
                                {item.label}
                            </a>
                        ))}
                        <Link
                            href="/daftar"
                            onClick={() => setMenuOpen(false)}
                            className="flex h-10 items-center rounded-[var(--radius-control)] px-3 text-[14px] text-muted-foreground transition-colors duration-150 hover:bg-[var(--raised)] hover:text-foreground sm:hidden"
                        >
                            Registrasi instansi
                        </Link>
                    </div>
                </div>
            )}
        </header>
    );
}
