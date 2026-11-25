import Link from 'next/link';
import { AlertCircle, ArrowRight } from 'lucide-react';
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

    const [counts, series, queues, points, zones, gapData, geoCases, reports] =
        await Promise.all([
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
    const periodLabel = new Intl.DateTimeFormat('id-ID', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
    }).format(new Date());

    return (
        <PageBody>
            <PageHeader
                title={`Surveilans DBD · ${periodLabel}`}
                context={
                    counts.needAction > 0
                        ? `${formatNumber(counts.needAction)} laporan menunggu tindakan verifikasi atau penyelidikan`
                        : 'Semua laporan dalam wilayah kerja Anda telah tertangani tepat waktu'
                }
                action={
                    actor.role === 'RUMAH_SAKIT'
                        ? { href: '/laporan/baru', label: 'Lapor kasus baru' }
                        : actor.role === 'PUSKESMAS'
                          ? { href: '/pe/baru', label: 'Buat laporan PE' }
                          : actor.role === 'DINKES'
                            ? { href: '/pe/verifikasi', label: 'Verifikasi PE' }
                            : { href: '/laporan', label: 'Semua laporan' }
                }
            />

            <PageContent className="space-y-6">
                {/* KPI Stat Grid */}
                <StatRow className="grid-cols-2 gap-4 md:grid-cols-4">
                    <Stat
                        label="Laporan bulan ini"
                        value={formatNumber(counts.total)}
                        hint={`Hari ini: ${formatNumber(latest)} kasus`}
                    />
                    <Stat
                        label="Menunggu tindakan"
                        value={formatNumber(counts.needAction)}
                        signal={counts.needAction > 0 ? 'warn' : 'neutral'}
                        hint={
                            counts.needAction > 0
                                ? 'Prioritas verifikasi'
                                : 'Semua tertangani'
                        }
                    />
                    <Stat
                        label="Selesai PE"
                        value={formatNumber(counts.verifiedThisMonth)}
                        signal="good"
                        hint="Penyelidikan tuntas"
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
                    />
                </StatRow>

                {/* Peta Sebaran & Klaster Spasial */}
                <Panel
                    padded
                    title="Peta sebaran dan klaster spasial"
                    subtitle="Visualisasi sebaran GPS faskes, klaster 100 m, dan zonasi kelurahan"
                    aside={
                        <div className="flex flex-wrap items-center gap-3 font-mono text-[12px] text-muted-foreground tabular-nums">
                            <span>{formatNumber(points.length)} faskes</span>
                            <span aria-hidden className="text-[var(--border)]">
                                ·
                            </span>
                            <span>{formatNumber(zones.length)} zonasi</span>
                            <span aria-hidden className="text-[var(--border)]">
                                ·
                            </span>
                            <span className="text-foreground">
                                {formatNumber(geoCases.length)} titik kasus
                            </span>
                        </div>
                    }
                >
                    {gaps.length > 0 && actor.role === 'DINKES' && (
                        <div className="mb-4 flex items-start gap-3 rounded-[var(--radius-control)] border border-l-2 border-[var(--border)] border-l-[var(--warning)] bg-[var(--ground)] p-3 text-[13px]">
                            <AlertCircle
                                className="mt-0.5 size-4 shrink-0 text-[var(--warning)]"
                                strokeWidth={1.5}
                                aria-hidden
                            />
                            <div>
                                <p className="font-medium text-foreground">
                                    Terdapat {formatNumber(gaps.length)}{' '}
                                    kelurahan berpotensi tanpa pembinaan
                                    Puskesmas
                                </p>
                                <p className="mt-0.5 text-[12px] text-muted-foreground">
                                    Kasus terlapor di kelurahan ini belum
                                    terpetakan ke wilayah kerja puskesmas
                                    definitif.{' '}
                                    <Link
                                        href="/admin/koreksi-wilayah"
                                        className="font-medium text-[var(--accent)] underline underline-offset-4"
                                    >
                                        Buka koreksi wilayah puskesmas
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
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
                    <Panel
                        padded
                        title="Tren laporan 14 hari"
                        subtitle="Volume kasus baru per hari dalam rentang 14 hari terakhir"
                        aside={
                            <Link
                                href="/laporan/analitik"
                                className="text-[13px] font-medium text-[var(--accent)] hover:underline"
                            >
                                Analitik lengkap
                            </Link>
                        }
                    >
                        <DailySeriesChart data={series} />
                    </Panel>

                    <Panel
                        title="Antrian tindakan cepat"
                        subtitle="Prioritas tugas dan penanganan alur kerja saat ini"
                    >
                        <ul className="divide-y divide-[var(--rule)]">
                            {counts.needAction > 0 && (
                                <ActionItem
                                    href="/laporan/perlu-action"
                                    title="Laporan menunggu tindakan"
                                    detail={`${formatNumber(counts.needAction)} kasus menanti respon`}
                                    tone="warn"
                                    count={counts.needAction}
                                />
                            )}
                            {counts.slaOverdue > 0 && (
                                <ActionItem
                                    href="/laporan/perlu-action"
                                    title="Laporan lewat batas SLA"
                                    detail={`${formatNumber(counts.slaOverdue)} kasus melewati target`}
                                    tone="bad"
                                    count={counts.slaOverdue}
                                    urgent
                                />
                            )}
                            {queues.submitted > 0 &&
                                actor.role === 'DINKES' && (
                                    <ActionItem
                                        href="/laporan?status=SUBMITTED"
                                        title="Laporan baru masuk dari RS"
                                        detail={`${formatNumber(queues.submitted)} kasus perlu penugasan`}
                                        tone="info"
                                        count={queues.submitted}
                                    />
                                )}
                            {queues.assigned > 0 &&
                                actor.role === 'PUSKESMAS' && (
                                    <ActionItem
                                        href="/pe/tugas"
                                        title="Penugasan PE dari Dinkes"
                                        detail={`${formatNumber(queues.assigned)} kasus ditugaskan`}
                                        tone="info"
                                        count={queues.assigned}
                                    />
                                )}
                            {queues.peCompleted > 0 &&
                                actor.role === 'DINKES' && (
                                    <ActionItem
                                        href="/pe/verifikasi"
                                        title="Verifikasi hasil PE lapangan"
                                        detail={`${formatNumber(queues.peCompleted)} berkas PE menunggu`}
                                        tone="warn"
                                        count={queues.peCompleted}
                                    />
                                )}
                            {queues.crossBorderPending > 0 &&
                                actor.role === 'DINKES' && (
                                    <ActionItem
                                        href="/laporan/lintas-wilayah"
                                        title="Kasus pasien luar wilayah"
                                        detail={`${formatNumber(queues.crossBorderPending)} domisili luar daerah`}
                                        tone="neutral"
                                        count={queues.crossBorderPending}
                                    />
                                )}
                            {actor.role === 'RUMAH_SAKIT' && (
                                <ActionItem
                                    href="/laporan/baru"
                                    title="Input laporan pasien DBD"
                                    detail="Entri formulir KDRS baru"
                                    tone="neutral"
                                />
                            )}
                            {actor.role === 'ADMIN' && (
                                <>
                                    <ActionItem
                                        href="/admin/pengguna"
                                        title="Manajemen pengguna dan faskes"
                                        detail="Kelola akun dan otorisasi"
                                        tone="neutral"
                                    />
                                    <ActionItem
                                        href="/admin/koreksi-wilayah"
                                        title="Koreksi wilayah puskesmas"
                                        detail="Perbaiki penugasan tertahan"
                                        tone="neutral"
                                    />
                                </>
                            )}
                            <ActionItem
                                href="/laporan"
                                title="Lihat rekam jejak kasus"
                                detail="Daftar lengkap seluruh laporan"
                                tone="neutral"
                            />
                        </ul>
                    </Panel>
                </div>

                {/* Monitoring Alur Laporan (Pipa Kasus Real-Time) */}
                <div id="monitoring">
                    <Panel
                        title="Monitoring alur laporan"
                        subtitle={`${formatNumber(reports.total)} laporan aktif lintas fasilitas pelayanan kesehatan`}
                        aside={
                            <Link
                                href="/laporan"
                                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--accent)] hover:underline"
                            >
                                <span>Semua laporan</span>
                                <ArrowRight
                                    className="size-4"
                                    strokeWidth={1.5}
                                    aria-hidden
                                />
                            </Link>
                        }
                    >
                        <ReportTable
                            rows={reports.rows}
                            empty="Belum ada laporan aktif"
                            showStatusTabs
                        />
                        <Pager
                            info={{
                                page: reports.page,
                                perPage: reports.perPage,
                                total: reports.total,
                            }}
                            label="laporan"
                            buildHref={(n) =>
                                n > 1
                                    ? `/dasbor?page=${n}#monitoring`
                                    : '/dasbor#monitoring'
                            }
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
    tone = 'neutral',
    count,
    urgent = false,
}: {
    href: string;
    title: string;
    detail: string;
    tone?: 'neutral' | 'info' | 'good' | 'warn' | 'bad';
    count?: number;
    urgent?: boolean;
}) {
    const dotClass =
        tone === 'bad'
            ? 'bg-[var(--negative)]'
            : tone === 'warn'
              ? 'bg-[var(--warning)]'
              : tone === 'good'
                ? 'bg-[var(--positive)]'
                : tone === 'info'
                  ? 'bg-[var(--accent)]'
                  : 'bg-muted-foreground/40';

    const countTone =
        tone === 'bad'
            ? 'text-[var(--negative)]'
            : tone === 'warn'
              ? 'text-[var(--warning)]'
              : tone === 'info'
                ? 'text-[var(--accent)]'
                : 'text-foreground';

    return (
        <li>
            <Link
                href={href}
                className={cn(
                    'action-row-press group flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--raised)]/60',
                    urgent && 'border-l-2 border-l-[var(--negative)]',
                )}
            >
                <div className="flex min-w-0 items-start gap-3">
                    <span
                        aria-hidden
                        className={cn(
                            'mt-2 size-1.5 shrink-0 rounded-full',
                            dotClass,
                        )}
                    />
                    <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-foreground transition-colors duration-150 group-hover:text-[var(--accent)]">
                            {title}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                            {detail}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    {count !== undefined && count > 0 && (
                        <span
                            data-numeric
                            className={cn(
                                'font-mono text-[14px] font-medium tabular-nums',
                                countTone,
                            )}
                        >
                            {formatNumber(count)}
                        </span>
                    )}
                    <ArrowRight
                        className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
                        strokeWidth={1.5}
                        aria-hidden
                    />
                </div>
            </Link>
        </li>
    );
}
