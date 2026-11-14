import { Suspense } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import {
    ArrowRight,
    CheckCircle2,
    ShieldCheck,
    Sparkles,
    Timer,
} from 'lucide-react';
import { getPublicSurveillanceSummary } from '@/lib/domain/reports';
import { formatNumber } from '@/lib/format';
import { LandingNav } from '@/components/landing/landing-nav';
import { HeroInteractive } from '@/components/landing/hero-interactive';
import { BentoFeatures } from '@/components/landing/bento-features';
import { PreventionSection } from '@/components/landing/prevention-section';

async function PublicStatsStrip() {
    await connection();
    const summary = await getPublicSurveillanceSummary();

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
                <p className="text-[11.5px] font-medium text-muted-foreground">
                    Laporan Bulan Ini
                </p>
                <p
                    data-numeric
                    className="mt-1 font-mono text-[24px] font-bold tracking-tight text-foreground md:text-[28px]"
                >
                    {formatNumber(summary.totalThisMonth)}
                </p>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">Kasus Klinis Terdaftar</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
                <p className="text-[11.5px] font-medium text-muted-foreground">
                    PE Selesai Diverifikasi
                </p>
                <p
                    data-numeric
                    className="mt-1 font-mono text-[24px] font-bold tracking-tight text-teal-600 dark:text-teal-400 md:text-[28px]"
                >
                    {formatNumber(summary.peCompleted)}
                </p>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">Investigasi 72 Jam</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
                <p className="text-[11.5px] font-medium text-muted-foreground">
                    Tindak Lanjut Aktif
                </p>
                <p
                    data-numeric
                    className="mt-1 font-mono text-[24px] font-bold tracking-tight text-amber-600 dark:text-amber-400 md:text-[28px]"
                >
                    {formatNumber(summary.foggingActive)}
                </p>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">Siklus Fogging / PSN</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
                <p className="text-[11.5px] font-medium text-muted-foreground">
                    Kasus Ditutup Tuntas
                </p>
                <p
                    data-numeric
                    className="mt-1 font-mono text-[24px] font-bold tracking-tight text-emerald-600 dark:text-emerald-400 md:text-[28px]"
                >
                    {formatNumber(summary.closedCases)}
                </p>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">Siklus Surveilans Selesai</p>
            </div>
        </div>
    );
}

function StatsSkeleton() {
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <div
                    key={i}
                    className="h-24 animate-pulse rounded-2xl border border-[var(--border)] bg-muted/40"
                />
            ))}
        </div>
    );
}

const STEPS = [
    {
        num: '01',
        role: 'Rumah Sakit & Klinik',
        title: 'Deteksi Dini & KDRS',
        desc: 'Mencatat diagnosis klinis lab (trombosit & hematokrit) dalam 24 jam dengan validasi alamat otomatis.',
    },
    {
        num: '02',
        role: 'Puskesmas Wilayah',
        title: 'Investigasi PE 72 Jam',
        desc: 'Menerima disposisi kelurahan, memeriksa jentik 100 rumah sekitar, menghitung ABJ, serta memetakan risiko penularan.',
    },
    {
        num: '03',
        role: 'Dinas Kesehatan Kota',
        title: 'Verifikasi & Kendali Wabah',
        desc: 'Memvalidasi epidemiologi, memantau klaster geospasial 100m, dan menggerakkan fogging fokus 2 siklus terpadu.',
    },
];

