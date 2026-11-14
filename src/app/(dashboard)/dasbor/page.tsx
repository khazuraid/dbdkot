import Link from 'next/link';
import {
    AlertCircle,
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    Clock,
    FileText,
    Layers,
    MapPin,
    Navigation,
} from 'lucide-react';
import { requireActor } from '@/lib/session';
import { dailySeries, listReports, reportCounts } from '@/lib/domain/reports';
import { queueCounts } from '@/lib/domain/queries';
import {
    caseGeoPoints,
    facilityPoints,
    kelurahanZones,
    uncoveredKelurahan,
} from '@/lib/domain/map-data';
import { formatNumber } from '@/lib/format';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { Stat, StatRow } from '@/components/shell/stat';
import { DailySeriesChart } from '@/components/reports/daily-series-chart';
import { FacilityMapPanel } from '@/components/reports/facility-map-panel';
import { ReportTable } from '@/components/reports/report-table';
import { Pager, readPage } from '@/components/shell/pager-view';
import { cn } from '@/lib/utils';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

export default async function DasborPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const sp = await searchParams;
    const actor = await requireActor();
    const page = readPage(sp.page);

    const [
        counts,
        series,
        queues,
        points,
        zones,
        gapData,
        geoCases,
        reports,
    ] = await Promise.all([
        reportCounts(actor),
        dailySeries(actor),
        queueCounts(actor),
        facilityPoints(actor),
        kelurahanZones(actor),
        uncoveredKelurahan(actor),
        caseGeoPoints(actor),
        listReports(actor, { page, perPage: 15 }),
    ]);

    const latest = series.at(-1)?.n ?? 0;
    const gaps = gapData.rows;

    return (
        <PageBody>
            <PageHeader
                title="Pusat Komando Surveilans"
                context={
                    counts.needAction > 0
                        ? `${formatNumber(counts.needAction)} laporan menunggu tindakan verifikasi atau penyelidikan.`
                        : 'Semua laporan dalam wilayah kerja Anda telah tertangani tepat waktu.'
                }
                action={
                    actor.role === 'RUMAH_SAKIT'
                        ? { href: '/laporan/baru', label: '+ Lapor Kasus Baru' }
                        : actor.role === 'PUSKESMAS'
                          ? { href: '/pe/baru', label: '+ Buat Laporan PE' }
                          : actor.role === 'DINKES'
                            ? { href: '/pe/verifikasi', label: 'Verifikasi PE' }
                            : { href: '/laporan', label: 'Semua Laporan' }
                }
            />

            <PageContent className="space-y-6">
                {/* Hero Stat Grid */}
                <StatRow className="grid-cols-2 md:grid-cols-4 gap-3.5">
                    <Stat
                        label="Laporan Bulan Ini"
                        value={formatNumber(counts.total)}
                        hint={`Hari ini: ${formatNumber(latest)} kasus`}
                        icon={FileText}
                    />
                    <Stat
                        label="Menunggu Tindakan"
                        value={formatNumber(counts.needAction)}
                        signal={counts.needAction > 0 ? 'warn' : 'neutral'}
                        hint={
                            counts.needAction > 0
                                ? 'Prioritas verifikasi'
                                : 'Semua tertangani'
                        }
                        icon={Clock}
                    />
                    <Stat
                        label="Selesai PE"
                        value={formatNumber(counts.verifiedThisMonth)}
                        signal="good"
                        hint="Penyelidikan tuntas"
                        icon={CheckCircle2}
                    />
                    <Stat
                        label="Lewat SLA"
                        value={formatNumber(counts.slaOverdue)}
                        signal={counts.slaOverdue > 0 ? 'bad' : 'neutral'}
                        hint={
                            counts.slaOverdue > 0
                                ? 'Perlu eskalasi segera'
                                : '0 kasus terlambat'
                        }
                        icon={AlertTriangle}
                    />
                </StatRow>

                {/* Peta Sebaran & Klaster Spasial */}
                <Panel
                    padded
                    title="Peta Sebaran & Klaster Spasial"
                    subtitle="Visualisasi sebaran GPS faskes, klaster 100m, dan zonasi kelurahan"
                    aside={
                        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1 rounded bg-[var(--raised)] px-2 py-0.5 font-medium text-foreground">
                                <Navigation className="size-3 text-[var(--accent)]" aria-hidden />
                                {formatNumber(points.length)} Faskes
                            </span>
                            <span className="inline-flex items-center gap-1 rounded bg-[var(--raised)] px-2 py-0.5 font-medium text-foreground">
                                <Layers className="size-3 text-emerald-600 dark:text-emerald-400" aria-hidden />
                                {formatNumber(zones.length)} Zonasi
                            </span>
                            <span className="inline-flex items-center gap-1 rounded bg-[var(--raised)] px-2 py-0.5 font-medium text-foreground">
                                <MapPin className="size-3 text-amber-500" aria-hidden />
                                {formatNumber(geoCases.length)} Titik Kasus GPS
                            </span>
                        </div>
                    }
                >
                    {gaps.length > 0 && actor.role === 'DINKES' && (
                        <div className="mb-4 flex items-start gap-2.5 rounded-[var(--radius-control)] border border-[var(--warning)]/30 bg-[var(--pill-warning-bg)] p-3 text-[12.5px] text-[var(--warning)]">
                            <AlertCircle className="size-4 shrink-0 translate-y-0.5" aria-hidden />
                            <div>
                                <p className="font-semibold text-foreground">
                                    Terdapat {formatNumber(gaps.length)} kelurahan berpotensi tanpa pembinaan Puskesmas
                                </p>
                                <p className="text-muted-foreground">
                                    Kasus terlapor di kelurahan ini belum terpetakan ke wilayah kerja puskesmas definitif.{' '}
                                    <Link
                                        href="/admin/koreksi-wilayah"
                                        className="font-medium text-[var(--accent)] underline underline-offset-4"
                                    >
                                        Buka koreksi wilayah puskesmas →
                                    </Link>
                                </p>
                            </div>
                        </div>
                    )}

                    <FacilityMapPanel
                        points={points}
                        zones={zones}
                        cases={geoCases}
                        height={420}
                    />
                </Panel>

                {/* 2-Column Split: Tren 14 Hari & Antrian Tindakan Cepat */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
                    <Panel
                        padded
                        title="Tren Laporan 14 Hari"
                        subtitle="Volume kasus baru per hari dalam rentang 14 hari terakhir"
                        aside={
                            <Link
                                href="/laporan/analitik"
                                className="text-[12.5px] font-medium text-[var(--accent)] hover:underline"
                            >
                                Analitik lengkap →
                            </Link>
                        }
                    >
                        <DailySeriesChart data={series} />
                    </Panel>

                    <Panel
                        padded
                        title="Antrian Tindakan Cepat"
                        subtitle="Prioritas tugas dan penanganan alur kerja saat ini"
                    >
                        <div className="divide-y divide-[var(--rule)]">
                            {counts.needAction > 0 && (
                                <ActionItem
                                    href="/laporan/perlu-action"
                                    title="Laporan Menunggu Tindakan"
                                    detail={`${formatNumber(counts.needAction)} kasus menanti respon`}
                                    badge="Prioritas"
                                    badgeTone="warn"
                                    count={counts.needAction}
                                />
                            )}
                            {counts.slaOverdue > 0 && (
                                <ActionItem
                                    href="/laporan/perlu-action"
                                    title="Laporan Lewat Batas SLA"
                                    detail={`${formatNumber(counts.slaOverdue)} kasus melewati target`}
                                    badge="Kritis"
                                    badgeTone="bad"
                                    count={counts.slaOverdue}
                                    urgent
                                />
                            )}
                            {queues.submitted > 0 && actor.role === 'DINKES' && (
                                <ActionItem
                                    href="/laporan?status=SUBMITTED"
                                    title="Laporan Baru Masuk dari RS"
                                    detail={`${formatNumber(queues.submitted)} kasus perlu penugasan`}
                                    badge="Baru"
                                    badgeTone="info"
                                    count={queues.submitted}
                                />
                            )}
                            {queues.assigned > 0 && actor.role === 'PUSKESMAS' && (
                                <ActionItem
                                    href="/pe/tugas"
                                    title="Penugasan PE dari Dinkes"
                                    detail={`${formatNumber(queues.assigned)} kasus ditugaskan`}
                                    badge="Tugas Baru"
                                    badgeTone="info"
                                    count={queues.assigned}
                                />
                            )}
                            {queues.peCompleted > 0 && actor.role === 'DINKES' && (
                                <ActionItem
                                    href="/pe/verifikasi"
                                    title="Verifikasi Hasil PE Lapangan"
                                    detail={`${formatNumber(queues.peCompleted)} berkas PE menunggu`}
                                    badge="Verifikasi"
                                    badgeTone="warn"
                                    count={queues.peCompleted}
                                />
                            )}
                            {queues.crossBorderPending > 0 && actor.role === 'DINKES' && (
                                <ActionItem
                                    href="/laporan/lintas-wilayah"
                                    title="Kasus Pasien Luar Wilayah"
                                    detail={`${formatNumber(queues.crossBorderPending)} domisili luar daerah`}
                                    badge="Wilayah"
                                    badgeTone="neutral"
                                    count={queues.crossBorderPending}
                                />
                            )}
                            {actor.role === 'RUMAH_SAKIT' && (
                                <ActionItem
                                    href="/laporan/baru"
                                    title="Input Laporan Pasien DBD"
                                    detail="Entri formulir KDRS baru"
                                    badge="Lapor"
                                    badgeTone="neutral"
                                />
                            )}
                            {actor.role === 'ADMIN' && (
                                <>
                                    <ActionItem
                                        href="/admin/pengguna"
                                        title="Manajemen Pengguna & Faskes"
                                        detail="Kelola akun dan otorisasi"
                                        badge="Admin"
                                        badgeTone="neutral"
                                    />
                                    <ActionItem
                                        href="/admin/koreksi-wilayah"
                                        title="Koreksi Wilayah Puskesmas"
                                        detail="Perbaiki penugasan tertahan"
                                        badge="Koreksi"
                                        badgeTone="neutral"
                                    />
                                </>
                            )}
                            <ActionItem
                                href="/laporan"
                                title="Lihat Rekam Jejak Kasus"
                                detail="Daftar lengkap seluruh laporan"
                                badge="Arsip"
                                badgeTone="neutral"
                            />
                        </div>
                    </Panel>
                </div>

                {/* Monitoring Alur Laporan (Pipa Kasus Real-Time) */}
                <div id="monitoring">
                    <Panel
                        title="Monitoring Alur Laporan"
                        subtitle={`${formatNumber(reports.total)} laporan aktif lintas fasilitas pelayanan kesehatan`}
                        aside={
                            <Link
                                href="/laporan"
                                className="text-[12.5px] font-medium text-[var(--accent)] hover:underline"
                            >
                                Semua Laporan →
                            </Link>
                        }
                    >
                        <ReportTable rows={reports.rows} empty="Belum ada laporan aktif." />
                        <Pager
                            info={{ page: reports.page, perPage: reports.perPage, total: reports.total }}
                            label="laporan"
                            buildHref={(n) => (n > 1 ? `/dasbor?page=${n}#monitoring` : '/dasbor#monitoring')}
                        />
                    </Panel>
                </div>
            </PageContent>
        </PageBody>
    );
}

