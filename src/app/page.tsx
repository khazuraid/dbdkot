import { Suspense } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import {
    Activity,
    ArrowRight,
    Building2,
    ClipboardCheck,
    FileText,
    ShieldCheck,
    Timer,
} from 'lucide-react';
import { getPublicSurveillanceSummary } from '@/lib/domain/reports';
import { formatNumber } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

async function PublicStatsStrip() {
    await connection();
    const summary = await getPublicSurveillanceSummary();

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-[12px] font-medium text-muted-foreground">
                    Laporan Bulan Ini
                </p>
                <p
                    data-numeric
                    className="mt-1 font-mono text-[26px] font-semibold tracking-tight text-foreground"
                >
                    {formatNumber(summary.totalThisMonth)}
                </p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-[12px] font-medium text-muted-foreground">
                    PE Diselesaikan
                </p>
                <p
                    data-numeric
                    className="mt-1 font-mono text-[26px] font-semibold tracking-tight text-foreground"
                >
                    {formatNumber(summary.peCompleted)}
                </p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-[12px] font-medium text-muted-foreground">
                    Fokus Penanggulangan
                </p>
                <p
                    data-numeric
                    className="mt-1 font-mono text-[26px] font-semibold tracking-tight text-[var(--warning)]"
                >
                    {formatNumber(summary.foggingActive)}
                </p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-[12px] font-medium text-muted-foreground">
                    Kasus Tuntas
                </p>
                <p
                    data-numeric
                    className="mt-1 font-mono text-[26px] font-semibold tracking-tight text-[var(--positive)]"
                >
                    {formatNumber(summary.closedCases)}
                </p>
            </div>
        </div>
    );
}

async function KecamatanLeaderboard() {
    await connection();
    const summary = await getPublicSurveillanceSummary();

    if (summary.topKecamatan.length === 0) {
        return (
            <p className="text-[13px] text-muted-foreground">
                Belum ada ringkasan sebaran wilayah pada periode aktif.
            </p>
        );
    }

    const max = Math.max(...summary.topKecamatan.map((r) => r.count), 1);

    return (
        <ul className="flex flex-col gap-3">
            {summary.topKecamatan.map((item) => (
                <li key={item.kecamatan} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[13px]">
                        <span className="font-medium text-foreground">
                            Kec. {item.kecamatan}
                        </span>
                        <span
                            data-numeric
                            className="font-mono text-[12px] text-muted-foreground"
                        >
                            {formatNumber(item.count)} kasus
                        </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--raised)]">
                        <div
                            className="h-full rounded-full bg-[var(--accent)]"
                            style={{
                                width: `${Math.max(8, (item.count / max) * 100)}%`,
                            }}
                        />
                    </div>
                </li>
            ))}
        </ul>
    );
}

