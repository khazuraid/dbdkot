'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import {
    AlertCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    FileSpreadsheet,
    Flame,
    LayoutPanelLeft,
    Map as MapIcon,
    Plus,
    Radar,
    Search,
    ShieldAlert,
    Stethoscope,
    X,
} from 'lucide-react';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable';
import { SpringSheet } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusText } from '@/components/shell/status-text';
import { SlaCountdown } from '@/components/reports/sla-countdown';
import { ReportDossierContent } from '@/components/reports/report-split-view';
import { ReportTable } from '@/components/reports/report-table';
import { FacilityMapPanel } from '@/components/reports/facility-map-panel';
import { DailySeriesChart } from '@/components/reports/daily-series-chart';
import {
    CASE_TYPE_LABEL,
    STATUS_LABEL,
    STATUS_TONE,
    type ReportListRow,
    type ReportStatus,
} from '@/lib/domain/report-labels';
import type { ReportDetail } from '@/lib/domain/report-detail';
import type {
    CaseGeoPoint,
    FacilityPoint,
    KelurahanZone,
} from '@/lib/domain/map-data';
import type { Role } from '@/lib/roles';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export type DasborView = 'workspace' | 'map';
export type DasborQueue =
    'all' | 'overdue' | 'kdrs' | 'pe' | 'fogging' | 'cluster';

export type DasborWorkspaceProps = {
    role: Role;
    periodLabel: string;
    view: DasborView;
    queue: DasborQueue;
    searchQuery: string;
    counts: {
        total: number;
        needAction: number;
        verifiedThisMonth: number;
        slaOverdue: number;
    };
    queues: {
        submitted: number;
        assigned: number;
        peActive: number;
        peCompleted: number;
        crossBorderPending: number;
        foggingRequired: number;
        clusteredActive: number;
    };
    reports: {
        rows: ReportListRow[];
        total: number;
        page: number;
        perPage: number;
    };
    selectedDetail: ReportDetail | null;
    series: { day: string; n: number }[];
    uncoveredCount: number;
    mapData: {
        points: FacilityPoint[];
        zones: KelurahanZone[];
        cases: CaseGeoPoint[];
    } | null;
};

type SlaUrgency = 'overdue' | 'warn' | 'ok' | 'none';

function getRowSlaUrgency(row: ReportListRow, nowMs: number): SlaUrgency {
    let deadlineMs: number | null = null;
    if (row.status === 'ASSIGNED') {
        deadlineMs =
            new Date(row.assignedAt ?? row.createdAt).getTime() +
            24 * 3_600_000;
    } else if (
        row.status === 'ASSIGNED_ACCEPTED' ||
        row.status === 'PE_IN_PROGRESS'
    ) {
        deadlineMs =
            new Date(row.acceptedAt ?? row.createdAt).getTime() +
            72 * 3_600_000;
    }
    if (!deadlineMs) return 'none';
    const diff = deadlineMs - nowMs;
    if (diff < 0) return 'overdue';
    if (diff < 6 * 3_600_000) return 'warn';
    return 'ok';
}

const SLA_RIBBON: Record<SlaUrgency, string> = {
    overdue: 'border-l-2 border-l-[var(--negative)]',
    warn: 'border-l-2 border-l-[var(--warning)]',
    ok: 'border-l-2 border-l-[var(--accent)]',
    none: 'border-l-2 border-l-transparent',
};

const QUEUE_LABEL: Record<DasborQueue, string> = {
    all: 'Semua kasus',
    overdue: 'Lewat batas SLA',
    kdrs: 'Perlu tindakan / KDRS <24j',
    pe: 'PE 72 jam',
    fogging: 'Fogging 2 siklus',
    cluster: 'Klaster 100 m',
};

function primaryCtaForRole(role: Role): { href: string; label: string } {
    if (role === 'RUMAH_SAKIT')
        return { href: '/laporan/baru', label: 'Input KDRS' };
    if (role === 'PUSKESMAS') return { href: '/pe/tugas', label: 'Antrean PE' };
    if (role === 'DINKES')
        return { href: '/pe/verifikasi', label: 'Verifikasi PE' };
    return { href: '/admin/pengguna', label: 'Kelola Pengguna' };
}

