'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
    Activity,
    AlertTriangle,
    ArrowUpRight,
    CheckCircle2,
    ExternalLink,
    FileText,
    MapPin,
    Phone,
    Stethoscope,
    User,
    X,
} from 'lucide-react';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { StatusText } from '@/components/shell/status-text';
import { ReportTable } from '@/components/reports/report-table';
import { StatusStepper } from '@/components/reports/status-stepper';
import { SlaCountdown } from '@/components/reports/sla-countdown';
import { ReportAction } from '@/app/(dashboard)/laporan/[id]/report-action';
import { useReportFilters } from '@/hooks/use-report-filters';
import {
    CASE_TYPE_LABEL,
    STATUS_LABEL,
    STATUS_TONE,
    type ReportListRow,
} from '@/lib/domain/report-labels';
import type { ReportDetail } from '@/lib/domain/report-detail';
import type { Role } from '@/lib/roles';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

const PatientLocationMap = dynamic(
    () => import('@/components/reports/patient-location-map'),
    {
        ssr: false,
        loading: () => (
            <div
                className="flex h-[180px] w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] text-[11px] text-muted-foreground"
                aria-busy
                role="status"
            >
                <span>Memuat peta pratinjau...</span>
            </div>
        ),
    },
);

export function ReportSplitView({
    rows,
    selectedDetail,
    role,
    empty,
}: {
    rows: ReportListRow[];
    selectedDetail: ReportDetail | null;
    role?: Role;
    empty: string;
}) {
    const [filters, setFilters] = useReportFilters();
    const [snap, setSnap] = useState<number | string | null>(0.5);
    const selectedId = filters.selected || selectedDetail?.id || '';

    function selectReport(id: string) {
        setSnap(0.5);
        void setFilters({ selected: id === selectedId ? '' : id });
    }

    function clearSelection() {
        setSnap(0.5);
        void setFilters({ selected: '' });
    }

    return (
        <>
            {/* Mobile Feed + Vaul Bottom Drawer */}
            <div className="block lg:hidden">
                <div className="space-y-3">
                    <p className="text-[12px] text-muted-foreground">
                        Sentuh baris untuk melihat pratinjau detail laporan.
                    </p>
                    <ReportTable
                        rows={rows}
                        empty={empty}
                        onSelectRow={selectReport}
                        selectedId={selectedId}
                    />
                </div>

                <Drawer
                    open={Boolean(selectedDetail)}
                    snapPoints={[0.5, 0.92]}
                    activeSnapPoint={snap}
                    setActiveSnapPoint={setSnap}
                    onOpenChange={(open) => {
                        if (!open) clearSelection();
                    }}
                >
                    <DrawerContent className="flex max-h-[92vh] flex-col">
                        <div className="flex-1 overflow-y-auto px-4 pb-4">
                            <DrawerHeader className="px-0 text-left">
                                <DrawerTitle className="font-mono text-[15px]">
                                    {selectedDetail?.reportNumber ??
                                        'Detail Laporan'}
                                </DrawerTitle>
                                <DrawerDescription>
                                    {selectedDetail
                                        ? `${selectedDetail.patient.name} (${selectedDetail.patient.age} th) · ${selectedDetail.kelurahan ?? '-'}`
                                        : ''}
                                </DrawerDescription>
                            </DrawerHeader>
                            {selectedDetail && (
                                <InspectorContent
                                    detail={selectedDetail}
                                    role={role}
                                />
                            )}
                        </div>
                    </DrawerContent>
                </Drawer>
            </div>

            {/* Desktop Split-Pane */}
            <div className="hidden lg:block">
                {selectedDetail ? (
                    <ResizablePanelGroup
                        orientation="horizontal"
                        className="min-h-[560px] rounded-[var(--radius-card)] border border-[var(--border)]"
                    >
                        <ResizablePanel defaultSize={56} minSize={38}>
                            <div className="h-full overflow-auto">
                                <ReportTable
                                    rows={rows}
                                    empty={empty}
                                    onSelectRow={selectReport}
                                    selectedId={selectedDetail.id}
                                />
                            </div>
                        </ResizablePanel>
                        <ResizableHandle withHandle />
                        <ResizablePanel defaultSize={44} minSize={34}>
                            <div className="flex h-full flex-col overflow-auto bg-[var(--surface)] p-4">
                                <div className="flex items-start justify-between gap-2 border-b border-[var(--rule)] pb-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-mono text-[14.5px] font-bold text-foreground">
                                                {selectedDetail.reportNumber}
                                            </p>
                                            <span className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--raised)] px-2 py-0.5 text-[10.5px] font-semibold text-foreground">
                                                {CASE_TYPE_LABEL[selectedDetail.caseType] ?? selectedDetail.caseType}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                                            {selectedDetail.patient.name} ({selectedDetail.patient.age} th, {selectedDetail.patient.gender === 'L' ? 'Laki-laki' : 'Perempuan'}) · {selectedDetail.kelurahan ?? '-'}, {selectedDetail.kecamatan ?? '-'}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Tutup panel pratinjau"
                                        onClick={clearSelection}
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </div>
                                <div className="flex-1 overflow-y-auto pt-3">
                                    <InspectorContent
                                        detail={selectedDetail}
                                        role={role}
                                    />
                                </div>
                            </div>
                        </ResizablePanel>
                    </ResizablePanelGroup>
                ) : (
                    <ReportTable
                        rows={rows}
                        empty={empty}
                        onSelectRow={selectReport}
                        selectedId={selectedId}
                    />
                )}
            </div>
        </>
    );
}

