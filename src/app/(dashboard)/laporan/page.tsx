import Link from 'next/link';
import { FileSpreadsheet, Filter, RefreshCw, Search } from 'lucide-react';
import { requireActor } from '@/lib/session';
import {
    STATUSES,
    STATUS_LABEL,
    listReports,
    type ReportStatus,
    type ReportPeriod,
    type ReportAgeGroup,
} from '@/lib/domain/reports';
import { formatNumber, formatTime } from '@/lib/format';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { LiveData } from '@/components/shell/live-data';
import { Pager, readPage } from '@/components/shell/pager-view';
import { ReportTable } from '@/components/reports/report-table';
import { Button } from '@/components/ui/button';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

type SearchParams = {
    status?: string;
    search?: string;
    period?: string;
    caseType?: string;
    gender?: string;
    ageGroup?: string;
    sourceType?: string;
    page?: string;
};

export default async function LaporanPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const sp = await searchParams;
    const actor = await requireActor();

    const status = STATUSES.includes(sp.status as ReportStatus)
        ? (sp.status as ReportStatus)
        : undefined;
    const search = sp.search?.trim() || undefined;

    const rawPeriod = sp.period;
    const period = ['weekly', 'monthly', 'quarterly', 'yearly'].includes(rawPeriod ?? '')
        ? (rawPeriod as ReportPeriod)
        : undefined;

    const caseType = sp.caseType?.trim() || undefined;

    const rawGender = sp.gender;
    const gender = rawGender === 'L' || rawGender === 'P' ? rawGender : undefined;

    const rawAgeGroup = sp.ageGroup;
    const ageGroup = ['under_5', '5_14', '15_44', '45_plus'].includes(rawAgeGroup ?? '')
        ? (rawAgeGroup as ReportAgeGroup)
        : undefined;

    const rawSource = sp.sourceType;
    const sourceType = rawSource === 'RS' || rawSource === 'PUSKESMAS'
        ? rawSource
        : undefined;

    const page = readPage(sp.page);

    const { rows, total, perPage } = await listReports(actor, {
        status,
        search,
        period,
        caseType,
        gender,
        ageGroup,
        sourceType,
        page,
    });
    const renderedAt = formatTime(new Date());

    function buildHref(targetPage: number) {
        const params = new URLSearchParams();
        if (period) params.set('period', period);
        if (caseType) params.set('caseType', caseType);
        if (gender) params.set('gender', gender);
        if (ageGroup) params.set('ageGroup', ageGroup);
        if (sourceType) params.set('sourceType', sourceType);
        if (status) params.set('status', status);
        if (search) params.set('search', search);
        if (targetPage > 1) params.set('page', String(targetPage));
        const qs = params.toString();
        return qs ? `/laporan?${qs}` : '/laporan';
    }

    const exportParams = new URLSearchParams();
    if (period) exportParams.set('period', period);
    if (caseType) exportParams.set('caseType', caseType);
    if (gender) exportParams.set('gender', gender);
    if (ageGroup) exportParams.set('ageGroup', ageGroup);
    if (sourceType) exportParams.set('sourceType', sourceType);
    if (status) exportParams.set('status', status);
    if (search) exportParams.set('search', search);
    const excelExportUrl = `/api/export/laporan/excel${exportParams.toString() ? `?${exportParams.toString()}` : ''}`;

    const hasActiveFilters = Boolean(
        period || caseType || gender || ageGroup || sourceType || status || search,
    );

    return (
        <PageBody>
            <PageHeader
                aside={<LiveData since={renderedAt} />}
                title="Daftar Kasus & Laporan"
                context={`${formatNumber(total)} laporan terdaftar${status ? `, status: ${STATUS_LABEL[status]}` : ''}${search ? `, pencarian: “${search}”` : ''}`}
                action={
                    actor.role === 'RUMAH_SAKIT' || actor.role === 'PUSKESMAS'
                        ? {
                              href: '/laporan/baru',
                              label:
                                  actor.role === 'PUSKESMAS'
                                      ? 'Lapor Poli / IGD'
                                      : 'Lapor KDRS Baru',
                          }
                        : undefined
                }
            />

            <PageContent>
                {/* Filter Form Toolbar */}
                <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
                    <form method="get" action="/laporan" className="space-y-4">
                        {/* Periode Laporan Quick Selector */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="mr-1 font-semibold text-foreground flex items-center gap-1.5">
                                    <Filter className="size-3.5 text-primary" aria-hidden />
                                    Periode:
                                </span>
                                {[
                                    { id: '', label: 'Semua Waktu' },
                                    { id: 'weekly', label: 'Mingguan (7 Hari)' },
                                    { id: 'monthly', label: 'Bulanan (Bulan Ini)' },
                                    { id: 'quarterly', label: 'Triwulan (Q)' },
                                    { id: 'yearly', label: 'Tahunan' },
                                ].map((p) => {
                                    const isActive = (period ?? '') === p.id;
                                    const pParams = new URLSearchParams(exportParams);
                                    if (p.id) pParams.set('period', p.id);
                                    else pParams.delete('period');
                                    pParams.delete('page');
                                    const href = `/laporan${pParams.toString() ? `?${pParams.toString()}` : ''}`;

                                    return (
                                        <Link
                                            key={p.id}
                                            href={href}
                                            className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                                                isActive
                                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                                    : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                                            }`}
                                        >
                                            {p.label}
                                        </Link>
                                    );
                                })}
                            </div>

                            {/* Export Excel Button */}
                            <div className="flex items-center gap-2">
                                <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1.5 border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                                >
                                    <a href={excelExportUrl} download>
                                        <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                                        <span>Export Excel (.xlsx)</span>
                                    </a>
                                </Button>
                            </div>
                        </div>

                        {/* Hidden input for current period when submitting custom form */}
                        {period && <input type="hidden" name="period" value={period} />}

                        {/* Grid Filter Kontrol Detail */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            {/* 1. Diagnosa */}
                            <div className="space-y-1.5">
                                <Label htmlFor="caseType" className="text-[12px] font-medium text-muted-foreground">
                                    Diagnosa
                                </Label>
                                <select
                                    id="caseType"
                                    name="caseType"
                                    defaultValue={caseType ?? ''}
                                    className="block h-9 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[13px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                                >
                                    <option value="">Semua Diagnosa</option>
                                    <option value="DENGUE">DBD (Dengue)</option>
                                    <option value="SUSPECTED_DENGUE">Suspek DBD</option>
                                    <option value="DHF">DHF</option>
                                    <option value="DSS">DSS</option>
                                </select>
                            </div>

                            {/* 2. Jenis Kelamin */}
                            <div className="space-y-1.5">
                                <Label htmlFor="gender" className="text-[12px] font-medium text-muted-foreground">
                                    Jenis Kelamin
                                </Label>
                                <select
                                    id="gender"
                                    name="gender"
                                    defaultValue={gender ?? ''}
                                    className="block h-9 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[13px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                                >
                                    <option value="">Semua (L/P)</option>
                                    <option value="L">Laki-laki (L)</option>
                                    <option value="P">Perempuan (P)</option>
                                </select>
                            </div>

                            {/* 3. Kelompok Umur */}
                            <div className="space-y-1.5">
                                <Label htmlFor="ageGroup" className="text-[12px] font-medium text-muted-foreground">
                                    Kelompok Umur
                                </Label>
                                <select
                                    id="ageGroup"
                                    name="ageGroup"
                                    defaultValue={ageGroup ?? ''}
                                    className="block h-9 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[13px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                                >
                                    <option value="">Semua Umur</option>
                                    <option value="under_5">Balita (&lt; 5 th)</option>
                                    <option value="5_14">Anak (5 - 14 th)</option>
                                    <option value="15_44">Dewasa (15 - 44 th)</option>
                                    <option value="45_plus">Lansia (≥ 45 th)</option>
                                </select>
                            </div>

                            {/* 4. Sumber Lapor */}
                            <div className="space-y-1.5">
                                <Label htmlFor="sourceType" className="text-[12px] font-medium text-muted-foreground">
                                    Sumber Lapor
                                </Label>
                                <select
                                    id="sourceType"
                                    name="sourceType"
                                    defaultValue={sourceType ?? ''}
                                    className="block h-9 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[13px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                                >
                                    <option value="">Semua Sumber</option>
                                    <option value="RS">Rumah Sakit (KDRS)</option>
                                    <option value="PUSKESMAS">Puskesmas (Poli/IGD)</option>
                                </select>
                            </div>

                            {/* 5. Status Laporan */}
                            <div className="space-y-1.5">
                                <Label htmlFor="status" className="text-[12px] font-medium text-muted-foreground">
                                    Status Laporan
                                </Label>
                                <select
                                    id="status"
                                    name="status"
                                    defaultValue={status ?? ''}
                                    className="block h-9 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[13px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                                >
                                    <option value="">Semua Status</option>
                                    {STATUSES.map((s) => (
                                        <option key={s} value={s}>
                                            {STATUS_LABEL[s]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Search & Actions Bar */}
                        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                            <div className="w-full sm:max-w-md">
                                <InputGroup className="h-9 w-full">
                                    <InputGroupAddon>
                                        <Search className="size-4 text-muted-foreground" aria-hidden />
                                    </InputGroupAddon>
                                    <InputGroupInput
                                        id="search"
                                        name="search"
                                        type="search"
                                        defaultValue={search ?? ''}
                                        placeholder="Cari nomor laporan, kelurahan..."
                                    />
                                </InputGroup>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    type="submit"
                                    size="sm"
                                    className="h-9 px-4 font-medium"
                                >
                                    Terapkan Filter
                                </Button>

                                {hasActiveFilters && (
                                    <Button asChild variant="ghost" size="sm" className="h-9 text-muted-foreground hover:text-foreground">
                                        <Link href="/laporan">
                                            <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
                                            Reset Filter
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </div>
                    </form>
                </div>

                {/* Table Data Panel */}
                <Panel
                    title={`${formatNumber(total)} Kasus Terdata`}
                    aside={
                        <div className="flex items-center gap-4">
                            {actor.role === 'DINKES' && (
                                <Link
                                    href="/laporan/lintas-wilayah"
                                    className="text-[12.5px] font-medium text-[var(--warning)] underline-offset-4 hover:underline"
                                >
                                    Lintas wilayah
                                </Link>
                            )}
                            <Link
                                href="/laporan/perlu-action"
                                className="text-[12.5px] font-medium text-[var(--accent)] underline-offset-4 hover:underline"
                            >
                                Perlu tindakan
                            </Link>
                        </div>
                    }
                >
                    <ReportTable
                        rows={rows}
                        empty="Tidak ada laporan yang cocok dengan kombinasi filter ini."
                    />
                    <Pager
                        info={{ page, perPage, total }}
                        label="laporan"
                        buildHref={buildHref}
                    />
                </Panel>
            </PageContent>
        </PageBody>
    );
}