function isSlaActiveStatus(status: ReportStatus): boolean {
    return (
        status === 'ASSIGNED' ||
        status === 'ASSIGNED_ACCEPTED' ||
        status === 'PE_IN_PROGRESS'
    );
}

export function DasborWorkspace({
    role,
    periodLabel,
    view,
    queue,
    searchQuery,
    counts,
    queues,
    reports,
    selectedDetail,
    series,
    uncoveredCount,
    mapData,
}: DasborWorkspaceProps) {
    const [isPending, startTransition] = useTransition();
    const [draftSearch, setDraftSearch] = useState(searchQuery);
    const [nowMs] = useState(() => Date.now());
    const [filters, setFilters] = useQueryStates(
        {
            view: parseAsString.withDefault('workspace'),
            queue: parseAsString.withDefault('all'),
            q: parseAsString.withDefault(''),
            selected: parseAsString.withDefault(''),
            page: parseAsInteger.withDefault(1),
        },
        {
            shallow: false,
            history: 'replace',
        },
    );

    const isRs = role === 'RUMAH_SAKIT';
    const activeView: DasborView =
        !isRs && (filters.view === 'map' || view === 'map')
            ? 'map'
            : 'workspace';
    const activeQueue = (filters.queue || queue || 'all') as DasborQueue;
    const selectedId = filters.selected || selectedDetail?.id || '';
    const cta = primaryCtaForRole(role);
    const totalPages = Math.max(1, Math.ceil(reports.total / reports.perPage));

    function updateQuery(
        patch: Partial<{
            view: string;
            queue: string;
            q: string;
            selected: string;
            page: number;
        }>,
    ) {
        startTransition(() => {
            void setFilters(patch);
        });
    }

    function toggleQueue(target: DasborQueue) {
        const next = activeQueue === target ? 'all' : target;
        updateQuery({ queue: next, page: 1 });
    }

    function selectReport(id: string) {
        updateQuery({ selected: id === selectedId ? '' : id });
    }

    function clearSelection() {
        updateQuery({ selected: '' });
    }

    function handleSearchSubmit(e: React.FormEvent) {
        e.preventDefault();
        updateQuery({ q: draftSearch.trim(), page: 1 });
    }

    const kpiItems: Array<{
        key: DasborQueue;
        label: string;
        value: number;
        meta: string;
        icon: typeof ShieldAlert;
        accentTone?: 'negative' | 'warning' | 'accent';
    }> = [
        {
            key: 'kdrs',
            label: 'Perlu Tindakan / KDRS <24j',
            value: counts.needAction,
            meta:
                counts.slaOverdue > 0
                    ? `${formatNumber(counts.slaOverdue)} lewat SLA`
                    : `${formatNumber(queues.assigned)} tunggu Puskesmas`,
            icon: ShieldAlert,
            accentTone: counts.slaOverdue > 0 ? 'negative' : 'accent',
        },
        {
            key: 'pe',
            label: 'PE 72 Jam',
            value: queues.peActive + queues.peCompleted,
            meta: `${formatNumber(queues.peActive)} aktif · ${formatNumber(queues.peCompleted)} tunggu verifikasi`,
            icon: Stethoscope,
            accentTone: 'accent',
        },
        {
            key: 'fogging',
            label: 'Fogging 2 Siklus',
            value: queues.foggingRequired,
            meta: 'Wajib & siklus 1–2 berjalan',
            icon: Flame,
            accentTone: queues.foggingRequired > 0 ? 'warning' : 'accent',
        },
        {
            key: 'cluster',
            label: 'Klaster 100 m',
            value: queues.clusteredActive,
            meta: 'Kasus aktif dalam radius fokus',
            icon: Radar,
            accentTone: queues.clusteredActive > 0 ? 'negative' : 'accent',
        },
    ];

    const queueListContent = (
        <div className="flex h-full flex-col bg-[var(--surface)]">
            <div className="space-y-2 border-b border-[var(--border)] p-3">
                <form
                    onSubmit={handleSearchSubmit}
                    className="flex items-center gap-2"
                >
                    <div className="relative min-w-0 flex-1">
                        <Search
                            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                            strokeWidth={1.5}
                            aria-hidden
                        />
                        <Input
                            value={draftSearch}
                            onChange={(e) => setDraftSearch(e.target.value)}
                            placeholder="Cari no. laporan atau kelurahan..."
                            aria-label="Cari nomor laporan atau kelurahan"
                            className="h-9 pl-8 text-[13px]"
                        />
                    </div>
                    {filters.q ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setDraftSearch('');
                                updateQuery({ q: '', page: 1 });
                            }}
                            className="h-9 px-2 text-[12px]"
                        >
                            Reset
                        </Button>
                    ) : null}
                </form>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                    <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">
                            {QUEUE_LABEL[activeQueue]}
                        </span>
                        <span className="font-mono text-muted-foreground tabular-nums">
                            ({formatNumber(reports.total)})
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {counts.slaOverdue > 0 ? (
                            <button
                                type="button"
                                aria-pressed={activeQueue === 'overdue'}
                                onClick={() => toggleQueue('overdue')}
                                className={cn(
                                    'inline-flex h-6 cursor-pointer items-center gap-1 rounded-[6px] border px-2 font-mono text-[11px] font-medium tabular-nums transition-[background-color,color,border-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97]',
                                    activeQueue === 'overdue'
                                        ? 'border-[var(--negative)] bg-[var(--negative)] text-white'
                                        : 'border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)]',
                                )}
                            >
                                Lewat SLA: {formatNumber(counts.slaOverdue)}
                            </button>
                        ) : null}
                        {activeQueue !== 'all' ? (
                            <button
                                type="button"
                                onClick={() =>
                                    updateQuery({ queue: 'all', page: 1 })
                                }
                                className="cursor-pointer text-[12px] text-[var(--accent)] hover:underline"
                            >
                                Tampilkan semua
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            <div
                className={cn(
                    'min-h-0 flex-1 divide-y divide-[var(--rule)] overflow-y-auto transition-[opacity,filter] duration-150 ease-out lg:overscroll-contain',
                    isPending ? 'opacity-70 blur-[1px]' : 'blur-0 opacity-100',
                )}
            >
                {reports.rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                        <p className="text-[13px] font-medium text-foreground">
                            Tidak ada kasus pada antrean ini
                        </p>
                        <p className="mt-1 text-[12px] text-muted-foreground">
                            Ubah filter antrean atau kata kunci pencarian.
                        </p>
                    </div>
                ) : (
                    reports.rows.map((row) => {
                        const isSelected = selectedId === row.id;
                        const urgency = getRowSlaUrgency(row, nowMs);
                        return (
                            <button
                                key={row.id}
                                type="button"
                                onClick={() => selectReport(row.id)}
                                aria-pressed={isSelected}
                                className={cn(
                                    'group relative flex w-full cursor-pointer flex-col gap-1.5 px-3 py-3 text-left transition-[background-color,transform] duration-120 ease-[var(--ease-out)] active:scale-[0.992]',
                                    SLA_RIBBON[urgency],
                                    isSelected
                                        ? 'bg-[var(--active)]'
                                        : 'hover:bg-[var(--raised)]',
                                )}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className="truncate font-mono text-[13px] font-medium text-foreground tabular-nums">
                                            {row.reportNumber}
                                        </span>
                                        <span className="shrink-0 rounded-[4px] border border-[var(--border)] bg-[var(--ground)] px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
                                            {CASE_TYPE_LABEL[row.caseType] ??
                                                row.caseType}
                                        </span>
                                        {row.clusterId ? (
                                            <span className="inline-flex shrink-0 items-center gap-1 rounded-[4px] bg-[var(--pill-negative-bg)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--pill-negative-ink)]">
                                                100m
                                            </span>
                                        ) : null}
                                    </div>
                                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                                        {formatDate(row.createdAt)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate text-[12px] text-muted-foreground">
                                        {row.kelurahan
                                            ? `Kel. ${row.kelurahan}`
                                            : 'Kelurahan belum terpetakan'}
                                        {row.kecamatan
                                            ? ` · ${row.kecamatan}`
                                            : ''}
                                    </span>
                                    <StatusText
                                        tone={
                                            STATUS_TONE[row.status] ?? 'neutral'
                                        }
                                    >
                                        {STATUS_LABEL[row.status] ?? row.status}
                                    </StatusText>
                                </div>

                                {isSlaActiveStatus(row.status) ? (
                                    <div className="pt-0.5">
                                        <SlaCountdown
                                            status={row.status}
                                            assignedAt={row.assignedAt ?? null}
                                            acceptedAt={row.acceptedAt ?? null}
                                            createdAt={row.createdAt}
                                            compact
                                        />
                                    </div>
                                ) : null}
                            </button>
                        );
                    })
                )}
            </div>

            {totalPages > 1 ? (
                <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--ground)] px-3 py-2 text-[12px]">
                    <span className="font-mono text-muted-foreground tabular-nums">
                        Hal. {reports.page} / {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            disabled={reports.page <= 1}
                            aria-label="Halaman sebelumnya"
                            onClick={() =>
                                updateQuery({
                                    page: Math.max(1, reports.page - 1),
                                })
                            }
                        >
                            <ChevronLeft className="size-3.5" aria-hidden />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            disabled={reports.page >= totalPages}
                            aria-label="Halaman berikutnya"
                            onClick={() =>
                                updateQuery({
                                    page: Math.min(
                                        totalPages,
                                        reports.page + 1,
                                    ),
                                })
                            }
                        >
                            <ChevronRight className="size-3.5" aria-hidden />
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );

    const dossierEmptyState = (
        <div className="flex h-full min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex size-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] text-muted-foreground">
                <LayoutPanelLeft
                    className="size-4"
                    strokeWidth={1.5}
                    aria-hidden
                />
            </div>
            <p className="mt-3 text-[14px] font-medium text-foreground">
                Pilih kasus dari antrean untuk membuka dossier
            </p>
            <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-muted-foreground">
                Detail identitas pasien, hasil PE 72 jam, fogging 2 siklus, dan
                klaster 100 m hanya dimuat saat Anda memilih kasus (audit
                READ_PII tercatat per akses).
            </p>
        </div>
    );

    return (
        <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/92 px-4 py-3 backdrop-blur-md md:px-[var(--pad)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                        <div className="min-w-0">
                            <h1 className="text-[18px] leading-tight font-medium tracking-[-0.02em] text-foreground">
                                Dasbor surveilans
                            </h1>
                            <p className="text-[12px] text-muted-foreground">
                                {periodLabel} ·{' '}
                                <span className="font-mono tabular-nums">
                                    {formatNumber(counts.total)}
                                </span>{' '}
                                kasus tercatat
                            </p>
                        </div>

                        {!isRs ? (
                            <div
                                role="tablist"
                                aria-label="Mode tampilan dasbor"
                                className="inline-flex items-center gap-0.5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--ground)] p-0.5"
                            >
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeView === 'workspace'}
                                    onClick={() =>
                                        updateQuery({ view: 'workspace' })
                                    }
                                    className={cn(
                                        'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[6px] px-3 text-[12px] font-medium transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97]',
                                        activeView === 'workspace'
                                            ? 'bg-[var(--surface)] text-foreground shadow-2xs'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <LayoutPanelLeft
                                        className="size-3.5"
                                        strokeWidth={1.5}
                                        aria-hidden
                                    />
                                    Ruang Kerja
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeView === 'map'}
                                    onClick={() => updateQuery({ view: 'map' })}
                                    className={cn(
                                        'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[6px] px-3 text-[12px] font-medium transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97]',
                                        activeView === 'map'
                                            ? 'bg-[var(--surface)] text-foreground shadow-2xs'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <MapIcon
                                        className="size-3.5"
                                        strokeWidth={1.5}
                                        aria-hidden
                                    />
                                    Peta Komando
                                </button>
                            </div>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-9 gap-1.5 text-[12px] active:scale-[0.97]"
                        >
                            <a href="/api/export/laporan/rekap/excel">
                                <FileSpreadsheet
                                    className="size-3.5 text-[var(--positive)]"
                                    strokeWidth={1.5}
                                    aria-hidden
                                />
                                <span className="hidden sm:inline">
                                    Rekap Kemenkes (.xlsx)
                                </span>
                                <span className="sm:hidden">Rekap .xlsx</span>
                            </a>
                        </Button>
                        <Button
                            asChild
                            size="sm"
                            className="h-9 gap-1.5 text-[12px] active:scale-[0.97]"
                        >
                            <Link href={cta.href}>
                                {role === 'RUMAH_SAKIT' ? (
                                    <Plus
                                        className="size-3.5"
                                        strokeWidth={1.75}
                                        aria-hidden
                                    />
                                ) : null}
                                {cta.label}
                            </Link>
                        </Button>
                    </div>
                </div>
            </header>

            <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-4 py-4 md:px-[var(--pad)]">
                <section
                    aria-label="Filter KPI surveilans prioritas"
                    className="grid grid-cols-2 gap-3 lg:grid-cols-4"
                >
                    {kpiItems.map((item) => {
                        const Icon = item.icon;
                        const active = activeQueue === item.key;
                        return (
                            <button
                                key={item.key}
                                type="button"
                                aria-pressed={active}
                                onClick={() => toggleQueue(item.key)}
                                className={cn(
                                    'flex cursor-pointer flex-col justify-between rounded-[var(--radius-card)] border p-3.5 text-left transition-[border-color,background-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97]',
                                    active
                                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                                        : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--control)]',
                                )}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate text-[12px] font-medium text-muted-foreground">
                                        {item.label}
                                    </span>
                                    <Icon
                                        className={cn(
                                            'size-4 shrink-0',
                                            item.accentTone === 'negative'
                                                ? 'text-[var(--negative)]'
                                                : item.accentTone === 'warning'
                                                  ? 'text-[var(--warning)]'
                                                  : 'text-[var(--accent)]',
                                        )}
                                        strokeWidth={1.5}
                                        aria-hidden
                                    />
                                </div>
                                <div className="mt-2 flex items-baseline justify-between gap-2">
                                    <span className="font-mono text-[24px] leading-none font-semibold tracking-[-0.02em] text-foreground tabular-nums">
                                        {formatNumber(item.value)}
                                    </span>
                                </div>
                                <p className="mt-1.5 truncate text-[12px] text-muted-foreground">
                                    {item.meta}
                                </p>
                            </button>
                        );
                    })}
                </section>

                {activeView === 'map' && !isRs && mapData ? (
                    <section
                        aria-label="Peta komando surveilans"
                        className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]"
                    >
                        <div className="min-w-0 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3">
                            {uncoveredCount > 0 && role === 'DINKES' ? (
                                <div className="mb-3 flex items-start gap-2.5 rounded-[var(--radius-control)] border border-l-2 border-[var(--border)] border-l-[var(--warning)] bg-[var(--ground)] px-3 py-2 text-[12px]">
                                    <AlertCircle
                                        className="mt-0.5 size-4 shrink-0 text-[var(--warning)]"
                                        strokeWidth={1.5}
                                        aria-hidden
                                    />
                                    <p className="text-muted-foreground">
                                        <strong className="font-medium text-foreground">
                                            {formatNumber(uncoveredCount)}{' '}
                                            kelurahan
                                        </strong>{' '}
                                        belum terpetakan ke wilayah kerja
                                        Puskesmas.{' '}
                                        <Link
                                            href="/admin/koreksi-wilayah"
                                            className="font-medium text-[var(--accent)] underline underline-offset-4"
                                        >
                                            Koreksi wilayah
                                        </Link>
                                    </p>
                                </div>
                            ) : null}

                            <FacilityMapPanel
                                points={mapData.points}
                                zones={mapData.zones}
                                cases={mapData.cases}
                                height="calc(100dvh - 17rem)"
                                selectedCaseId={selectedId || null}
                                onSelectCase={(id) =>
                                    updateQuery({ selected: id })
                                }
                            />
                        </div>

                        <div className="flex h-[560px] flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] lg:h-[calc(100dvh-15rem)]">
                            {selectedDetail ? (
                                <div className="flex h-full flex-col bg-[var(--surface)]">
                                    <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] px-3.5 py-2.5">
                                        <div className="min-w-0">
                                            <p className="truncate font-mono text-[13px] font-semibold text-foreground">
                                                {selectedDetail.reportNumber}
                                            </p>
                                            <p className="truncate text-[12px] text-muted-foreground">
                                                {selectedDetail.patient.name} ·{' '}
                                                {selectedDetail.kelurahan ??
                                                    '-'}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-xs"
                                            aria-label="Kembali ke daftar antrean peta"
                                            onClick={clearSelection}
                                        >
                                            <X className="size-3.5" />
                                        </Button>
                                    </div>
                                    <div className="min-h-0 flex-1 overflow-y-auto p-3.5 lg:overscroll-contain">
                                        <ReportDossierContent
                                            detail={selectedDetail}
                                            role={role}
                                            onSelectReport={selectReport}
                                        />
                                    </div>
                                </div>
                            ) : (
                                queueListContent
                            )}
                        </div>
                    </section>
                ) : isRs ? (
                    <section
                        aria-label="Daftar laporan KDRS Rumah Sakit"
                        className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]"
                    >
                        <ReportTable
                            rows={reports.rows}
                            empty="Belum ada laporan KDRS pada filter ini."
                            onSelectRow={selectReport}
                            selectedId={selectedId}
                            showStatusTabs
                        />

                        <SpringSheet
                            open={Boolean(selectedDetail)}
                            onOpenChange={(open) => {
                                if (!open) clearSelection();
                            }}
                            title={
                                selectedDetail?.reportNumber ?? 'Detail KDRS'
                            }
                            description={
                                selectedDetail
                                    ? `${selectedDetail.patient.name} (${selectedDetail.patient.age} th) · ${selectedDetail.kelurahan ?? '-'}`
                                    : undefined
                            }
                        >
                            {selectedDetail ? (
                                <ReportDossierContent
                                    detail={selectedDetail}
                                    role={role}
                                    onSelectReport={selectReport}
                                />
                            ) : null}
                        </SpringSheet>
                    </section>
                ) : (
                    <>
                        <section
                            aria-label="Antrean triase mobile"
                            className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] lg:hidden"
                        >
                            {queueListContent}
                            <SpringSheet
                                open={Boolean(selectedDetail)}
                                onOpenChange={(open) => {
                                    if (!open) clearSelection();
                                }}
                                title={
                                    selectedDetail?.reportNumber ??
                                    'Dossier Kasus'
                                }
                                description={
                                    selectedDetail
                                        ? `${selectedDetail.patient.name} (${selectedDetail.patient.age} th) · ${selectedDetail.kelurahan ?? '-'}`
                                        : undefined
                                }
                                className="lg:hidden"
                            >
                                {selectedDetail ? (
                                    <ReportDossierContent
                                        detail={selectedDetail}
                                        role={role}
                                        onSelectReport={selectReport}
                                    />
                                ) : null}
                            </SpringSheet>
                        </section>

                        <section
                            aria-label="Ruang kerja triase dan dossier kasus"
                            className="hidden lg:block"
                        >
                            <ResizablePanelGroup
                                orientation="horizontal"
                                className="h-[calc(100dvh-16.5rem)] min-h-[520px] rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]"
                            >
                                <ResizablePanel defaultSize={36} minSize={28}>
                                    {queueListContent}
                                </ResizablePanel>
                                <ResizableHandle withHandle />
                                <ResizablePanel defaultSize={64} minSize={42}>
                                    {selectedDetail ? (
                                        <div
                                            key={selectedDetail.id}
                                            className="flex h-full flex-col bg-[var(--surface)]"
                                        >
                                            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-mono text-[15px] font-semibold text-foreground tabular-nums">
                                                            {
                                                                selectedDetail.reportNumber
                                                            }
                                                        </p>
                                                        <span className="rounded-[4px] border border-[var(--border)] bg-[var(--raised)] px-2 py-0.5 font-mono text-[11px] font-medium text-foreground">
                                                            {CASE_TYPE_LABEL[
                                                                selectedDetail
                                                                    .caseType
                                                            ] ??
                                                                selectedDetail.caseType}
                                                        </span>
                                                        {role === 'ADMIN' ? (
                                                            <span className="rounded-[4px] border border-[var(--border)] bg-[var(--ground)] px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                                                                Read-only
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                                                        {
                                                            selectedDetail
                                                                .patient.name
                                                        }{' '}
                                                        (
                                                        {
                                                            selectedDetail
                                                                .patient.age
                                                        }{' '}
                                                        th) ·{' '}
                                                        {selectedDetail.kelurahan ??
                                                            '-'}
                                                        ,{' '}
                                                        {selectedDetail.kecamatan ??
                                                            '-'}
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    aria-label="Tutup dossier kasus"
                                                    onClick={clearSelection}
                                                >
                                                    <X className="size-4" />
                                                </Button>
                                            </div>
                                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                                                <ReportDossierContent
                                                    detail={selectedDetail}
                                                    role={role}
                                                    onSelectReport={
                                                        selectReport
                                                    }
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        dossierEmptyState
                                    )}
                                </ResizablePanel>
                            </ResizablePanelGroup>
                        </section>
                    </>
                )}

                {activeView === 'workspace' ? (
                    <details className="group rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[13px] font-medium text-foreground select-none">
                            <span className="flex items-center gap-2">
                                Tren laporan 14 hari &amp; cakupan wilayah
                                {uncoveredCount > 0 && role === 'DINKES' ? (
                                    <span className="rounded-[6px] border border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] px-2 py-0.5 font-mono text-[11px] text-[var(--pill-warning-ink)] tabular-nums">
                                        {formatNumber(uncoveredCount)} kelurahan
                                        tanpa pembinaan
                                    </span>
                                ) : null}
                            </span>
                            <ChevronDown
                                className="size-4 text-muted-foreground transition-transform duration-150 ease-[var(--ease-out)] group-open:rotate-180"
                                strokeWidth={1.5}
                                aria-hidden
                            />
                        </summary>
                        <div className="space-y-4 border-t border-[var(--border)] p-4">
                            {uncoveredCount > 0 && role === 'DINKES' ? (
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-l-2 border-[var(--border)] border-l-[var(--warning)] bg-[var(--ground)] px-3 py-2.5 text-[12px]">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle
                                            className="size-4 shrink-0 text-[var(--warning)]"
                                            strokeWidth={1.5}
                                            aria-hidden
                                        />
                                        <span className="text-foreground">
                                            Terdapat{' '}
                                            <strong className="font-mono tabular-nums">
                                                {formatNumber(uncoveredCount)}
                                            </strong>{' '}
                                            kelurahan dengan kasus terlapor yang
                                            belum terpetakan ke Puskesmas.
                                        </span>
                                    </div>
                                    <Link
                                        href="/admin/koreksi-wilayah"
                                        className="font-medium text-[var(--accent)] underline underline-offset-4"
                                    >
                                        Buka koreksi wilayah
                                    </Link>
                                </div>
                            ) : null}

                            <div className="flex items-center justify-between gap-2">
                                <p className="text-[12px] text-muted-foreground">
                                    Volume kasus harian dalam 14 hari terakhir ·
                                    Terverifikasi bulan ini:{' '}
                                    <span className="font-mono font-medium text-foreground tabular-nums">
                                        {formatNumber(counts.verifiedThisMonth)}
                                    </span>
                                </p>
                                <Link
                                    href="/laporan/analitik"
                                    className="text-[12px] font-medium text-[var(--accent)] hover:underline"
                                >
                                    Analitik lengkap
                                </Link>
                            </div>
                            <DailySeriesChart data={series} />
                        </div>
                    </details>
                ) : null}
            </div>
        </div>
    );
}
