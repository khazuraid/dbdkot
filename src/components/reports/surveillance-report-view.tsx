'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Download,
    FileSpreadsheet,
    Building2,
    Calendar,
    Search,
    ShieldAlert,
    CheckCircle2,
    Layers,
    Clock,
    MapPin,
    BarChart3,
} from 'lucide-react';
import type {
    SurveillanceReportResult,
    EpiWeekReportResult,
    EndemicityResult,
    PeComplianceResult,
} from '@/lib/domain/surveillance-report';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ReportTab = 'age' | 'epiweek' | 'endemicity' | 'pe_compliance';

type Props = {
    initialData: SurveillanceReportResult;
    epiWeekData: EpiWeekReportResult;
    endemicityData: EndemicityResult;
    peComplianceData: PeComplianceResult;
    userRole: string;
    puskesmasOptions: Array<{ id: string; name: string }>;
};

const MONTHS = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' },
];

const YEARS = [2024, 2025, 2026, 2027];

export function SurveillanceReportView({
    initialData,
    epiWeekData,
    endemicityData,
    peComplianceData,
    userRole,
    puskesmasOptions,
}: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [, startTransition] = useTransition();

    const [activeTab, setActiveTab] = useState<ReportTab>('age');
    const [month, setMonth] = useState<number>(initialData.month);
    const [year, setYear] = useState<number>(initialData.year);
    const [level, setLevel] = useState<'kota' | 'puskesmas'>(initialData.level);
    const [selectedPuskesmasId, setSelectedPuskesmasId] = useState<string>(
        searchParams.get('puskesmasId') || puskesmasOptions[0]?.id || '',
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [downloading, setDownloading] = useState(false);

    const isDinkesOrAdmin = userRole === 'DINKES' || userRole === 'ADMIN';

    function applyFilter(
        newMonth: number,
        newYear: number,
        newLevel: 'kota' | 'puskesmas',
        pId?: string,
    ) {
        startTransition(() => {
            const params = new URLSearchParams();
            const now = new Date();
            const defaultMonth = now.getMonth() + 1;
            const defaultYear = now.getFullYear();

            // Short params: 'm' and 'y' (only set if non-default)
            if (newMonth !== defaultMonth) params.set('m', String(newMonth));
            if (newYear !== defaultYear) params.set('y', String(newYear));

            // Only Dinkes/Admin needs level and puskesmasId in URL
            if (isDinkesOrAdmin) {
                if (newLevel === 'puskesmas') {
                    params.set('lvl', 'puskesmas');
                    if (pId) params.set('pk', pId);
                }
            }

            const query = params.toString();
            router.push(query ? `/laporan/rekap?${query}` : '/laporan/rekap');
        });
    }

    async function handleExportExcel() {
        setDownloading(true);
        try {
            const params = new URLSearchParams();
            params.set('type', activeTab);
            params.set('m', String(month));
            params.set('y', String(year));
            if (isDinkesOrAdmin) {
                params.set('lvl', level);
                if (level === 'puskesmas' && selectedPuskesmasId) {
                    params.set('pk', selectedPuskesmasId);
                }
            } else {
                params.set('lvl', 'puskesmas');
            }

            const res = await fetch(`/api/export/laporan/rekap/excel?${params.toString()}`);
            if (!res.ok) throw new Error('Gagal mengunduh file Excel');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const contentDisposition = res.headers.get('Content-Disposition');
            let filename = `LAPORAN_SURVEILANS_${activeTab.toUpperCase()}_${year}.xlsx`;
            if (contentDisposition && contentDisposition.includes('filename=')) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) filename = match[1];
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Laporan Excel berhasil diunduh.');
        } catch (err) {
            console.error(err);
            toast.error('Gagal mengekspor Excel.');
        } finally {
            setDownloading(false);
        }
    }

    const q = searchQuery.toLowerCase();

    const filteredAgeRows = initialData.rows.filter((r) => {
        if (!searchQuery.trim()) return true;
        return (
            r.name.toLowerCase().includes(q) ||
            (r.kelurahan?.toLowerCase().includes(q) ?? false) ||
            (r.rw?.toLowerCase().includes(q) ?? false) ||
            (r.rt?.toLowerCase().includes(q) ?? false)
        );
    });

    const filteredEpiRows = epiWeekData.rows.filter((r) => {
        if (!searchQuery.trim()) return true;
        return (
            r.name.toLowerCase().includes(q) ||
            (r.kelurahan?.toLowerCase().includes(q) ?? false) ||
            (r.rw?.toLowerCase().includes(q) ?? false)
        );
    });

    const filteredEndemicityRows = endemicityData.rows.filter((r) => {
        if (!searchQuery.trim()) return true;
        return (
            r.kelurahan.toLowerCase().includes(q) ||
            r.kecamatan.toLowerCase().includes(q) ||
            r.status.toLowerCase().includes(q)
        );
    });

    const filteredComplianceRows = peComplianceData.rows.filter((r) => {
        if (!searchQuery.trim()) return true;
        return r.puskesmasName.toLowerCase().includes(q);
    });

    const isPuskesmasView = initialData.level === 'puskesmas';
    const pePercent =
        initialData.totals.totalCases.all > 0
            ? Math.round((initialData.totals.diPe / initialData.totals.totalCases.all) * 100)
            : 0;

    return (
        <div className="space-y-4">
            {/* Report Mode Switcher Tabs (Excel Cirebon 2025 Parity) */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xs">
                {[
                    {
                        id: 'age' as const,
                        label: 'Golongan Umur (Kemenkes)',
                        icon: BarChart3,
                    },
                    {
                        id: 'epiweek' as const,
                        label: 'Mingguan SKDR (W1-W52)',
                        icon: Calendar,
                    },
                    ...(isDinkesOrAdmin
                        ? [
                              {
                                  id: 'endemicity' as const,
                                  label: 'Stratifikasi 3-Tahun (SOS)',
                                  icon: MapPin,
                              },
                              {
                                  id: 'pe_compliance' as const,
                                  label: 'Kepatuhan Respon PE (72 Jam)',
                                  icon: Clock,
                              },
                          ]
                        : []),
                ].map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all',
                                active
                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                    : 'text-muted-foreground hover:bg-[var(--ground)] hover:text-foreground',
                            )}
                        >
                            <Icon className="size-3.5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Control Bar */}
            <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Level Toggle for Dinkes/Admin on Age & EpiWeek tabs */}
                    {isDinkesOrAdmin && (activeTab === 'age' || activeTab === 'epiweek') ? (
                        <div className="inline-flex rounded-md border border-[var(--border)] bg-[var(--ground)] p-0.5 text-xs">
                            <button
                                type="button"
                                onClick={() => {
                                    setLevel('kota');
                                    applyFilter(month, year, 'kota', selectedPuskesmasId);
                                }}
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 font-medium transition-colors',
                                    level === 'kota'
                                        ? 'bg-[var(--surface)] text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <Building2 className="h-3.5 w-3.5 text-primary" />
                                Tingkat Kota (Per Puskesmas)
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setLevel('puskesmas');
                                    applyFilter(month, year, 'puskesmas', selectedPuskesmasId);
                                }}
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 font-medium transition-colors',
                                    level === 'puskesmas'
                                        ? 'bg-[var(--surface)] text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <Layers className="h-3.5 w-3.5 text-teal-600" />
                                Tingkat Puskesmas (Per RW / RT)
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                            <Building2 className="h-4 w-4 text-primary" />
                            <span>
                                {activeTab === 'endemicity'
                                    ? `Evaluasi 3 Tahun (${endemicityData.years.join(' - ')})`
                                    : activeTab === 'pe_compliance'
                                      ? `Monitoring SLA Waktu Respon PE (${peComplianceData.periodLabel})`
                                      : `Puskesmas ${initialData.puskesmasName || initialData.locationName}`}
                            </span>
                        </div>
                    )}

                    {/* Export Excel CTA */}
                    <Button
                        size="sm"
                        onClick={handleExportExcel}
                        disabled={downloading}
                        className="h-8 gap-1.5 text-xs font-medium"
                    >
                        {downloading ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                        )}
                        Export Excel Resmi
                        <Download className="h-3 w-3 opacity-75" />
                    </Button>
                </div>

                {/* Sub-Filters */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-[var(--border)]">
                    {isDinkesOrAdmin &&
                        level === 'puskesmas' &&
                        (activeTab === 'age' || activeTab === 'epiweek') && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11.5px] text-muted-foreground font-medium">
                                    Puskesmas:
                                </span>
                                <select
                                    value={selectedPuskesmasId}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSelectedPuskesmasId(val);
                                        applyFilter(month, year, 'puskesmas', val);
                                    }}
                                    className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                                >
                                    {puskesmasOptions.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                    {(activeTab === 'age' || activeTab === 'pe_compliance') && (
                        <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[11.5px] text-muted-foreground font-medium">
                                Bulan:
                            </span>
                            <select
                                value={month}
                                onChange={(e) => {
                                    const m = Number(e.target.value);
                                    setMonth(m);
                                    applyFilter(m, year, level, selectedPuskesmasId);
                                }}
                                className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                            >
                                {MONTHS.map((m) => (
                                    <option key={m.value} value={m.value}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex items-center gap-1.5">
                        <span className="text-[11.5px] text-muted-foreground font-medium">
                            Tahun:
                        </span>
                        <select
                            value={year}
                            onChange={(e) => {
                                const y = Number(e.target.value);
                                setYear(y);
                                applyFilter(month, y, level, selectedPuskesmasId);
                            }}
                            className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                        >
                            {YEARS.map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Cari wilayah / Puskesmas..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--ground)] pl-8 pr-3 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                    </div>
                </div>
            </div>

            {/* ============================================================== */}
            {/* TAB 1: GOLONGAN UMUR (KEMENKES)                                */}
            {/* ============================================================== */}
            {activeTab === 'age' && (
                <>
                    {/* Summary KPI Cards */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                            <p className="text-[11px] font-medium text-muted-foreground">
                                Total Kasus (P + M)
                            </p>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                                    {initialData.totals.totalCases.all}
                                </span>
                                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                                    {initialData.totals.totalCases.m} Meninggal
                                </span>
                            </div>
                            <p className="text-[10.5px] text-muted-foreground mt-0.5">
                                L: {initialData.totals.totalGender.l_p + initialData.totals.totalGender.l_m} | P:{' '}
                                {initialData.totals.totalGender.p_p + initialData.totals.totalGender.p_m}
                            </p>
                        </div>

                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                            <p className="text-[11px] font-medium text-muted-foreground">
                                Cakupan PE (72 Jam)
                            </p>
                            <p className="mt-1 text-xl font-bold tracking-tight text-teal-600 dark:text-teal-400 tabular-nums">
                                {initialData.totals.diPe}{' '}
                                <span className="text-xs font-normal text-muted-foreground">
                                    ({pePercent}%)
                                </span>
                            </p>
                            <p className="text-[10.5px] text-muted-foreground mt-0.5">
                                Penyelidikan Lapangan
                            </p>
                        </div>

                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                            <p className="text-[11px] font-medium text-muted-foreground">
                                Larvasidasi / Abatisasi
                            </p>
                            <p className="mt-1 text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400 tabular-nums">
                                {initialData.totals.larvasidasi}
                            </p>
                            <p className="text-[10.5px] text-muted-foreground mt-0.5">
                                Lokasi / Kasus
                            </p>
                        </div>

                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                            <p className="text-[11px] font-medium text-muted-foreground">
                                Difogging (Fokus)
                            </p>
                            <p className="mt-1 text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
                                {initialData.totals.difogging}
                            </p>
                            <p className="text-[10.5px] text-muted-foreground mt-0.5">
                                Siklus 1 & 2
                            </p>
                        </div>

                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                            <p className="text-[11px] font-medium text-muted-foreground">
                                Rata-rata ABJ
                            </p>
                            <div className="mt-1 flex items-baseline gap-1.5">
                                <span
                                    className={cn(
                                        'text-xl font-bold tracking-tight tabular-nums',
                                        (initialData.totals.avgAbj ?? 0) >= 95
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-rose-600 dark:text-rose-400',
                                    )}
                                >
                                    {initialData.totals.avgAbj !== null
                                        ? `${initialData.totals.avgAbj}%`
                                        : '—'}
                                </span>
                            </div>
                            <p className="text-[10.5px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                {(initialData.totals.avgAbj ?? 0) >= 95 ? (
                                    <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium">
                                        <CheckCircle2 className="h-3 w-3" /> Target Kemenkes
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-0.5 text-rose-600 font-medium">
                                        <ShieldAlert className="h-3 w-3" /> Di Bawah Target 95%
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Official Age Report Table */}
                    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-xs">
                        <div className="border-b border-[var(--border)] bg-[var(--ground)]/60 px-4 py-3 text-center">
                            <h2 className="text-sm font-bold tracking-tight text-foreground uppercase">
                                {initialData.title}
                            </h2>
                            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                                {initialData.subtitle}
                            </p>
                        </div>

                        <div className="relative max-h-[68vh] overflow-x-auto overflow-y-auto">
                            <table className="w-full border-collapse text-center text-[11px]">
                                <thead className="sticky top-0 z-20 bg-[var(--ground)] shadow-xs">
                                    <tr className="border-b border-[var(--border)] text-[10.5px] font-bold text-foreground">
                                        <th rowSpan={3} className="border-r border-[var(--border)] px-2 py-1.5 w-10">
                                            NO
                                        </th>
                                        {isPuskesmasView ? (
                                            <>
                                                <th rowSpan={3} className="border-r border-[var(--border)] px-3 py-1.5 min-w-[130px] text-left">
                                                    KELURAHAN
                                                </th>
                                                <th rowSpan={3} className="border-r border-[var(--border)] px-2 py-1.5 w-14 text-center">
                                                    RW
                                                </th>
                                                <th rowSpan={3} className="border-r border-[var(--border)] px-2 py-1.5 w-14 text-center">
                                                    RT
                                                </th>
                                                <th rowSpan={3} className="border-r border-[var(--border)] px-3 py-1.5 min-w-[140px] text-left">
                                                    RS PENEMU
                                                </th>
                                            </>
                                        ) : (
                                            <th rowSpan={3} className="border-r border-[var(--border)] px-3 py-1.5 min-w-[170px] text-left">
                                                PUSKESMAS
                                            </th>
                                        )}
                                        <th colSpan={20} className="border-r border-[var(--border)] py-1 bg-primary/10 text-primary">
                                            GOLONGAN UMUR
                                        </th>
                                        <th colSpan={4} className="border-r border-[var(--border)] py-1 bg-muted/60">
                                            TOTAL
                                        </th>
                                        <th colSpan={2} rowSpan={2} className="border-r border-[var(--border)] py-1 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                            JUMLAH KASUS
                                        </th>
                                        <th rowSpan={3} className="border-r border-[var(--border)] px-2 py-1.5 min-w-[50px]">
                                            DI PE
                                        </th>
                                        <th rowSpan={3} className="border-r border-[var(--border)] px-2 py-1.5 min-w-[55px]">
                                            LARVASIDASI
                                        </th>
                                        <th rowSpan={3} className="border-r border-[var(--border)] px-2 py-1.5 min-w-[55px]">
                                            DIFOGGING
                                        </th>
                                        <th rowSpan={3} className="px-2 py-1.5 min-w-[55px]">
                                            ABJ (%)
                                        </th>
                                    </tr>

                                    <tr className="border-b border-[var(--border)] text-[10px] font-semibold text-foreground">
                                        <th colSpan={4} className="border-r border-[var(--border)] py-1">&lt; 1 th</th>
                                        <th colSpan={4} className="border-r border-[var(--border)] py-1">1 - 4 th</th>
                                        <th colSpan={4} className="border-r border-[var(--border)] py-1">5 - 14 th</th>
                                        <th colSpan={4} className="border-r border-[var(--border)] py-1">15 - 44 th</th>
                                        <th colSpan={4} className="border-r border-[var(--border)] py-1">&gt; 44 th</th>
                                        <th colSpan={2} className="border-r border-[var(--border)] py-1 bg-muted/40">L</th>
                                        <th colSpan={2} className="border-r border-[var(--border)] py-1 bg-muted/40">P</th>
                                    </tr>

                                    <tr className="border-b border-[var(--border)] text-[9.5px] font-semibold text-muted-foreground">
                                        {Array.from({ length: 6 }).map((_, idx) => (
                                            <FragmentHeaders key={idx} />
                                        ))}
                                        <th className="border-r border-[var(--border)] px-1 py-1 bg-amber-500/5">P</th>
                                        <th className="border-r border-[var(--border)] px-1 py-1 bg-amber-500/5 text-rose-600">M</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-[var(--border)]">
                                    {filteredAgeRows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={isPuskesmasView ? 35 : 32}
                                                className="py-10 text-center text-xs text-muted-foreground"
                                            >
                                                Tidak ada data laporan kasus untuk periode dan filter yang dipilih.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredAgeRows.map((r, idx) => (
                                            <tr
                                                key={r.id}
                                                className={cn(
                                                    'transition-colors hover:bg-muted/40',
                                                    idx % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--ground)]/30',
                                                )}
                                            >
                                                <td className="border-r border-[var(--border)] px-1.5 py-1.5 font-mono text-[10.5px]">
                                                    {r.no}
                                                </td>
                                                {isPuskesmasView ? (
                                                    <>
                                                        <td className="border-r border-[var(--border)] px-2.5 py-1.5 text-left font-medium text-foreground">
                                                            {r.kelurahan || r.name}
                                                        </td>
                                                        <td className="border-r border-[var(--border)] px-1.5 py-1.5 font-mono text-center font-semibold text-primary">
                                                            {r.rw || '-'}
                                                        </td>
                                                        <td className="border-r border-[var(--border)] px-1.5 py-1.5 font-mono text-center">
                                                            {r.rt || '-'}
                                                        </td>
                                                        <td className="border-r border-[var(--border)] px-2.5 py-1.5 text-left text-xs truncate max-w-[140px] text-muted-foreground" title={r.rsPenemu || '-'}>
                                                            {r.rsPenemu || '-'}
                                                        </td>
                                                    </>
                                                ) : (
                                                    <td className="border-r border-[var(--border)] px-2.5 py-1.5 text-left font-medium text-foreground">
                                                        {r.name}
                                                    </td>
                                                )}

                                                <AgeCells counts={r.under1} />
                                                <AgeCells counts={r.age1_4} />
                                                <AgeCells counts={r.age5_14} />
                                                <AgeCells counts={r.age15_44} />
                                                <AgeCells counts={r.over44} />
                                                <AgeCells counts={r.totalGender} highlight />

                                                <td className="border-r border-[var(--border)] px-1.5 py-1 tabular-nums font-semibold bg-amber-500/5">
                                                    {r.totalCases.p}
                                                </td>
                                                <td className="border-r border-[var(--border)] px-1.5 py-1 tabular-nums font-semibold bg-amber-500/5 text-rose-600">
                                                    {r.totalCases.m}
                                                </td>
                                                <td className="border-r border-[var(--border)] px-1.5 py-1 tabular-nums font-medium text-teal-600">
                                                    {r.diPe}
                                                </td>
                                                <td className="border-r border-[var(--border)] px-1.5 py-1 tabular-nums font-medium text-blue-600">
                                                    {r.larvasidasi}
                                                </td>
                                                <td className="border-r border-[var(--border)] px-1.5 py-1 tabular-nums font-medium text-amber-600">
                                                    {r.difogging}
                                                </td>
                                                <td className="px-1.5 py-1 tabular-nums font-medium">
                                                    {r.abj !== null ? (
                                                        <span
                                                            className={cn(
                                                                'rounded px-1.5 py-0.5 text-[10px]',
                                                                r.abj >= 95
                                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
                                                            )}
                                                        >
                                                            {r.abj}%
                                                        </span>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>

                                <tfoot className="border-t-2 border-[var(--border)] bg-muted/60 font-bold text-foreground">
                                    <tr>
                                        <td colSpan={isPuskesmasView ? 5 : 2} className="border-r border-[var(--border)] px-3 py-2 text-center uppercase">
                                            JUMLAH
                                        </td>
                                        <AgeCells counts={initialData.totals.under1} />
                                        <AgeCells counts={initialData.totals.age1_4} />
                                        <AgeCells counts={initialData.totals.age5_14} />
                                        <AgeCells counts={initialData.totals.age15_44} />
                                        <AgeCells counts={initialData.totals.over44} />
                                        <AgeCells counts={initialData.totals.totalGender} />
                                        <td className="border-r border-[var(--border)] px-1.5 py-2 tabular-nums">
                                            {initialData.totals.totalCases.p}
                                        </td>
                                        <td className="border-r border-[var(--border)] px-1.5 py-2 tabular-nums text-rose-600">
                                            {initialData.totals.totalCases.m}
                                        </td>
                                        <td className="border-r border-[var(--border)] px-1.5 py-2 tabular-nums text-teal-600">
                                            {initialData.totals.diPe}
                                        </td>
                                        <td className="border-r border-[var(--border)] px-1.5 py-2 tabular-nums text-blue-600">
                                            {initialData.totals.larvasidasi}
                                        </td>
                                        <td className="border-r border-[var(--border)] px-1.5 py-2 tabular-nums text-amber-600">
                                            {initialData.totals.difogging}
                                        </td>
                                        <td className="px-1.5 py-2 tabular-nums">
                                            {initialData.totals.avgAbj !== null ? `${initialData.totals.avgAbj}%` : '—'}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Distribusi Kasus Berdasarkan Faskes Penemu (RS Penemu) - Parity Excel 2025 DSK (2) Row 103 */}
                    {initialData.faskesPenemu && initialData.faskesPenemu.length > 0 && (
                        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-xs">
                            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--ground)]/60 px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-primary" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                        Distribusi Kasus Berdasarkan Faskes Penemu (RS Penemu)
                                    </h3>
                                </div>
                                <span className="text-[11px] font-medium text-muted-foreground">
                                    {initialData.faskesPenemu.reduce((acc, f) => acc + f.count, 0)} Kasus Terlaporkan
                                </span>
                            </div>
                            <div className="p-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                                    {initialData.faskesPenemu.map((item, idx) => {
                                        const totalKasus = initialData.totals.totalCases.all || 1;
                                        const pct = ((item.count / totalKasus) * 100).toFixed(1);
                                        return (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between rounded-md border border-[var(--border)]/70 bg-[var(--ground)]/40 px-3 py-2 text-xs"
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <p className="truncate font-medium text-foreground" title={item.name}>
                                                        <span className="text-muted-foreground mr-1.5 font-mono">{idx + 1}.</span>
                                                        {item.name}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        Kontribusi: {pct}%
                                                    </p>
                                                </div>
                                                <span className="rounded bg-primary/10 px-2 py-0.5 font-mono font-bold text-primary tabular-nums">
                                                    {item.count}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ============================================================== */}
            {/* TAB 2: MINGGUAN SKDR W1 - W52 (SHEET L2)                       */}
            {/* ============================================================== */}
            {activeTab === 'epiweek' && (
                <>
                    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-xs">
                        <div className="border-b border-[var(--border)] bg-[var(--ground)]/60 px-4 py-3 text-center">
                            <h2 className="text-sm font-bold tracking-tight text-foreground uppercase">
                                {epiWeekData.title}
                            </h2>
                            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                                {epiWeekData.subtitle} — Total: {epiWeekData.grandTotal} Kasus
                            </p>
                        </div>
                        <div className="relative max-h-[68vh] overflow-x-auto overflow-y-auto">
                            <table className="w-full border-collapse text-center text-[11px]">
                                <thead className="sticky top-0 z-20 bg-[var(--ground)] shadow-xs">
                                    <tr className="border-b border-[var(--border)] font-bold text-foreground">
                                        <th className="sticky left-0 z-30 bg-[var(--ground)] border-r border-[var(--border)] px-2 py-2 w-10">
                                            NO
                                        </th>
                                        {epiWeekData.level === 'puskesmas' ? (
                                            <>
                                                <th className="sticky left-10 z-30 bg-[var(--ground)] border-r border-[var(--border)] px-2.5 py-2 min-w-[120px] text-left">
                                                    KELURAHAN
                                                </th>
                                                <th className="border-r border-[var(--border)] px-1.5 py-2 w-12 text-center">
                                                    RW
                                                </th>
                                                <th className="border-r border-[var(--border)] px-1.5 py-2 w-12 text-center">
                                                    RT
                                                </th>
                                                <th className="border-r border-[var(--border)] px-2.5 py-2 min-w-[130px] text-left">
                                                    RS PENEMU
                                                </th>
                                            </>
                                        ) : (
                                            <th className="sticky left-10 z-30 bg-[var(--ground)] border-r border-[var(--border)] px-3 py-2 min-w-[180px] text-left">
                                                PUSKESMAS
                                            </th>
                                        )}
                                        {Array.from({ length: 52 }).map((_, i) => (
                                            <th key={i} className="border-r border-[var(--border)] px-1.5 py-2 min-w-[34px] font-mono text-[10px]">
                                                W{i + 1}
                                            </th>
                                        ))}
                                        <th className="px-2.5 py-2 bg-primary/10 text-primary">TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {filteredEpiRows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={epiWeekData.level === 'puskesmas' ? 57 : 54}
                                                className="py-10 text-center text-xs text-muted-foreground"
                                            >
                                                Tidak ada data laporan SKDR mingguan untuk filter yang dipilih.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredEpiRows.map((row, idx) => (
                                            <tr key={row.id} className={idx % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--ground)]/30'}>
                                                <td className="sticky left-0 bg-inherit border-r border-[var(--border)] px-2 py-1.5 font-mono text-[10.5px]">
                                                    {row.no}
                                                </td>
                                                {epiWeekData.level === 'puskesmas' ? (
                                                    <>
                                                        <td className="sticky left-10 bg-inherit border-r border-[var(--border)] px-2.5 py-1.5 text-left font-medium text-foreground">
                                                            {row.kelurahan || row.name}
                                                        </td>
                                                        <td className="border-r border-[var(--border)] px-1.5 py-1.5 font-mono text-center font-semibold text-primary">
                                                            {row.rw || '-'}
                                                        </td>
                                                        <td className="border-r border-[var(--border)] px-1.5 py-1.5 font-mono text-center">
                                                            {row.rt || '-'}
                                                        </td>
                                                        <td className="border-r border-[var(--border)] px-2.5 py-1.5 text-left text-xs truncate max-w-[140px] text-muted-foreground" title={row.rsPenemu || '-'}>
                                                            {row.rsPenemu || '-'}
                                                        </td>
                                                    </>
                                                ) : (
                                                    <td className="sticky left-10 bg-inherit border-r border-[var(--border)] px-3 py-1.5 text-left font-medium text-foreground">
                                                        {row.name}
                                                    </td>
                                                )}
                                                {row.weeks.map((count, wIdx) => (
                                                    <td
                                                        key={wIdx}
                                                        className={cn(
                                                            'border-r border-[var(--border)] px-1 py-1.5 tabular-nums',
                                                            count >= 5
                                                                ? 'bg-rose-500/15 font-bold text-rose-700 dark:text-rose-400'
                                                                : count > 0
                                                                  ? 'bg-teal-500/10 font-semibold text-teal-700 dark:text-teal-400'
                                                                  : 'text-muted-foreground/40',
                                                        )}
                                                    >
                                                        {count > 0 ? count : '0'}
                                                    </td>
                                                ))}
                                                <td className="px-2.5 py-1.5 font-bold tabular-nums bg-primary/5">
                                                    {row.total}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot className="border-t-2 border-[var(--border)] bg-muted/60 font-bold">
                                    <tr>
                                        <td colSpan={epiWeekData.level === 'puskesmas' ? 5 : 2} className="sticky left-0 bg-muted/90 border-r border-[var(--border)] px-3 py-2 text-center">
                                            TOTAL MINGGUAN
                                        </td>
                                        {epiWeekData.totalWeeks.map((tot, i) => (
                                            <td key={i} className="border-r border-[var(--border)] px-1 py-2 tabular-nums">
                                                {tot}
                                            </td>
                                        ))}
                                        <td className="px-2.5 py-2 tabular-nums text-primary">
                                            {epiWeekData.grandTotal}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Distribusi Kasus Berdasarkan Faskes Penemu (RS Penemu) - Parity Excel 2025 DSK (2) Row 103 */}
                    {epiWeekData.faskesPenemu && epiWeekData.faskesPenemu.length > 0 && (
                        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-xs">
                            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--ground)]/60 px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-primary" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                        Distribusi Kasus Berdasarkan Faskes Penemu (RS Penemu)
                                    </h3>
                                </div>
                                <span className="text-[11px] font-medium text-muted-foreground">
                                    {epiWeekData.faskesPenemu.reduce((acc, f) => acc + f.count, 0)} Kasus Terlaporkan
                                </span>
                            </div>
                            <div className="p-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                                    {epiWeekData.faskesPenemu.map((item, idx) => {
                                        const totalKasus = epiWeekData.grandTotal || 1;
                                        const pct = ((item.count / totalKasus) * 100).toFixed(1);
                                        return (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between rounded-md border border-[var(--border)]/70 bg-[var(--ground)]/40 px-3 py-2 text-xs"
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <p className="truncate font-medium text-foreground" title={item.name}>
                                                        <span className="text-muted-foreground mr-1.5 font-mono">{idx + 1}.</span>
                                                        {item.name}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        Kontribusi: {pct}%
                                                    </p>
                                                </div>
                                                <span className="rounded bg-primary/10 px-2 py-0.5 font-mono font-bold text-primary tabular-nums">
                                                    {item.count}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ============================================================== */}
            {/* TAB 3: STRATIFIKASI ENDEMISITAS 3-TAHUN (SHEET SOS)            */}
            {/* ============================================================== */}
            {activeTab === 'endemicity' && (
                <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
                            <p className="text-[11px] font-medium text-rose-700 dark:text-rose-400">
                                Kelurahan Endemis
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-rose-700 dark:text-rose-400">
                                {endemicityData.summary.endemis}
                            </p>
                            <p className="text-[10.5px] text-muted-foreground mt-0.5">
                                Kasus berturut 3 tahun
                            </p>
                        </div>
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                                Kelurahan Sporadis
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
                                {endemicityData.summary.sporadis}
                            </p>
                            <p className="text-[10.5px] text-muted-foreground mt-0.5">
                                Kasus tidak tiap tahun
                            </p>
                        </div>
                        <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
                            <p className="text-[11px] font-medium text-sky-700 dark:text-sky-400">
                                Kelurahan Potensial
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-sky-700 dark:text-sky-400">
                                {endemicityData.summary.potensial}
                            </p>
                            <p className="text-[10.5px] text-muted-foreground mt-0.5">
                                0 Kasus, ABJ &lt; 95%
                            </p>
                        </div>
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                            <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                Kelurahan Bebas
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                                {endemicityData.summary.bebas}
                            </p>
                            <p className="text-[10.5px] text-muted-foreground mt-0.5">
                                0 Kasus & ABJ &ge; 95%
                            </p>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-xs">
                        <div className="border-b border-[var(--border)] bg-[var(--ground)]/60 px-4 py-3 text-center">
                            <h2 className="text-sm font-bold tracking-tight text-foreground uppercase">
                                {endemicityData.title}
                            </h2>
                            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                                {endemicityData.subtitle}
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-xs">
                                <thead className="border-b border-[var(--border)] bg-[var(--ground)] text-[11px] font-bold">
                                    <tr>
                                        <th className="px-3 py-2.5 text-center w-12">NO</th>
                                        <th className="px-3 py-2.5">KELURAHAN</th>
                                        <th className="px-3 py-2.5">KECAMATAN</th>
                                        <th className="px-3 py-2.5 text-center">KASUS {endemicityData.years[0]}</th>
                                        <th className="px-3 py-2.5 text-center">KASUS {endemicityData.years[1]}</th>
                                        <th className="px-3 py-2.5 text-center">KASUS {endemicityData.years[2]}</th>
                                        <th className="px-3 py-2.5 text-center">TOTAL 3 TH</th>
                                        <th className="px-3 py-2.5 text-center">ABJ RATA2</th>
                                        <th className="px-3 py-2.5">STRATIFIKASI</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {filteredEndemicityRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-10 text-center text-muted-foreground">
                                                Belum ada data kasus dalam 3 tahun terakhir.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredEndemicityRows.map((row, idx) => (
                                            <tr key={row.kelurahan + idx} className="hover:bg-muted/30">
                                                <td className="px-3 py-2 text-center font-mono text-[11px]">{idx + 1}</td>
                                                <td className="px-3 py-2 font-semibold text-foreground">{row.kelurahan}</td>
                                                <td className="px-3 py-2 text-muted-foreground">{row.kecamatan}</td>
                                                <td className="px-3 py-2 text-center tabular-nums">{row.casesN2}</td>
                                                <td className="px-3 py-2 text-center tabular-nums">{row.casesN1}</td>
                                                <td className="px-3 py-2 text-center tabular-nums">{row.casesN0}</td>
                                                <td className="px-3 py-2 text-center font-bold tabular-nums">{row.total3Years}</td>
                                                <td className="px-3 py-2 text-center tabular-nums">
                                                    {row.avgAbj !== null ? `${row.avgAbj}%` : '—'}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold',
                                                            row.status === 'ENDEMIS' &&
                                                                'bg-rose-500/15 text-rose-700 dark:text-rose-400',
                                                            row.status === 'SPORADIS' &&
                                                                'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                                                            row.status === 'POTENSIAL' &&
                                                                'bg-sky-500/15 text-sky-700 dark:text-sky-400',
                                                            row.status === 'BEBAS' &&
                                                                'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
                                                        )}
                                                    >
                                                        {row.statusLabel}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* ============================================================== */}
            {/* TAB 4: REKAP KEPATUHAN WAKTU RESPON PE (SHEET LPESO)           */}
            {/* ============================================================== */}
            {activeTab === 'pe_compliance' && (
                <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                            <p className="text-[11px] font-medium text-muted-foreground">Total Kasus Masuk</p>
                            <p className="mt-1 text-2xl font-bold tabular-nums">{peComplianceData.totals.totalCases}</p>
                            <p className="text-[10.5px] text-muted-foreground mt-0.5">
                                {peComplianceData.totals.investigatedCount} sudah di-PE
                            </p>
                        </div>
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                            <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                Respon Dini (&le; 24 Jam)
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                                {peComplianceData.totals.under24h}
                            </p>
                            <p className="text-[10.5px] text-muted-foreground mt-0.5">Sangat Cepat</p>
                        </div>
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                                Melewati SLA (&gt; 72 Jam)
                            </p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
                                {peComplianceData.totals.over72h}
                            </p>
                            <p className="text-[10.5px] text-muted-foreground mt-0.5">
                                {peComplianceData.totals.notInvestigated} belum PE
                            </p>
                        </div>
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                            <p className="text-[11px] font-medium text-primary">Kepatuhan SLA (&le; 72 Jam)</p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
                                {peComplianceData.totals.avgComplianceRate}%
                            </p>
                            <p className="text-[10.5px] text-muted-foreground mt-0.5">Target Kemenkes &ge; 80%</p>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-xs">
                        <div className="border-b border-[var(--border)] bg-[var(--ground)]/60 px-4 py-3 text-center">
                            <h2 className="text-sm font-bold tracking-tight text-foreground uppercase">
                                {peComplianceData.title}
                            </h2>
                            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                                {peComplianceData.subtitle}
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-xs">
                                <thead className="border-b border-[var(--border)] bg-[var(--ground)] text-[11px] font-bold">
                                    <tr>
                                        <th className="px-3 py-2.5 text-center w-12">NO</th>
                                        <th className="px-3 py-2.5">PUSKESMAS</th>
                                        <th className="px-3 py-2.5 text-center">TOTAL KASUS</th>
                                        <th className="px-3 py-2.5 text-center">SUDAH PE</th>
                                        <th className="px-3 py-2.5 text-center text-emerald-600">&le; 24 JAM</th>
                                        <th className="px-3 py-2.5 text-center text-sky-600">24 - 72 JAM</th>
                                        <th className="px-3 py-2.5 text-center text-rose-600">&gt; 72 JAM</th>
                                        <th className="px-3 py-2.5 text-center text-amber-600">BELUM PE</th>
                                        <th className="px-3 py-2.5 text-center">KEPATUHAN SLA</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {filteredComplianceRows.map((row) => (
                                        <tr key={row.puskesmasId} className="hover:bg-muted/30">
                                            <td className="px-3 py-2 text-center font-mono text-[11px]">{row.no}</td>
                                            <td className="px-3 py-2 font-semibold text-foreground">{row.puskesmasName}</td>
                                            <td className="px-3 py-2 text-center tabular-nums">{row.totalCases}</td>
                                            <td className="px-3 py-2 text-center tabular-nums">{row.investigatedCount}</td>
                                            <td className="px-3 py-2 text-center tabular-nums font-medium text-emerald-600">
                                                {row.under24h}
                                            </td>
                                            <td className="px-3 py-2 text-center tabular-nums font-medium text-sky-600">
                                                {row.hours24to72}
                                            </td>
                                            <td className="px-3 py-2 text-center tabular-nums font-medium text-rose-600">
                                                {row.over72h}
                                            </td>
                                            <td className="px-3 py-2 text-center tabular-nums font-medium text-amber-600">
                                                {row.notInvestigated}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span
                                                    className={cn(
                                                        'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums',
                                                        row.complianceRate >= 80
                                                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                                            : 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
                                                    )}
                                                >
                                                    {row.complianceRate}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t-2 border-[var(--border)] bg-muted/60 font-bold">
                                    <tr>
                                        <td colSpan={2} className="px-3 py-2 text-center">TOTAL KOTA</td>
                                        <td className="px-3 py-2 text-center tabular-nums">{peComplianceData.totals.totalCases}</td>
                                        <td className="px-3 py-2 text-center tabular-nums">{peComplianceData.totals.investigatedCount}</td>
                                        <td className="px-3 py-2 text-center tabular-nums text-emerald-600">{peComplianceData.totals.under24h}</td>
                                        <td className="px-3 py-2 text-center tabular-nums text-sky-600">{peComplianceData.totals.hours24to72}</td>
                                        <td className="px-3 py-2 text-center tabular-nums text-rose-600">{peComplianceData.totals.over72h}</td>
                                        <td className="px-3 py-2 text-center tabular-nums text-amber-600">{peComplianceData.totals.notInvestigated}</td>
                                        <td className="px-3 py-2 text-center tabular-nums">{peComplianceData.totals.avgComplianceRate}%</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function FragmentHeaders() {
    return (
        <>
            <th className="border-r border-[var(--border)] px-1 py-1">L (P)</th>
            <th className="border-r border-[var(--border)] px-1 py-1">L (M)</th>
            <th className="border-r border-[var(--border)] px-1 py-1">P (P)</th>
            <th className="border-r border-[var(--border)] px-1 py-1">P (M)</th>
        </>
    );
}

function AgeCells({
    counts,
    highlight,
}: {
    counts: { l_p: number; l_m: number; p_p: number; p_m: number };
    highlight?: boolean;
}) {
    return (
        <>
            <td className={cn('border-r border-[var(--border)] px-1 py-1 tabular-nums', highlight && 'bg-muted/30 font-semibold')}>
                {counts.l_p}
            </td>
            <td className={cn('border-r border-[var(--border)] px-1 py-1 tabular-nums text-rose-600', highlight && 'bg-muted/30 font-semibold')}>
                {counts.l_m}
            </td>
            <td className={cn('border-r border-[var(--border)] px-1 py-1 tabular-nums', highlight && 'bg-muted/30 font-semibold')}>
                {counts.p_p}
            </td>
            <td className={cn('border-r border-[var(--border)] px-1 py-1 tabular-nums text-rose-600', highlight && 'bg-muted/30 font-semibold')}>
                {counts.p_m}
            </td>
        </>
    );
}
