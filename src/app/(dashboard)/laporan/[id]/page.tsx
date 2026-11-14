import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/lib/session';
import {
    Activity,
    AlertCircle,
    ArrowLeft,
    Building2,
    Clock,
    FileDown,
    FileSpreadsheet,
    FileText,
    Flame,
    MapPin,
    MessageSquare,
    Paperclip,
    ShieldCheck,
    Stethoscope,
    User,
} from 'lucide-react';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { StatusText } from '@/components/shell/status-text';
import { Button } from '@/components/ui/button';
import { getReport } from '@/lib/domain/report-detail';
import {
    CASE_TYPE_LABEL,
    STATUS_LABEL,
    STATUS_TONE,
} from '@/lib/domain/report-labels';
import { formatDate, formatNumber } from '@/lib/format';
import { ReportAction } from './report-action';
import { Field } from './field';
import { AttachmentDropzone } from '@/components/reports/attachment-dropzone';
import { StatusStepper } from '@/components/reports/status-stepper';
import { SlaCountdown } from '@/components/reports/sla-countdown';
import { PatientMapPanel } from '@/components/reports/patient-map-panel';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

export default async function LaporanDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const actor = await requireActor();
    const report = await getReport(actor, id);

    if (!report) notFound();

    const isPuskesmasSource =
        report.institutionType === 'PUSKESMAS' ||
        report.sourceType === 'PUSKESMAS_POLI';
    const sourceLabel = isPuskesmasSource ? 'Puskesmas' : 'Rumah Sakit';

    const canReview =
        actor.role === 'PUSKESMAS' &&
        report.status === 'ASSIGNED' &&
        report.assignedPuskesmasId === actor.institutionId;
    const canStartPe =
        actor.role === 'PUSKESMAS' &&
        report.status === 'ASSIGNED_ACCEPTED' &&
        report.assignedPuskesmasId === actor.institutionId;
    const canVerify =
        actor.role === 'DINKES' && report.status === 'PE_COMPLETED';
    const canClose =
        (actor.role === 'DINKES' || actor.role === 'PUSKESMAS') &&
        (report.status === 'VERIFIED' || report.status === 'SIKLUS_2_DONE');

    return (
        <PageBody>
            <PageHeader
                title={report.reportNumber}
                context={
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[13px]">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-semibold text-foreground">
                            {isPuskesmasSource ? (
                                <Activity className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                            ) : (
                                <Building2 className="size-3.5 text-sky-600 dark:text-sky-400" aria-hidden />
                            )}
                            Sumber: {sourceLabel}
                        </span>
                        <StatusText tone={STATUS_TONE[report.status] ?? 'neutral'}>
                            {STATUS_LABEL[report.status] ?? report.status}
                        </StatusText>
                        <span className="rounded bg-[var(--accent)]/10 px-2 py-0.5 font-semibold text-[var(--accent)]">
                            {CASE_TYPE_LABEL[report.caseType] ?? report.caseType}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="size-3.5" aria-hidden />
                            Dibuat: {formatDate(report.createdAt)}
                        </span>
                        <SlaCountdown
                            status={report.status}
                            assignedAt={report.assignedAt}
                            acceptedAt={report.acceptedAt}
                            createdAt={report.createdAt}
                        />
                    </div>
                }
                aside={
                    <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                            <Link href="/laporan" className="inline-flex items-center gap-1.5">
                                <ArrowLeft className="size-3.5" aria-hidden />
                                Daftar Laporan
                            </Link>
                        </Button>
                    </div>
                }
            />

            <PageContent className="space-y-6">
                {/* Decision Action Bar if pending actor action */}
                {(canReview || canStartPe || canVerify || canClose) && (
                    <div className="rounded-[var(--radius-card)] border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 shadow-xs">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-[13.5px] font-semibold text-foreground">
                                    Keputusan Tindak Lanjut Surveilans
                                </p>
                                <p className="text-[12px] text-muted-foreground">
                                    Tindakan yang perlu diambil oleh faskes Anda pada tahap kasus saat ini.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {canReview && (
                                    <>
                                        <ReportAction
                                            id={id}
                                            transition="ACCEPT"
                                            label="Terima Tugas PE (SLA 72j)"
                                            primary
                                        />
                                        <ReportAction
                                            id={id}
                                            transition="REJECT"
                                            label="Tolak Tugas"
                                        />
                                    </>
                                )}
                                {canStartPe && (
                                    <>
                                        <ReportAction
                                            id={id}
                                            transition="START_PE"
                                            label="Mulai PE Lapangan"
                                        />
                                        <Button asChild size="sm">
                                            <Link href={`/pe/baru?reportId=${id}`}>
                                                Isi Formulir PE Sekarang
                                            </Link>
                                        </Button>
                                    </>
                                )}
                                {canVerify && (
                                    <>
                                        <ReportAction
                                            id={id}
                                            transition="VERIFY"
                                            label={
                                                report.pe?.foggingRecommended
                                                    ? 'Verifikasi & Wajib Fogging Fokus'
                                                    : 'Verifikasi Hasil PE'
                                            }
                                            primary
                                        />
                                        <ReportAction
                                            id={id}
                                            transition="REJECT_BY_DINKES"
                                            label="Kembalikan Berkas PE"
                                        />
                                    </>
                                )}
                                {canClose && (
                                    <ReportAction
                                        id={id}
                                        transition="MARK_CLOSED"
                                        label="Tutup Kasus (Selesai)"
                                        primary
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Status Stepper */}
                <Panel padded title="Alur Kasus & Kepatuhan SLA">
                    <StatusStepper status={report.status} />
                </Panel>

                {/* Cross border or rejection alerts */}
                {report.status === 'CROSS_BORDER_PENDING' && (
                    <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--warning)]/30 bg-[var(--pill-warning-bg)] p-4 text-[13px] text-[var(--warning)]">
                        <AlertCircle className="size-5 shrink-0" aria-hidden />
                        <div>
                            <p className="font-semibold text-foreground">Kasus Lintas Wilayah Domisili</p>
                            <p className="mt-0.5 text-muted-foreground">
                                Domisili pasien berada di luar cakupan faskes lokal (
                                {report.crossBorderTargetCity ?? report.kota ?? '-'}).{' '}
                                {actor.role === 'DINKES' && (
                                    <Link
                                        href="/laporan/lintas-wilayah"
                                        className="font-medium text-[var(--accent)] underline underline-offset-4"
                                    >
                                        Buka panel disposisi Lintas Wilayah →
                                    </Link>
                                )}
                            </p>
                        </div>
                    </div>
                )}

                {report.rejectionReason && (
                    <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--negative)]/30 bg-[var(--pill-negative-bg)] p-4 text-[13px] text-[var(--negative)]">
                        <AlertCircle className="size-5 shrink-0" aria-hidden />
                        <div>
                            <p className="font-semibold">Laporan Ditolak / Dikembalikan</p>
                            <p className="mt-0.5">{report.rejectionReason}</p>
                        </div>
                    </div>
                )}

                {/* Klaster Spasial 100m Alert */}
                {report.clusterId && (
                    <Panel
                        padded
                        title={
                            <span className="flex items-center gap-2 text-[#e11d48]">
                                <MapPin className="size-4" aria-hidden />
                                Klaster Spasial &le; 100 Meter ({report.clusterId})
                            </span>
                        }
                        subtitle="Kasus lain dalam radius 100 meter dan rentang waktu 14 hari."
                    >
                        {report.clusterSiblings.length === 0 ? (
                            <p className="text-[13px] text-muted-foreground">
                                Kasus ini teridentifikasi dalam radius klaster {report.clusterId}.
                            </p>
                        ) : (
                            <ul className="flex flex-wrap gap-2.5">
                                {report.clusterSiblings.map((sib) => (
                                    <li key={sib.id}>
                                        <Link
                                            href={`/laporan/${sib.id}`}
                                            className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12.5px] font-medium shadow-2xs transition-colors hover:bg-[var(--raised)]"
                                        >
                                            <MapPin className="size-3.5 text-[#e11d48]" aria-hidden />
                                            <span className="font-mono">{sib.reportNumber}</span>
                                            <span className="text-muted-foreground">
                                                Kel. {sib.kelurahan ?? '-'}
                                            </span>
                                            <StatusText tone={STATUS_TONE[sib.status] ?? 'neutral'}>
                                                {STATUS_LABEL[sib.status] ?? sib.status}
                                            </StatusText>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                )}

                {/* 2-Column Grid: Patient & Clinical Info + Facility & Spatial Location */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Patient Card */}
                    <Panel
                        padded
                        title={
                            <span className="flex items-center gap-2">
                                <User className="size-4 text-[var(--accent)]" aria-hidden />
                                Identitas Pasien
                            </span>
                        }
                        subtitle="Data pasien terlindungi enkripsi AES-256"
                        aside={
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                <ShieldCheck className="size-3.5" aria-hidden />
                                Terverifikasi
                            </span>
                        }
                    >
                        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                            <Field label="Nama Pasien" value={report.patient.name} />
                            <Field label="NIK" value={report.patient.nik} numeric />
                            <Field label="Umur" value={`${report.patient.age} tahun`} numeric />
                            <Field
                                label="Jenis Kelamin"
                                value={report.patient.gender === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)'}
                            />
                            <Field label="Nomor Telepon" value={report.patient.phone || '-'} numeric />
                            <Field label="Alamat Domisili" value={report.patient.address} wide />
                        </dl>
                    </Panel>

                    {/* Facility & Routing Card */}
                    <Panel
                        padded
                        title={
                            <span className="flex items-center gap-2">
                                <Building2 className="size-4 text-[var(--accent)]" aria-hidden />
                                Sumber Lapor & Rujukan Faskes
                            </span>
                        }
                        subtitle="Asal faskes pelapor dan penugasan puskesmas"
                    >
                        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                            <div>
                                <dt className="text-[12px] text-muted-foreground">Fasilitas Pelapor (Sumber)</dt>
                                <dd className="mt-1 flex items-center gap-1.5 font-medium text-[13.5px] text-foreground">
                                    <span
                                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                                            isPuskesmasSource
                                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                                : 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
                                        }`}
                                    >
                                        {sourceLabel}
                                    </span>
                                    <span>{report.institutionName ?? '-'}</span>
                                </dd>
                            </div>
                            <Field
                                label="Puskesmas Wilayah Kerja"
                                value={report.assignedPuskesmasName ?? 'Belum ditugaskan'}
                            />
                            <Field label="Kelurahan" value={report.kelurahan ?? '-'} />
                            <Field label="Kecamatan" value={report.kecamatan ?? '-'} />
                            <Field label="Kota / Kabupaten" value={report.kota ?? '-'} />
                            <Field
                                label="Titik Koordinat GPS"
                                value={
                                    report.latitude !== null && report.longitude !== null
                                        ? `${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`
                                        : 'Belum diisi'
                                }
                                numeric
                            />
                        </dl>

                        {/* Interactive mini-map showing investigation radius 100m */}
                        {report.latitude !== null && report.longitude !== null && (
                            <div className="mt-4 border-t border-[var(--rule)] pt-3.5 space-y-2">
                                <div className="flex items-center justify-between text-[12px]">
                                    <span className="flex items-center gap-1.5 font-semibold text-foreground">
                                        <MapPin className="size-3.5 text-[#e11d48]" aria-hidden />
                                        Peta Lokasi Domisili (Radius Penyelidikan 100m)
                                    </span>
                                    <span className="font-mono text-muted-foreground tabular-nums">
                                        {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
                                    </span>
                                </div>
                                <PatientMapPanel
                                    lat={report.latitude}
                                    lng={report.longitude}
                                    interactive={false}
                                    height="220px"
                                />
                            </div>
                        )}
                    </Panel>
                </div>

                {/* Clinical & Lab Panel */}
                <Panel
                    padded
                    title={
                        <span className="flex items-center gap-2">
                            <Stethoscope className="size-4 text-[var(--accent)]" aria-hidden />
                            Data Klinis & Hasil Laboratorium
                        </span>
                    }
                    subtitle="Pemeriksaan darah, onset gejala, dan diagnosis Kemenkes"
                >
                    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                        <Field
                            label="Tanggal Masuk Faskes"
                            value={formatDate(report.admissionDate)}
                            numeric
                        />
                        <Field
                            label="Mulai Onset Gejala"
                            value={report.symptomOnsetDate ? formatDate(report.symptomOnsetDate) : '-'}
                            numeric
                        />
                        <Field
                            label="Tanggal Diagnosis"
                            value={report.diagnosisDate ? formatDate(report.diagnosisDate) : '-'}
                            numeric
                        />
                        <div>
                            <dt className="text-[12px] text-muted-foreground">Trombosit</dt>
                            <dd className="mt-1 flex items-center gap-2 font-mono text-[14px] font-semibold tabular-nums text-foreground">
                                {report.plateletCount ? formatNumber(report.plateletCount) : '-'}
                                {report.plateletCount && report.plateletCount < 100000 && (
                                    <span className="rounded bg-[var(--pill-negative-bg)] px-1.5 py-0.2 text-[10.5px] font-semibold text-[var(--negative)]">
                                        &lt; 100.000 / &micro;L
                                    </span>
                                )}
                            </dd>
                        </div>
                        <Field
                            label="Hematokrit (Ht)"
                            value={report.hematocrit ? `${report.hematocrit}%` : '-'}
                            numeric
                        />
                        <div>
                            <dt className="text-[12px] text-muted-foreground">NS1 / IgM / IgG Blot</dt>
                            <dd className="mt-1 flex items-center gap-1.5 font-mono text-[12.5px] font-medium">
                                <span className="rounded bg-[var(--surface)] border px-1.5 py-0.5">
                                    NS1: {report.dengueBlot ?? '-'}
                                </span>
                                <span className="rounded bg-[var(--surface)] border px-1.5 py-0.5">
                                    IgM: {report.igm ?? '-'}
                                </span>
                                <span className="rounded bg-[var(--surface)] border px-1.5 py-0.5">
                                    IgG: {report.igg ?? '-'}
                                </span>
                            </dd>
                        </div>
                        <Field label="Diagnosis Klinis" value={report.diagnosis ?? '-'} wide />
                    </dl>
                </Panel>

                {/* PE Result Panel */}
                {report.pe && (
                    <Panel
                        padded
                        title={
                            <span className="flex items-center gap-2">
                                <Activity className="size-4 text-[var(--accent)]" aria-hidden />
                                Hasil Penyelidikan Epidemiologi (PE)
                            </span>
                        }
                        subtitle={`Petugas: ${report.pe.officerName} ${report.pe.officerNip ? `(NIP: ${report.pe.officerNip})` : ''} · Tanggal: ${formatDate(report.pe.peDate)}`}
                        aside={
                            <StatusText
                                tone={
                                    report.pe.transmissionRisk === 'POSITIF_PENULARAN'
                                        ? 'bad'
                                        : 'good'
                                }
                            >
                                {report.pe.transmissionRisk === 'POSITIF_PENULARAN'
                                    ? 'Positif Penularan (Wajib Fogging)'
                                    : 'Negatif Penularan'}
                            </StatusText>
                        }
                    >
                        {/* Entomology Metrics Grid */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3">
                                <p className="text-[11px] font-medium text-muted-foreground">Angka Bebas Jentik (ABJ)</p>
                                <p
                                    data-numeric
                                    className={`font-mono text-2xl font-bold tabular-nums ${
                                        Number(report.pe.abj ?? 0) < 95
                                            ? 'text-[var(--negative)]'
                                            : 'text-[var(--positive)]'
                                    }`}
                                >
                                    {report.pe.abj ?? '-'}%
                                </p>
                                <p className="text-[10px] text-muted-foreground">Target Nasional &ge; 95%</p>
                            </div>

                            <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3">
                                <p className="text-[11px] font-medium text-muted-foreground">House Index (HI)</p>
                                <p data-numeric className="font-mono text-2xl font-bold tabular-nums text-foreground">
                                    {report.pe.houseIndex ?? '-'}%
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                    {report.pe.housesPositive} dari {report.pe.housesInspected} rumah (+)
                                </p>
                            </div>

                            <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3">
                                <p className="text-[11px] font-medium text-muted-foreground">Container Index (CI)</p>
                                <p data-numeric className="font-mono text-2xl font-bold tabular-nums text-foreground">
                                    {report.pe.containerIndex ?? '-'}%
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                    {report.pe.containersPositive} dari {report.pe.containersInspected} kontainer (+)
                                </p>
                            </div>

                            <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3">
                                <p className="text-[11px] font-medium text-muted-foreground">Breteau Index (BI)</p>
                                <p data-numeric className="font-mono text-2xl font-bold tabular-nums text-foreground">
                                    {report.pe.breteauIndex ?? '-'}%
                                </p>
                                <p className="text-[10px] text-muted-foreground">Kontainer (+) per 100 rumah</p>
                            </div>
                        </div>

                        <div className="mt-4 rounded-[var(--radius-control)] border border-[var(--rule)] bg-[var(--raised)]/40 p-3 text-[13px]">
                            <p className="font-semibold text-foreground">Rekomendasi Tindak Lanjut:</p>
                            <p className="mt-0.5 text-muted-foreground">
                                {report.pe.recommendation || 'Pemberantasan Sarang Nyamuk (PSN) 3M Plus dan penyuluhan lingkungan.'}
                            </p>
                        </div>

                        {/* Export Action Bar */}
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--rule)] pt-4">
                            <Button asChild size="sm">
                                <a
                                    href={`/api/pdf/pe-lengkap/${report.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <FileDown className="size-4" aria-hidden />
                                    Export Semua Dokumen PDF (Lengkap)
                                </a>
                            </Button>
                            <Button asChild variant="outline" size="sm">
                                <a
                                    href={`/api/export/pe/${report.id}/excel`}
                                    download
                                >
                                    <FileSpreadsheet className="size-4 text-emerald-600" aria-hidden />
                                    Export Excel (.xlsx)
                                </a>
                            </Button>
                            <Button asChild variant="outline" size="sm">
                                <a
                                    href={`/api/pdf/pe-lampiran/${report.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <FileText className="size-4" aria-hidden />
                                    PDF Formulir &amp; Lampiran 1
                                </a>
                            </Button>
                            <Button asChild variant="outline" size="sm">
                                <a
                                    href={`/api/pdf/surat-kadinkes/${report.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <FileText className="size-4" aria-hidden />
                                    PDF Surat Kadinkes
                                </a>
                            </Button>
                            <Button asChild variant="outline" size="sm">
                                <a
                                    href={`/api/pdf/surat-camat-lurah/${report.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <FileText className="size-4" aria-hidden />
                                    PDF Surat Camat &amp; Lurah
                                </a>
                            </Button>
                        </div>
                    </Panel>
                )}

                {/* Fogging Cycles Panel */}
                {report.foggingCycles.length > 0 && (
                    <Panel
                        padded
                        title={
                            <span className="flex items-center gap-2">
                                <Flame className="size-4 text-[var(--accent)]" aria-hidden />
                                Jadwal &amp; Pelaksanaan Fogging Fokus (2 Siklus)
                            </span>
                        }
                        aside={
                            <Link
                                href="/tindak-lanjut"
                                className="text-[12.5px] font-medium text-[var(--accent)] hover:underline"
                            >
                                Kelola Tindak Lanjut →
                            </Link>
                        }
                    >
                        <div className="grid gap-3 sm:grid-cols-2">
                            {report.foggingCycles.map((c) => (
                                <div
                                    key={c.id}
                                    className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3.5 text-[13px]"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-foreground">
                                            Siklus {c.cycleNumber} (H{c.cycleNumber === 1 ? '0' : '+7'})
                                        </span>
                                        <StatusText tone={c.status === 'DONE' ? 'good' : 'warn'}>
                                            {c.status === 'DONE' ? 'Selesai' : 'Terjadwal'}
                                        </StatusText>
                                    </div>
                                    <p className="mt-1 text-muted-foreground text-[12px]">
                                        Jadwal: {formatDate(c.scheduledDate)}
                                        {c.executedAt ? ` · Selesai: ${formatDate(c.executedAt)}` : ''}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </Panel>
                )}

                {/* WhatsApp Dispatch Logs */}
                {report.waDispatches.length > 0 && (
                    <Panel
                        padded
                        title={
                            <span className="flex items-center gap-2">
                                <MessageSquare className="size-4 text-[var(--accent)]" aria-hidden />
                                Riwayat Log Notifikasi WhatsApp
                            </span>
                        }
                        subtitle="Pemberitahuan otomatis ke petugas penanggung jawab"
                    >
                        <ul className="flex flex-col gap-2 text-[12.5px]">
                            {report.waDispatches.map((w) => (
                                <li
                                    key={w.id}
                                    className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--rule)] bg-[var(--surface)] px-3 py-2"
                                >
                                    <span className="flex items-center gap-2">
                                        <MessageSquare className="size-3.5 text-[var(--accent)]" aria-hidden />
                                        <span className="font-medium text-foreground">{w.eventKind}</span>
                                        <span className="font-mono text-muted-foreground">
                                            {w.recipientPhone}
                                        </span>
                                    </span>
                                    <StatusText tone={w.status === 'SENT' ? 'good' : 'bad'}>
                                        {w.status}
                                    </StatusText>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                )}

                {/* Attachments Section */}
                <Panel
                    padded
                    title={
                        <span className="flex items-center gap-2">
                            <Paperclip className="size-4 text-[var(--accent)]" aria-hidden />
                            Lampiran &amp; Berkas Pendukung Kasus
                        </span>
                    }
                    subtitle="Hasil laboratorium, surat rujukan faskes, atau dokumentasi penyelidikan"
                >
                    <AttachmentDropzone reportRSId={report.id} />
                </Panel>
            </PageContent>
        </PageBody>
    );
}
