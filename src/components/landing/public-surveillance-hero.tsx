'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import type { PublicCaseGeoPoint } from '@/lib/domain/map-data';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
    PublicCaseMap,
    type PublicMapFocusMode,
} from '@/components/landing/public-case-map';

export type PublicSurveillanceSummary = {
    totalThisMonth: number;
    peCompleted: number;
    foggingActive: number;
    closedCases: number;
    topKecamatan: { kecamatan: string; count: number }[];
};

type MetricKey = 'total' | 'pe' | 'fogging' | 'closed';

/** Precision 280ms quartic ease-out integer settle on mount; skips when reduced-motion is set. */
function AnimatedNumber({ value }: { value: number }) {
    const [display, setDisplay] = useState(value);

    useEffect(() => {
        if (value <= 0 || typeof window === 'undefined') {
            setDisplay(value);
            return;
        }
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setDisplay(value);
            return;
        }

        const startValue = value > 12 ? Math.round(value * 0.65) : 0;
        const delta = value - startValue;
        const duration = 280;
        let rafId = 0;
        const t0 = performance.now();

        setDisplay(startValue);

        const tick = (now: number) => {
            const progress = Math.min(1, (now - t0) / duration);
            const eased = 1 - Math.pow(1 - progress, 4);
            setDisplay(Math.round(startValue + delta * eased));
            if (progress < 1) {
                rafId = window.requestAnimationFrame(tick);
            }
        };

        rafId = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(rafId);
    }, [value]);

    return <>{formatNumber(display)}</>;
}