export default function PublicLandingPage() {
    return (
        <div className="flex min-h-dvh flex-col bg-[var(--ground)] text-foreground">
            <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/92 backdrop-blur-md">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
                    <Link href="/" className="flex items-center gap-2.5">
                        <span
                            aria-hidden
                            className="grid size-8 place-items-center rounded-[8px] bg-[var(--accent)] text-[var(--accent-ink)]"
                        >
                            <Activity className="size-4" strokeWidth={2.2} />
                        </span>
                        <span>
                            <span className="block text-[14px] leading-tight font-semibold tracking-tight">
                                WALI-EPI
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                                Jejaring Surveilans DBD
                            </span>
                        </span>
                    </Link>

                    <div className="flex items-center gap-2">
                        <Button asChild variant="ghost" size="sm">
                            <Link href="/daftar">Daftar faskes</Link>
                        </Button>
                        <Button asChild size="sm">
                            <Link href="/masuk">Masuk sistem</Link>
                        </Button>
                    </div>
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-10 sm:px-6 md:py-14">
                <section className="grid items-start gap-8 lg:grid-cols-12">
                    <div className="flex flex-col gap-5 lg:col-span-7">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[12px] font-medium text-muted-foreground">
                            <ShieldCheck className="size-3.5 text-[var(--accent)]" />
                            <span>
                                Standar Penyelidikan Epidemiologi Kemenkes RI
                            </span>
                        </div>
                        <h1 className="text-[32px] leading-[1.12] font-semibold tracking-[-0.03em] text-foreground sm:text-[42px]">
                            Koordinasi pelaporan DBD, PE 100 meter, dan fogging
                            fokus dalam satu jalur terpadu.
                        </h1>
                        <p className="max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
                            Menghubungkan Rumah Sakit, Puskesmas, dan Dinas
                            Kesehatan dengan SLA penugasan 24 jam, kalkulator
                            entomologi otomatis (ABJ, HI, CI, BI), serta
                            pengawasan siklus fogging H+0 dan H+7.
                        </p>
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                            <Button asChild size="lg">
                                <Link href="/masuk">
                                    Masuk petugas faskes
                                    <ArrowRight data-icon="inline-end" />
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="lg">
                                <Link href="/daftar">
                                    Ajukan registrasi instansi
                                </Link>
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--elev-soft)] lg:col-span-5">
                        <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
                            <div>
                                <h2 className="text-[14px] font-semibold text-foreground">
                                    Sebaran Agregat Non-PII
                                </h2>
                                <p className="text-[12px] text-muted-foreground">
                                    Data publik tanpa identitas pasien
                                </p>
                            </div>
                            <span className="rounded-full border border-[var(--pill-positive-border)] bg-[var(--pill-positive-bg)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--pill-positive-ink)]">
                                Live
                            </span>
                        </div>
                        <div className="pt-4">
                            <Suspense
                                fallback={
                                    <div className="flex flex-col gap-3">
                                        <Skeleton className="h-8 w-full" />
                                        <Skeleton className="h-8 w-4/5" />
                                        <Skeleton className="h-8 w-3/5" />
                                    </div>
                                }
                            >
                                <KecamatanLeaderboard />
                            </Suspense>
                        </div>
                    </div>
                </section>

                <section aria-label="Ringkasan surveilans publik">
                    <Suspense
                        fallback={
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <Skeleton className="h-24 rounded-[var(--radius-card)]" />
                                <Skeleton className="h-24 rounded-[var(--radius-card)]" />
                                <Skeleton className="h-24 rounded-[var(--radius-card)]" />
                                <Skeleton className="h-24 rounded-[var(--radius-card)]" />
                            </div>
                        }
                    >
                        <PublicStatsStrip />
                    </Suspense>
                </section>

                <section className="grid gap-4 md:grid-cols-3">
                    <article className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
                        <div className="flex items-center gap-2.5 text-[var(--accent)]">
                            <FileText className="size-4" />
                            <h3 className="text-[14px] font-semibold text-foreground">
                                1. Pelaporan Faskes & Enkripsi PII
                            </h3>
                        </div>
                        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                            Rumah Sakit dan Poli Puskesmas menginput data klinis
                            serta lokasi GPS. Identitas pasien terenkripsi
                            AES-256-GCM dan otomatis terdisposisi ke Puskesmas
                            wilayah.
                        </p>
                    </article>

                    <article className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
                        <div className="flex items-center gap-2.5 text-[var(--accent)]">
                            <Timer className="size-4" />
                            <h3 className="text-[14px] font-semibold text-foreground">
                                2. Survei PE Radius 100m (SLA 72 Jam)
                            </h3>
                        </div>
                        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                            Petugas lapangan memeriksa minimal 20 rumah via
                            wizard mobile. Sistem menghitung ABJ, HI, CI, dan BI
                            secara otomatis sesuai pedoman Kemenkes.
                        </p>
                    </article>

                    <article className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
                        <div className="flex items-center gap-2.5 text-[var(--accent)]">
                            <ClipboardCheck className="size-4" />
                            <h3 className="text-[14px] font-semibold text-foreground">
                                3. Verifikasi & Penanggulangan Fokus
                            </h3>
                        </div>
                        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                            Dinas Kesehatan memverifikasi hasil PE, mencetak
                            surat resmi PDF, dan memantau pelaksanaan Fogging
                            Siklus 1 & Siklus 2 (H+7) beserta stok logistik.
                        </p>
                    </article>
                </section>
            </main>

            <footer className="border-t border-[var(--border)] bg-[var(--surface)] py-5">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-[12px] text-muted-foreground sm:px-6">
                    <span className="flex items-center gap-1.5">
                        <Building2 className="size-3.5" />
                        WALI-EPI — Sistem Informasi Surveilans DBD Lintas
                        Faskes
                    </span>
                    <span>Enkripsi PII AES-256-GCM · Audit Trail Penuh</span>
                </div>
            </footer>
        </div>
    );
}