function ActionItem({
    href,
    title,
    detail,
    badge,
    badgeTone = 'neutral',
    count,
    urgent = false,
}: {
    href: string;
    title: string;
    detail: string;
    badge?: string;
    badgeTone?: 'neutral' | 'info' | 'good' | 'warn' | 'bad';
    count?: number;
    urgent?: boolean;
}) {
    const toneStyle =
        badgeTone === 'bad'
            ? 'bg-[var(--pill-negative-bg)] text-[var(--negative)] border-[var(--pill-negative-border)]'
            : badgeTone === 'warn'
              ? 'bg-[var(--pill-warning-bg)] text-[var(--warning)] border-[var(--pill-warning-border)]'
              : badgeTone === 'good'
                ? 'bg-[var(--pill-positive-bg)] text-[var(--positive)] border-[var(--pill-positive-border)]'
                : badgeTone === 'info'
                  ? 'bg-[var(--pill-info-bg)] text-[var(--info)] border-[var(--pill-info-border)]'
                  : 'bg-[var(--raised)] text-muted-foreground border-[var(--border)]';

    return (
        <Link
            href={href}
            className={cn(
                'group flex items-center justify-between gap-3 py-3 transition-colors hover:bg-[var(--raised)]/40 -mx-4 px-4 sm:-mx-6 sm:px-6',
                urgent && 'bg-[var(--pill-negative-bg)]/25',
            )}
        >
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-medium text-foreground group-hover:text-[var(--accent)]">
                        {title}
                    </p>
                    {badge && (
                        <span
                            className={cn(
                                'inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-semibold border',
                                toneStyle,
                            )}
                        >
                            {badge}
                        </span>
                    )}
                    {count !== undefined && count > 0 && (
                        <span
                            data-numeric
                            className="inline-flex items-center rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-foreground tabular-nums shadow-2xs"
                        >
                            {formatNumber(count)}
                        </span>
                    )}
                </div>
                <p className="text-[12px] text-muted-foreground">{detail}</p>
            </div>
            <ArrowRight
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                aria-hidden
            />
        </Link>
    );
}