export function PublicSurveillanceHero({
    cases,
    summary,
}: {
    cases: PublicCaseGeoPoint[];
    summary: PublicSurveillanceSummary;
}) {
    const [selectedKey, setSelectedKey] = useState<MetricKey | null>(null);

    const clusterCount = cases.filter((c) => Boolean(c.clusterId)).length;
    const sporadicCount = cases.length - clusterCount;
    const peRate =
        summary.totalThisMonth > 0
            ? Math.min(
                  100,
                  Math.round(
                      (summary.peCompleted / summary.totalThisMonth) * 100,
                  ),
              )
            : null;
    const closedRate =
        summary.totalThisMonth > 0
            ? Math.min(
                  100,
                  Math.round(
                      (summary.closedCases / summary.totalThisMonth) * 100,
                  ),
              )
            : null;

    const topKecamatanText =
        summary.topKecamatan.length > 0
            ? summary.topKecamatan
                  .slice(0, 3)
                  .map(
                      (item) =>
                          `${item.kecamatan} (${formatNumber(item.count)})`,
                  )
                  .join(' · ')
            : 'Belum ada sebaran kecamatan tercatat';

    const cards: {
        key: MetricKey;
        label: string;
        value: number;
        caption: string;
        accent: boolean;
        focusMode: PublicMapFocusMode;
        mapFocusLabel: string;
        summaryTitle: string;
        summaryDetail: string;
        summaryMeta: string;
    }[] = [
        {
            key: 'total',
            label: 'Laporan bulan ini',
            value: summary.totalThisMonth,
            caption: 'Kasus klinis terdaftar',
            accent: false,
            focusMode: 'all',
            mapFocusLabel: 'Seluruh titik kasus',
            summaryTitle: 'Sebaran kecamatan terbanyak',
            summaryDetail: topKecamatanText,
            summaryMeta: `${formatNumber(cases.length)} titik GPS di peta`,
        },
        {
            key: 'pe',
            label: 'PE terverifikasi',
            value: summary.peCompleted,
            caption: 'Target investigasi 72 jam',
            accent: true,
            focusMode: 'cluster',
            mapFocusLabel: 'Area klaster PE 100 m',
            summaryTitle: 'Fokus penyelidikan epidemiologi',
            summaryDetail:
                peRate !== null
                    ? `${peRate}% terhadap laporan bulan ini · target survei jentik 100 rumah dalam 72 jam`
                    : 'Target survei jentik 100 rumah sekitar kasus dalam 72 jam',
            summaryMeta: `${formatNumber(clusterCount)} titik klaster 100 m`,
        },
        {
            key: 'fogging',
            label: 'Tindak lanjut aktif',
            value: summary.foggingActive,
            caption: 'Siklus fogging dan PSN',
            accent: false,
            focusMode: 'cluster',
            mapFocusLabel: 'Zona tindak lanjut klaster',
            summaryTitle: 'Intervensi pengendalian vektor',
            summaryDetail:
                'Penjadwalan fogging fokus Siklus 1 (H0), Siklus 2 (H+7), larvasidasi, dan PSN 3M Plus',
            summaryMeta: `${formatNumber(clusterCount)} titik dalam radius 100 m`,
        },
        {
            key: 'closed',
            label: 'Kasus ditutup',
            value: summary.closedCases,
            caption: 'Siklus surveilans selesai',
            accent: false,
            focusMode: 'sporadic',
            mapFocusLabel: 'Kasus non-klaster',
            summaryTitle: 'Penyelesaian siklus surveilans',
            summaryDetail:
                closedRate !== null
                    ? `${closedRate}% terverifikasi selesai lintas RS, Puskesmas, dan Dinas Kesehatan`
                    : 'Verifikasi lintas RS, Puskesmas, dan Dinas Kesehatan telah tuntas',
            summaryMeta: `${formatNumber(sporadicCount)} titik kasus tunggal`,
        },
    ];

    const activeCard = selectedKey
        ? (cards.find((c) => c.key === selectedKey) ?? null)
        : null;

    function toggleCard(key: MetricKey) {
        setSelectedKey((prev) => (prev === key ? null : key));
    }

    return (
        <section className="pt-12 pb-16 md:pt-20 md:pb-24">
            <div className="mx-auto max-w-6xl px-4 md:px-6">
                <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
                    {/* Left Text Block (5 Cols) */}
                    <div className="space-y-6 lg:col-span-5">
                        <p
                            className="hero-settle font-mono text-[12px] text-[var(--accent)]"
                            style={{ '--settle-delay': '0ms' } as CSSProperties}
                        >
                            Surveilans DBD · RS, Puskesmas, Dinas Kesehatan
                        </p>

                        <h1
                            className="hero-settle text-[32px] leading-[1.12] font-medium tracking-[-0.02em] text-foreground sm:text-[40px] md:text-[44px]"
                            style={
                                { '--settle-delay': '40ms' } as CSSProperties
                            }
                        >
                            Pelaporan kasus DBD dan penyelidikan 72 jam dalam
                            satu jalur
                        </h1>

                        <p
                            className="hero-settle max-w-[48ch] text-[16px] leading-relaxed text-muted-foreground"
                            style={
                                { '--settle-delay': '80ms' } as CSSProperties
                            }
                        >
                            Menghubungkan notifikasi KDRS Rumah Sakit,
                            investigasi jentik Puskesmas, dan verifikasi Dinas
                            Kesehatan dengan perlindungan PII terenkripsi
                            AES-256.
                        </p>

                        <div
                            className="hero-settle flex flex-wrap items-center gap-3 pt-2"
                            style={
                                { '--settle-delay': '120ms' } as CSSProperties
                            }
                        >
                            <Link
                                href="/masuk"
                                className="inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-5 text-[14px] font-medium text-[var(--accent-ink)] transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-[var(--accent)]/90 active:scale-[0.98]"
                            >
                                Masuk portal petugas
                            </Link>

                            <a
                                href="#alur"
                                className="inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-4 text-[14px] font-medium text-foreground transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-[var(--raised)] active:scale-[0.98]"
                            >
                                Alur kerja
                            </a>
                        </div>
                    </div>

                    {/* Right Live Case Distribution Map (7 Cols) */}
                    <div className="lg:col-span-7">
                        <PublicCaseMap
                            cases={cases}
                            height={440}
                            focusMode={activeCard?.focusMode ?? 'all'}
                            focusLabel={activeCard?.mapFocusLabel}
                            onResetFocus={() => setSelectedKey(null)}
                        />
                    </div>
                </div>

                {/* Monthly Surveillance Strip */}
                <div className="mt-16 md:mt-20">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-4 text-[12px] text-muted-foreground">
                        <span className="font-medium text-foreground">
                            Ringkasan surveilans bulan ini
                        </span>
                        <span className="inline-flex items-center gap-2 font-mono">
                            <span
                                aria-hidden
                                className="size-1.5 rounded-full bg-[var(--accent)]"
                            />
                            Klik kartu untuk sorot peta · Data terverifikasi
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {cards.map((item) => {
                            const isSelected = selectedKey === item.key;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => toggleCard(item.key)}
                                    className={cn(
                                        'stat-card-interactive group cursor-pointer rounded-[var(--radius-card)] border p-5 text-left focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:outline-none',
                                        isSelected
                                            ? 'border-[var(--accent)] bg-[var(--active)]/35'
                                            : 'border-[var(--border)] bg-[var(--surface)]',
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-[12px] font-medium text-muted-foreground">
                                            {item.label}
                                        </p>
                                        <span
                                            aria-hidden
                                            className={cn(
                                                'size-1.5 shrink-0 rounded-full transition-opacity duration-150',
                                                isSelected
                                                    ? 'bg-[var(--accent)] opacity-100'
                                                    : 'bg-muted-foreground/30 opacity-0 group-hover:opacity-100',
                                            )}
                                        />
                                    </div>
                                    <p
                                        data-numeric
                                        className={cn(
                                            'mt-2 font-mono text-[28px] leading-none font-medium tracking-[-0.02em] tabular-nums md:text-[32px]',
                                            item.accent || isSelected
                                                ? 'text-[var(--accent)]'
                                                : 'text-foreground',
                                        )}
                                    >
                                        <AnimatedNumber value={item.value} />
                                    </p>
                                    <p className="mt-2 text-[12px] text-muted-foreground">
                                        {item.caption}
                                    </p>
                                </button>
                            );
                        })}
                    </div>

                    {activeCard ? (
                        <div
                            key={activeCard.key}
                            role="status"
                            aria-live="polite"
                            className="summary-reveal mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-l-2 border-[var(--border)] border-l-[var(--accent)] bg-[var(--surface)] px-4 py-3"
                        >
                            <div className="min-w-0 space-y-0.5">
                                <p className="text-[13px] font-medium text-foreground">
                                    {activeCard.summaryTitle}
                                </p>
                                <p className="text-[12px] text-muted-foreground">
                                    {activeCard.summaryDetail}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                                <span className="font-mono text-[12px] text-foreground tabular-nums">
                                    {activeCard.summaryMeta}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedKey(null)}
                                    className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--ground)] px-2.5 text-[12px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-[var(--raised)] hover:text-foreground"
                                >
                                    <X
                                        className="size-3.5"
                                        strokeWidth={1.5}
                                        aria-hidden
                                    />
                                    <span>Reset</span>
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