function InspectorContent({
    detail,
    role,
}: {
    detail: ReportDetail;
    role?: Role;
}) {
    const isCriticalPlatelet =
        detail.plateletCount !== null && detail.plateletCount < 100000;
    const cleanPhone = detail.patient.phone
        ? detail.patient.phone.replace(/\D/g, '').replace(/^0/, '62')
        : null;

    const canPuskesmasAccept =
        role === 'PUSKESMAS' && detail.status === 'ASSIGNED';
    const canPuskesmasStartPe =
        role === 'PUSKESMAS' && detail.status === 'ASSIGNED_ACCEPTED';
    const canDinkesVerify =
        role === 'DINKES' && detail.status === 'PE_COMPLETED';

    return (
        <div className="flex flex-col gap-4 text-[12.5px]">
            {/* Status & SLA Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/45 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    <StatusText tone={STATUS_TONE[detail.status] ?? 'neutral'}>
                        {STATUS_LABEL[detail.status] ?? detail.status}
                    </StatusText>
                    <SlaCountdown
                        status={detail.status}
                        assignedAt={detail.assignedAt}
                        acceptedAt={detail.acceptedAt}
                        createdAt={detail.createdAt}
                    />
                </div>
                {detail.clusterId && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--warning)]">
                        <MapPin className="size-3" /> Klaster {detail.clusterId}
                    </span>
                )}
            </div>

            {/* Stepper Timeline */}
            <div className="py-0.5">
                <StatusStepper status={detail.status} />
            </div>

            {/* Quick Workflow Action Alert & Buttons (Puskesmas & Dinkes) */}
            {canPuskesmasAccept && (
                <div className="space-y-2.5 rounded-[var(--radius-control)] border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-3">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
                        <div>
                            <p className="font-semibold text-foreground">
                                Tindakan Puskesmas Diperlukan
                            </p>
                            <p className="text-[11.5px] text-muted-foreground">
                                Laporan kasus masuk dalam wilayah kerja Anda. Segera konfirmasi penerimaan tugas sebelum SLA 24 jam terlampaui.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <ReportAction
                            id={detail.id}
                            transition="ACCEPT"
                            label="Terima Tugas PE (Mulai SLA 72j)"
                            primary
                        />
                        <ReportAction
                            id={detail.id}
                            transition="REJECT"
                            label="Tolak Wilayah"
                        />
                    </div>
                </div>
            )}

            {canPuskesmasStartPe && (
                <div className="space-y-2.5 rounded-[var(--radius-control)] border border-[var(--info)]/40 bg-[var(--info)]/10 p-3">
                    <div className="flex items-start gap-2">
                        <Activity className="mt-0.5 size-4 shrink-0 text-[var(--info)]" />
                        <div>
                            <p className="font-semibold text-foreground">
                                Pelaksanaan PE Lapangan (SLA 72 Jam)
                            </p>
                            <p className="text-[11.5px] text-muted-foreground">
                                Tugas telah diterima. Lakukan pemeriksaan jentik di 20 rumah radius 100m dari rumah pasien.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <ReportAction
                            id={detail.id}
                            transition="START_PE"
                            label="Mulai PE Lapangan"
                        />
                        <Button asChild size="sm" className="gap-1.5 shadow-xs">
                            <Link href={`/pe/baru?reportId=${detail.id}`}>
                                <FileText className="size-3.5" />
                                Isi Formulir Hasil PE
                            </Link>
                        </Button>
                    </div>
                </div>
            )}

            {canDinkesVerify && (
                <div className="space-y-2.5 rounded-[var(--radius-control)] border border-[var(--positive)]/40 bg-[var(--positive)]/10 p-3">
                    <div className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--positive)]" />
                        <div>
                            <p className="font-semibold text-foreground">
                                Verifikasi Penyelidikan Epidemiologi
                            </p>
                            <p className="text-[11.5px] text-muted-foreground">
                                Puskesmas telah menyelesaikan investigasi lapangan. Periksa hasil ABJ dan verifikasi rekomendasi fogging fokus.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <ReportAction
                            id={detail.id}
                            transition="VERIFY"
                            label={
                                detail.pe?.foggingRecommended
                                    ? 'Verifikasi & Wajibkan Fogging'
                                    : 'Verifikasi Hasil PE'
                            }
                            primary
                        />
                        <ReportAction
                            id={detail.id}
                            transition="REJECT_BY_DINKES"
                            label="Minta PE Ulang"
                        />
                    </div>
                </div>
            )}

            {/* Section 1: Data Identitas Pasien & Kontak */}
            <div className="space-y-2 rounded-[var(--radius-control)] border border-[var(--border)] p-3">
                <div className="flex items-center justify-between border-b border-[var(--rule)] pb-2">
                    <span className="flex items-center gap-2 font-semibold text-foreground">
                        <User className="size-3.5 text-[var(--accent)]" />
                        Identitas Pasien
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                        Data Terenkripsi (AES-256)
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                        <span className="text-[11.5px] text-muted-foreground">Nama Lengkap</span>
                        <p className="font-medium text-foreground">{detail.patient.name}</p>
                    </div>
                    <div>
                        <span className="text-[11.5px] text-muted-foreground">NIK Pasien</span>
                        <p className="font-mono text-[12px] text-foreground tabular-nums select-all">
                            {detail.patient.nik}
                        </p>
                    </div>
                    <div>
                        <span className="text-[11.5px] text-muted-foreground">Usia & Kelamin</span>
                        <p className="text-foreground">
                            {detail.patient.age} tahun ·{' '}
                            {detail.patient.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                        </p>
                    </div>
                    <div>
                        <span className="text-[11.5px] text-muted-foreground">Nomor Telepon/WA</span>
                        {cleanPhone ? (
                            <a
                                href={`https://wa.me/${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 font-mono text-[12px] font-medium text-[var(--accent)] hover:underline"
                            >
                                <Phone className="size-3" />
                                {detail.patient.phone}
                                <ExternalLink className="size-2.5" />
                            </a>
                        ) : (
                            <p className="text-muted-foreground">-</p>
                        )}
                    </div>
                    <div className="col-span-2">
                        <span className="text-[11.5px] text-muted-foreground">Alamat Domisili</span>
                        <p className="text-foreground">{detail.patient.address}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Kel. {detail.kelurahan ?? '-'}, Kec. {detail.kecamatan ?? '-'}, {detail.kota ?? 'Kota Cirebon'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Section 2: Data Klinis & Parameter Laboratorium */}
            <div className="space-y-2 rounded-[var(--radius-control)] border border-[var(--border)] p-3">
                <div className="flex items-center justify-between border-b border-[var(--rule)] pb-2">
                    <span className="flex items-center gap-2 font-semibold text-foreground">
                        <Stethoscope className="size-3.5 text-[var(--info)]" />
                        Parameter Klinis & Laboratorium
                    </span>
                    <span className="inline-flex items-center rounded bg-[var(--raised)] px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-foreground">
                        {CASE_TYPE_LABEL[detail.caseType] ?? detail.caseType}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div className="rounded-md border border-[var(--border)] bg-[var(--raised)]/35 p-2">
                        <span className="text-[11px] text-muted-foreground">Trombosit Terendah</span>
                        <p
                            className={cn(
                                'font-mono text-[13px] font-bold tabular-nums',
                                isCriticalPlatelet
                                    ? 'text-[var(--negative)]'
                                    : 'text-foreground',
                            )}
                        >
                            {detail.plateletCount ? `${formatNumber(detail.plateletCount)} /μL` : '-'}
                        </p>
                        {isCriticalPlatelet && (
                            <span className="text-[10px] font-medium text-[var(--negative)]">
                                Trombositopenia Kritis (&lt;100.000)
                            </span>
                        )}
                    </div>
                    <div className="rounded-md border border-[var(--border)] bg-[var(--raised)]/35 p-2">
                        <span className="text-[11px] text-muted-foreground">Hematokrit</span>
                        <p className="font-mono text-[13px] font-bold text-foreground tabular-nums">
                            {detail.hematocrit ? `${detail.hematocrit}%` : '-'}
                        </p>
                        <span className="text-[10px] text-muted-foreground">Indikator hemokonsentrasi</span>
                    </div>
                    <div>
                        <span className="text-[11.5px] text-muted-foreground">Hasil Serologi</span>
                        <p className="font-mono text-[12px] text-foreground">
                            NS1: {detail.dengueBlot ?? '-'} · IgM: {detail.igm ?? '-'} · IgG: {detail.igg ?? '-'}
                        </p>
                    </div>
                    <div>
                        <span className="text-[11.5px] text-muted-foreground">Tanggal Masuk Rawat</span>
                        <p className="text-foreground">
                            {formatDate(detail.admissionDate)}
                            {detail.symptomOnsetDate && (
                                <span className="block text-[11px] text-muted-foreground">
                                    Demam: {formatDate(detail.symptomOnsetDate)}
                                </span>
                            )}
                        </p>
                    </div>
                    <div>
                        <span className="text-[11.5px] text-muted-foreground">Faskes Pelapor (RS)</span>
                        <p className="font-medium text-foreground">{detail.institutionName ?? '-'}</p>
                    </div>
                    <div>
                        <span className="text-[11.5px] text-muted-foreground">Puskesmas Wilayah</span>
                        <p className="font-medium text-foreground">{detail.assignedPuskesmasName ?? 'Belum ditugaskan'}</p>
                    </div>
                </div>
            </div>

            {/* Section 3: Geospasial & Peta Pratinjau Klaster */}
            <div className="space-y-2 rounded-[var(--radius-control)] border border-[var(--border)] p-3">
                <div className="flex items-center justify-between border-b border-[var(--rule)] pb-2">
                    <span className="flex items-center gap-2 font-semibold text-foreground">
                        <MapPin className="size-3.5 text-[var(--accent)]" />
                        Lokasi Domisili & Radius Klaster 100m
                    </span>
                    {detail.latitude !== null && detail.longitude !== null && (
                        <span className="font-mono text-[10.5px] text-muted-foreground tabular-nums">
                            {detail.latitude.toFixed(5)}, {detail.longitude.toFixed(5)}
                        </span>
                    )}
                </div>

                {detail.latitude !== null && detail.longitude !== null ? (
                    <div className="pt-1">
                        <PatientLocationMap
                            lat={detail.latitude}
                            lng={detail.longitude}
                            interactive={false}
                            height="180px"
                        />
                    </div>
                ) : (
                    <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--raised)]/30 p-2.5 text-center text-[11.5px] text-muted-foreground">
                        <p>Geotag dilewati saat pembuatan laporan.</p>
                        <p className="text-[10.5px]">Titik koordinat GPS akan diambil saat petugas melakukan PE di rumah pasien.</p>
                    </div>
                )}
            </div>

            {/* Section 4: Hasil PE Lapangan (jika ada) */}
            {detail.pe && (
                <div className="space-y-2 rounded-[var(--radius-control)] border border-[var(--border)] p-3">
                    <div className="flex items-center justify-between border-b border-[var(--rule)] pb-2">
                        <span className="flex items-center gap-2 font-semibold text-foreground">
                            <Activity className="size-3.5 text-[var(--warning)]" />
                            Hasil Penyelidikan Epidemiologi (PE)
                        </span>
                        <StatusText
                            tone={
                                detail.pe.transmissionRisk === 'POSITIF_PENULARAN'
                                    ? 'bad'
                                    : 'good'
                            }
                        >
                            {detail.pe.transmissionRisk === 'POSITIF_PENULARAN'
                                ? 'Positif Penularan'
                                : 'Negatif Penularan'}
                        </StatusText>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center pt-1">
                        <div className="rounded-md border border-[var(--border)] bg-[var(--raised)]/35 p-2">
                            <span className="text-[10.5px] text-muted-foreground">ABJ</span>
                            <p
                                className={cn(
                                    'font-mono text-[13px] font-bold tabular-nums',
                                    Number(detail.pe.abj) < 95
                                        ? 'text-[var(--negative)]'
                                        : 'text-[var(--positive)]',
                                )}
                            >
                                {detail.pe.abj ?? '-'}%
                            </p>
                            <span className="text-[9.5px] text-muted-foreground">Target &ge;95%</span>
                        </div>
                        <div className="rounded-md border border-[var(--border)] bg-[var(--raised)]/35 p-2">
                            <span className="text-[10.5px] text-muted-foreground">House Index</span>
                            <p className="font-mono text-[13px] font-bold text-foreground tabular-nums">
                                {detail.pe.houseIndex ?? '-'}%
                            </p>
                            <span className="text-[9.5px] text-muted-foreground">Rumah (+) jentik</span>
                        </div>
                        <div className="rounded-md border border-[var(--border)] bg-[var(--raised)]/35 p-2">
                            <span className="text-[10.5px] text-muted-foreground">Container Index</span>
                            <p className="font-mono text-[13px] font-bold text-foreground tabular-nums">
                                {detail.pe.containerIndex ?? '-'}%
                            </p>
                            <span className="text-[9.5px] text-muted-foreground">Wadah (+) jentik</span>
                        </div>
                    </div>
                    <div className="space-y-1 pt-1 text-[11.5px]">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Rekomendasi Fogging Fokus:</span>
                            <span
                                className={cn(
                                    'font-semibold',
                                    detail.pe.foggingRecommended
                                        ? 'text-[var(--negative)]'
                                        : 'text-[var(--positive)]',
                                )}
                            >
                                {detail.pe.foggingRecommended
                                    ? 'Wajib Fogging Fokus (2 Siklus)'
                                    : 'Tidak Perlu Fogging (PSN 3M Plus)'}
                            </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Penyelidikan oleh: <strong className="text-foreground">{detail.pe.officerName}</strong> pada {formatDate(detail.pe.peDate)}
                        </p>
                    </div>
                </div>
            )}

            {/* Navigation & Full Details Link */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--rule)] pt-3 pb-1">
                <Button asChild size="sm" className="gap-1.5 shadow-xs">
                    <Link href={`/laporan/${detail.id}`}>
                        Buka Halaman Detail Lengkap
                        <ArrowUpRight className="size-3.5" />
                    </Link>
                </Button>
                {detail.pe && (
                    <Button asChild variant="outline" size="sm">
                        <a
                            href={`/api/pdf/pe-lampiran/${detail.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <FileText className="size-3.5" />
                            PDF Lampiran PE
                        </a>
                    </Button>
                )}
            </div>
        </div>
    );
}