export default function LandingPage() {
    return (
        <div className="min-h-[100dvh] bg-[var(--ground)] text-foreground flex flex-col">
            {/* Floating Island Navigation */}
            <LandingNav />

            <main className="flex-1">
                {/* Asymmetric Split Hero Section */}
                <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24">
                    <div className="mx-auto max-w-6xl px-4 md:px-6">
                        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
                            {/* Left Text Block (7 Cols) */}
                            <div className="lg:col-span-7 space-y-6">
                                {/* Eyebrow Badge */}
                                <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3.5 py-1 text-xs font-semibold text-teal-700 dark:text-teal-400">
                                    <Sparkles className="size-3.5 text-teal-600" />
                                    Sistem Surveilans Terpadu Kota Bandung
                                </div>

                                <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:leading-[1.12]">
                                    Surveilans DBD Cepat, Terarah, dan Terintegrasi
                                </h1>

                                <p className="max-w-[54ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
                                    Menghubungkan notifikasi kasus Rumah Sakit, investigasi epidemiologi 72 jam Puskesmas, serta kendali operasional Dinas Kesehatan dalam satu sistem terpadu.
                                </p>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                                    <Link
                                        href="/masuk"
                                        className="group inline-flex items-center gap-2.5 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-[0.98]"
                                    >
                                        <span>Masuk Portal Petugas</span>
                                        <span className="grid size-6 place-items-center rounded-full bg-primary-foreground/15 transition-transform group-hover:translate-x-1">
                                            <ArrowRight className="size-3.5" />
                                        </span>
                                    </Link>

                                    <a
                                        href="#alur"
                                        className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
                                    >
                                        Pelajari Alur Kerja
                                    </a>
                                </div>

                                {/* Privacy & Security Trust Badges */}
                                <div className="flex flex-wrap items-center gap-6 pt-4 text-xs font-medium text-muted-foreground">
                                    <span className="flex items-center gap-1.5">
                                        <ShieldCheck className="size-4 text-teal-600" />
                                        Terenkripsi AES-256 (PII Terlindungi)
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Timer className="size-4 text-teal-600" />
                                        SLA Kemenkes 24 Jam & 72 Jam
                                    </span>
                                </div>
                            </div>

                            {/* Right Interactive Preview (5 Cols) */}
                            <div className="lg:col-span-5">
                                <HeroInteractive />
                            </div>
                        </div>

                        {/* Live Telemetry Banner */}
                        <div className="mt-16 md:mt-20">
                            <div className="mb-3 flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                <span>Status Surveilans Real-Time</span>
                                <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
                                    <span className="size-1.5 rounded-full bg-teal-500 animate-pulse" />
                                    Data Terverifikasi
                                </span>
                            </div>
                            <Suspense fallback={<StatsSkeleton />}>
                                <PublicStatsStrip />
                            </Suspense>
                        </div>
                    </div>
                </section>

                {/* Workflow Section (Alur Kerja) */}
                <section id="alur" className="border-t border-[var(--border)] bg-muted/15 py-20 md:py-24">
                    <div className="mx-auto max-w-6xl px-4 md:px-6">
                        <div className="max-w-2xl">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                                Alur Kolaborasi
                            </span>
                            <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                                3 Pilar Pengendalian Demam Berdarah
                            </h2>
                            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                                Setiap entitas memiliki peran spesifik dengan batas waktu respons (SLA) yang ketat untuk mencegah eskalasi kejadian luar biasa.
                            </p>
                        </div>

                        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
                            {STEPS.map((s) => (
                                <div
                                    key={s.num}
                                    className="rounded-[1.75rem] border border-[var(--border)] bg-muted/20 p-2 shadow-xs transition-all hover:shadow-md"
                                >
                                    <div className="flex h-full flex-col justify-between rounded-[calc(1.75rem-0.5rem)] border border-[var(--border)] bg-[var(--surface)] p-6">
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono text-2xl font-bold text-teal-600 dark:text-teal-400">
                                                    {s.num}
                                                </span>
                                                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                                                    {s.role}
                                                </span>
                                            </div>
                                            <h3 className="mt-4 text-lg font-bold text-foreground">
                                                {s.title}
                                            </h3>
                                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                                                {s.desc}
                                            </p>
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-[var(--border)] flex items-center gap-1.5 text-[11px] font-medium text-teal-600 dark:text-teal-400">
                                            <CheckCircle2 className="size-3.5" />
                                            Alur Terstandarisasi
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Bento Grid Feature Matrix */}
                <BentoFeatures />

                {/* Prevention 3M Plus & Emergency Contacts */}
                <PreventionSection />
            </main>

            {/* High-End Minimalist Footer */}
            <footer className="border-t border-[var(--border)] bg-[var(--surface)] py-10 text-xs text-muted-foreground">
                <div className="mx-auto max-w-6xl px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <span className="grid size-7 place-items-center rounded-lg bg-teal-600 text-white font-bold text-xs">
                            W
                        </span>
                        <div>
                            <p className="font-semibold text-foreground">
                                WALI-EPI Surveillance Platform
                            </p>
                            <p className="text-[11px]">
                                Dinas Kesehatan Kota Bandung
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                        <Link href="/masuk" className="hover:text-foreground transition-colors">
                            Portal Masuk
                        </Link>
                        <Link href="/daftar" className="hover:text-foreground transition-colors">
                            Registrasi Instansi
                        </Link>
                        <a href="#edukasi" className="hover:text-foreground transition-colors">
                            Panduan 3M+
                        </a>
                        <a href="#kontak" className="hover:text-foreground transition-colors">
                            Kontak Darurat
                        </a>
                    </div>

                    <p className="text-[11px]">
                        © 2026 Pemerintah Kota Bandung. Hak Cipta Dilindungi.
                    </p>
                </div>
            </footer>
        </div>
    );
}
