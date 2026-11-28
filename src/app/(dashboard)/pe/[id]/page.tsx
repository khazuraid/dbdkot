import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    Activity,
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    FileSpreadsheet,
    FileText,
    HeartPulse,
    Home,
    MapPin,
    ShieldAlert,
    ShieldCheck,
    Stethoscope,
    TestTube,
    User,
} from 'lucide-react';
import { requireActor } from '@/lib/session';
import { peDetail } from '@/lib/domain/pe';
import { formatDate } from '@/lib/format';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { Button } from '@/components/ui/button';
import { StatusText } from '@/components/shell/status-text';
import { PeActionToolbar } from '@/app/(dashboard)/pe/pe-actions';
import { AttachmentDropzone } from '@/components/reports/attachment-dropzone';
import { ManualNotifyButton } from '@/components/reports/manual-notify-button';
import { findPuskesmasByKelurahan } from '@/lib/domain/assignment';
import { institutionChoices } from '@/lib/domain/master';
import { buildManualNotifyTargets } from '@/lib/domain/report-labels';

export const instant = false;

function Field({
    label,
    value,
    mono,
    highlight,
}: {
    label: string;
    value?: React.ReactNode;
    mono?: boolean;
    highlight?: boolean;
}) {
    return (
        <div className="space-y-1">
            <dt className="text-[11.5px] font-medium text-muted-foreground">
                {label}
            </dt>
            <dd
                className={`text-[13px] text-foreground ${mono ? 'font-mono' : ''} ${
                    highlight ? 'font-semibold text-[var(--accent)]' : ''
                }`}
            >
                {value ?? '—'}
            </dd>
        </div>
    );
}

export default async function PeDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const actor = await requireActor();

    const detail = await peDetail(actor, id);
    if (!detail) notFound();

    const pe = detail.pe;
    const formData = (pe.formData ?? {}) as {
        clinicalSymptoms?: string[];
        labRdtNs1?: string;
        labIgm?: string;
        labIgg?: string;
        labPlatelet?: number;
        labHematocrit?: number;
        hasOtherDenguePatients?: boolean;
        symptomOnsetDate?: string;
        mainComplaint?: string;
        firstActionTaken?: string;
        dengueAttackOrder?: string;
        comorbidity?: string;
        treatmentGiven?: string;
        respondentAge?: number;
        respondentJob?: string;
        respondentAddress?: string;
        patientJob?: string;
        actionPlan?: string;
    };

    const canManage =
        actor.role === 'ADMIN' ||
        actor.role === 'DINKES' ||
        actor.institutionId === pe.institutionId;

    const choices = await institutionChoices();
    const instNameById = new Map(choices.map((c) => [c.id, c.name]));
    const fallbackPuskesmas = detail.assignedPuskesmasId
        ? null
        : await findPuskesmasByKelurahan(detail.kelurahan);
    const peNotifyTargets = buildManualNotifyTargets({
        actorRole: actor.role,
        actorInstitutionId: actor.institutionId,
        reportInstitutionId: detail.institutionId,
        reportInstitutionName: instNameById.get(detail.institutionId) ?? null,
        puskesmasId:
            detail.assignedPuskesmasId ?? fallbackPuskesmas?.id ?? null,
        puskesmasName:
            (detail.assignedPuskesmasId
                ? instNameById.get(detail.assignedPuskesmasId)
                : fallbackPuskesmas?.name) ?? null,
    });

    const abjVal = Number(pe.abj ?? 0);
    const hiVal = Number(pe.houseIndex ?? 0);
    const ciVal = Number(pe.containerIndex ?? 0);
    const biVal = Number(pe.breteauIndex ?? 0);
    const isFogging = pe.foggingRecommended;

    return (
        <PageBody>
            <PageHeader
                title={`Detail Lengkap Penyelidikan Epidemiologi (PE)`}
                context={
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[13px]">
                        <span className="font-mono text-xs font-semibold text-[var(--accent)]">
                            {detail.reportNumber}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">
                            Tanggal PE: {formatDate(pe.peDate)}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <StatusText
                            tone={
                                pe.status === 'VERIFIED'
                                    ? 'good'
                                    : pe.status === 'REJECTED'
                                      ? 'bad'
                                      : 'warn'
                            }
                        >
                            {pe.status === 'VERIFIED'
                                ? 'Terverifikasi Dinkes'
                                : pe.status === 'REJECTED'
                                  ? 'Ditolak Dinkes'
                                  : 'Selesai PE (Menunggu Verifikasi)'}
                        </StatusText>
                    </div>
                }
                aside={
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                        >
                            <Link href={`/laporan/${detail.reportRSId}`}>
                                <ArrowLeft className="size-3.5" aria-hidden />
                                Laporan Kasus
                            </Link>
                        </Button>
                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                        >
                            <Link
                                href={`/api/pdf/pe-lengkap/${pe.id}`}
                                target="_blank"
                            >
                                <FileText
                                    className="size-3.5 text-rose-600"
                                    aria-hidden
                                />
                                Form PE Kemenkes (PDF)
                            </Link>
                        </Button>
                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                        >
                            <Link
                                href={`/api/export/pe/${pe.id}/excel`}
                                target="_blank"
                            >
                                <FileSpreadsheet
                                    className="size-3.5 text-emerald-600"
                                    aria-hidden
                                />
                                Unduh Excel
                            </Link>
                        </Button>
                        {canManage && (
                            <PeActionToolbar
                                peId={pe.id}
                                reportNumber={detail.reportNumber}
                            />
                        )}
                        <ManualNotifyButton
                            reportId={detail.reportRSId}
                            reportNumber={detail.reportNumber}
                            kelurahan={detail.kelurahan}
                            context="PE"
                            targets={peNotifyTargets}
                            label="Kirim Notif PE"
                        />
                    </div>
                }
            />

            <PageContent className="space-y-6">
                {/* Status Kesimpulan / Risiko Penularan Banner */}
                <div
                    className={`rounded-[var(--radius-control)] border p-4.5 transition-colors ${
                        isFogging
                            ? 'border-rose-200 bg-rose-50/70 dark:border-rose-900/40 dark:bg-rose-950/20'
                            : 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                    }`}
                >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div className="flex items-start gap-3">
                            <div
                                className={`mt-0.5 shrink-0 rounded-full p-1.5 ${
                                    isFogging
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                                }`}
                            >
                                {isFogging ? (
                                    <ShieldAlert className="size-5" />
                                ) : (
                                    <ShieldCheck className="size-5" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-foreground">
                                    Kesimpulan Investigasi:{' '}
                                    <span
                                        className={
                                            isFogging
                                                ? 'text-rose-700 dark:text-rose-400'
                                                : 'text-emerald-700 dark:text-emerald-400'
                                        }
                                    >
                                        {isFogging
                                            ? 'Positif Penularan · Rekomendasi Fogging Fokus (2 Siklus)'
                                            : 'Negatif Penularan · PSN 3M Plus & Larvasidasi'}
                                    </span>
                                </h3>
                                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                                    {pe.conclusion ||
                                        (isFogging
                                            ? 'Ditemukan jentik positif atau penderita demam lain di radius 100m. Diperlukan fogging fokus 2 siklus (H0 & H+7) dan larvasidasi serentak.'
                                            : 'Tidak ditemukan bukti penularan aktif setempat. Dilakukan penyuluhan 3M Plus dan pemantauan berkala.')}
                                </p>
                            </div>
                        </div>
                        {pe.recommendation && (
                            <div className="shrink-0 sm:text-right">
                                <span className="block text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                                    Rekomendasi Petugas
                                </span>
                                <span className="text-xs font-semibold text-foreground">
                                    {pe.recommendation}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Key Entomology Metrics KPI */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <div className="space-y-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3">
                        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            ABJ (Bebas Jentik)
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span
                                className={`font-mono text-2xl font-bold tabular-nums ${
                                    abjVal >= 95
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                }`}
                            >
                                {pe.abj ? `${abjVal.toFixed(1)}%` : '—'}
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Standar Kemenkes &ge; 95%
                        </p>
                    </div>

                    <div className="space-y-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3">
                        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            House Index (HI)
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-mono text-2xl font-bold text-foreground tabular-nums">
                                {pe.houseIndex ? `${hiVal.toFixed(1)}%` : '—'}
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Rumah positif jentik
                        </p>
                    </div>

                    <div className="space-y-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3">
                        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            Container Index (CI)
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-mono text-2xl font-bold text-foreground tabular-nums">
                                {pe.containerIndex
                                    ? `${ciVal.toFixed(1)}%`
                                    : '—'}
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Kontainer positif jentik
                        </p>
                    </div>

                    <div className="space-y-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3">
                        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            Breteau Index (BI)
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-mono text-2xl font-bold text-foreground tabular-nums">
                                {pe.breteauIndex ? `${biVal.toFixed(1)}%` : '—'}
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Kontainer (+) per 100 rmh
                        </p>
                    </div>

                    <div className="space-y-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3">
                        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            Rumah Diperiksa
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-mono text-2xl font-bold text-foreground tabular-nums">
                                {pe.housesInspected ?? 0}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                / {pe.housesPositive ?? 0} (+)
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Radius 100m (min. 20)
                        </p>
                    </div>

                    <div className="space-y-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3">
                        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            Demam Lain (100m)
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span
                                className={`font-mono text-2xl font-bold tabular-nums ${
                                    (pe.otherFeverCasesCount ?? 0) > 0
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : 'text-foreground'
                                }`}
                            >
                                {pe.otherFeverCasesCount ?? 0}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                orang
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Penderita demam sekitar
                        </p>
                    </div>
                </div>

                {/* Section 1: Data Responden, Pasien & Petugas */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Panel
                        padded
                        title={
                            <span className="flex items-center gap-2">
                                <User
                                    className="size-4 text-[var(--accent)]"
                                    aria-hidden
                                />
                                Data Responden & Lingkungan Domisili
                            </span>
                        }
                    >
                        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                            <Field
                                label="Nama Responden"
                                value={pe.respondentName}
                            />
                            <Field
                                label="Hubungan dengan Kasus"
                                value={pe.respondentRelation}
                            />
                            <Field
                                label="Usia Responden"
                                value={
                                    formData.respondentAge
                                        ? `${formData.respondentAge} Tahun`
                                        : undefined
                                }
                            />
                            <Field
                                label="Pekerjaan Responden"
                                value={formData.respondentJob}
                            />
                            <Field
                                label="Alamat Responden"
                                value={formData.respondentAddress}
                            />
                            <Field
                                label="Rukun Tetangga / RW"
                                value={
                                    pe.rt || pe.rw
                                        ? `RT ${pe.rt || '-'} / RW ${pe.rw || '-'}`
                                        : '—'
                                }
                            />
                            <Field
                                label="Pekerjaan Pasien"
                                value={formData.patientJob}
                            />
                            <Field
                                label="Riwayat Perjalanan 14 Hari"
                                value={
                                    pe.travelHistory14d ||
                                    'Tidak ada riwayat bepergian'
                                }
                            />
                        </dl>
                    </Panel>

                    <Panel
                        padded
                        title={
                            <span className="flex items-center gap-2">
                                <Home
                                    className="size-4 text-[var(--accent)]"
                                    aria-hidden
                                />
                                Informasi Petugas & Puskesmas
                            </span>
                        }
                    >
                        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                            <Field
                                label="Nama Petugas PE"
                                value={pe.officerName}
                            />
                            <Field
                                label="NIP Petugas"
                                value={pe.officerNip}
                                mono
                            />
                            <Field
                                label="Kepala Puskesmas"
                                value={pe.headOfPuskesmasName}
                            />
                            <Field
                                label="NIP Kepala Puskesmas"
                                value={pe.headOfPuskesmasNip}
                                mono
                            />
                            <Field
                                label="Tanggal Penyelidikan"
                                value={formatDate(pe.peDate)}
                            />
                            <Field
                                label="Lokasi Penyelidikan"
                                value={
                                    pe.sourceLocation ||
                                    'Rumah / Domisili Penderita'
                                }
                            />
                            <Field
                                label="Ada Penderita DBD Lain di Sekitar?"
                                value={
                                    formData.hasOtherDenguePatients
                                        ? 'Ya, Ada penderita lain'
                                        : 'Tidak ada'
                                }
                            />
                            <Field
                                label="Jumlah Penderita Demam di Sekitar"
                                value={`${pe.otherFeverCasesCount ?? 0} Orang`}
                            />
                        </dl>
                    </Panel>
                </div>

                {/* Section 2: Konfirmasi Klinis & Hasil Laboratorium saat PE */}
                <Panel
                    padded
                    title={
                        <span className="flex items-center gap-2">
                            <Stethoscope
                                className="size-4 text-[var(--accent)]"
                                aria-hidden
                            />
                            Gejala Klinis & Pemeriksaan Laboratorium Tambahan
                            Lapangan
                        </span>
                    }
                    subtitle="Parameter laboratorium dan gejala pasien yang diverifikasi petugas saat PE di lapangan."
                >
                    <div className="space-y-4">
                        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                            <Field
                                label="Tanggal Mulai Sakit (Demam)"
                                value={
                                    formData.symptomOnsetDate
                                        ? formatDate(
                                              new Date(
                                                  formData.symptomOnsetDate,
                                              ),
                                          )
                                        : undefined
                                }
                            />
                            <Field
                                label="Keluhan Utama"
                                value={formData.mainComplaint}
                            />
                            <Field
                                label="Tindakan Pertama Berobat"
                                value={formData.firstActionTaken}
                            />
                            <Field
                                label="Riwayat Infeksi DBD"
                                value={
                                    formData.dengueAttackOrder
                                        ? `Infeksi ke-${formData.dengueAttackOrder}`
                                        : undefined
                                }
                            />
                            <Field
                                label="Penyakit Penyerta (Komorbid)"
                                value={formData.comorbidity || 'Tidak ada'}
                            />
                            <Field
                                label="Pengobatan / Tindakan"
                                value={
                                    formData.treatmentGiven ||
                                    'Rawat Inap / Observasi'
                                }
                            />
                        </dl>

                        {/* Gejala Klinis Badges */}
                        <div className="space-y-2 border-t border-[var(--border)] pt-3.5">
                            <span className="block text-[11.5px] font-medium text-muted-foreground">
                                Gejala Klinis Terkonfirmasi:
                            </span>
                            {formData.clinicalSymptoms &&
                            formData.clinicalSymptoms.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {formData.clinicalSymptoms.map(
                                        (symptom) => (
                                            <span
                                                key={symptom}
                                                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-foreground"
                                            >
                                                <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                                                {symptom}
                                            </span>
                                        ),
                                    )}
                                </div>
                            ) : (
                                <span className="text-xs text-muted-foreground italic">
                                    Tidak ada gejala spesifik tercatat.
                                </span>
                            )}
                        </div>

                        {/* Lab Results Grid */}
                        <div className="border-t border-[var(--border)] pt-3.5">
                            <span className="mb-2.5 block text-[11.5px] font-medium text-muted-foreground">
                                Hasil Pemeriksaan Laboratorium saat Investigasi:
                            </span>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                                <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-2.5 text-center">
                                    <span className="block text-[11px] text-muted-foreground">
                                        RDT NS1
                                    </span>
                                    <span
                                        className={`text-xs font-bold ${
                                            formData.labRdtNs1 === 'POSITIF'
                                                ? 'text-rose-600 dark:text-rose-400'
                                                : formData.labRdtNs1 ===
                                                    'NEGATIF'
                                                  ? 'text-emerald-600 dark:text-emerald-400'
                                                  : 'text-muted-foreground'
                                        }`}
                                    >
                                        {formData.labRdtNs1 ??
                                            'Belum Diperiksa'}
                                    </span>
                                </div>
                                <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-2.5 text-center">
                                    <span className="block text-[11px] text-muted-foreground">
                                        Antibodi IgM
                                    </span>
                                    <span
                                        className={`text-xs font-bold ${
                                            formData.labIgm === 'POSITIF'
                                                ? 'text-rose-600 dark:text-rose-400'
                                                : formData.labIgm === 'NEGATIF'
                                                  ? 'text-emerald-600 dark:text-emerald-400'
                                                  : 'text-muted-foreground'
                                        }`}
                                    >
                                        {formData.labIgm ?? 'Belum Diperiksa'}
                                    </span>
                                </div>
                                <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-2.5 text-center">
                                    <span className="block text-[11px] text-muted-foreground">
                                        Antibodi IgG
                                    </span>
                                    <span
                                        className={`text-xs font-bold ${
                                            formData.labIgg === 'POSITIF'
                                                ? 'text-amber-600 dark:text-amber-400'
                                                : formData.labIgg === 'NEGATIF'
                                                  ? 'text-emerald-600 dark:text-emerald-400'
                                                  : 'text-muted-foreground'
                                        }`}
                                    >
                                        {formData.labIgg ?? 'Belum Diperiksa'}
                                    </span>
                                </div>
                                <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-2.5 text-center">
                                    <span className="block text-[11px] text-muted-foreground">
                                        Trombosit
                                    </span>
                                    <span className="font-mono text-xs font-bold text-foreground">
                                        {formData.labPlatelet
                                            ? `${formData.labPlatelet.toLocaleString('id-ID')} /µL`
                                            : '—'}
                                    </span>
                                </div>
                                <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-2.5 text-center">
                                    <span className="block text-[11px] text-muted-foreground">
                                        Hematokrit
                                    </span>
                                    <span className="font-mono text-xs font-bold text-foreground">
                                        {formData.labHematocrit
                                            ? `${formData.labHematocrit}%`
                                            : '—'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </Panel>

                {/* Section 3: Upload & Lampiran Dokumen PE dan Foto Lapangan */}
                <Panel
                    title="Dokumen & Foto Lapangan PE"
                    subtitle="Unggah dokumen formulir PE bertandatangan (PDF) dan foto-foto dokumentasi surveilans lapangan / jentik."
                >
                    <div className="p-4 sm:p-5">
                        <AttachmentDropzone
                            reportPEId={pe.id}
                            reportRSId={detail.reportRSId}
                            title="Unggah Dokumen PE atau Foto Dokumentasi Lapangan"
                            subtitle="PDF formulir PE bertandatangan, foto jentik, atau foto lingkungan radius 100m (maks 10 MB)"
                        />
                    </div>
                </Panel>

                {/* Section 4: Table of Surveyed Households (Survei Jentik Rumah Tangga 100m) */}
                <Panel
                    title={`Hasil Pemeriksaan Jentik (${detail.households.length} Rumah)`}
                    subtitle="Daftar lengkap pemeriksaan jentik per rumah tangga dalam radius 100 meter dari domisili kasus."
                >
                    {detail.households.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                            Tidak ada data survei jentik individual tersimpan
                            untuk PE ini.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b border-[var(--border)] bg-muted/30 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                                    <tr>
                                        <th className="px-3.5 py-2.5">No</th>
                                        <th className="px-3.5 py-2.5">
                                            Alamat / Kepala Keluarga
                                        </th>
                                        <th className="px-3.5 py-2.5 text-right">
                                            Jiwa
                                        </th>
                                        <th className="px-3.5 py-2.5 text-right">
                                            Jml Jentik
                                        </th>
                                        <th className="px-3.5 py-2.5">
                                            Tipe Jentik
                                        </th>
                                        <th className="px-3.5 py-2.5">
                                            Bubuk Abate
                                        </th>
                                        <th className="px-3.5 py-2.5 text-center">
                                            Status
                                        </th>
                                        <th className="px-3.5 py-2.5">
                                            Catatan
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {detail.households.map((h, i) => {
                                        const hasLarva =
                                            (h.larvaCount ?? 0) > 0;
                                        return (
                                            <tr
                                                key={h.id || i}
                                                className="hover:bg-muted/20"
                                            >
                                                <td className="px-3.5 py-2.5 font-mono text-muted-foreground">
                                                    {i + 1}
                                                </td>
                                                <td className="px-3.5 py-2.5 font-medium text-foreground">
                                                    {h.address ||
                                                        `Rumah #${i + 1}`}
                                                </td>
                                                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                                                    {h.population ?? '—'}
                                                </td>
                                                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                                                    <span
                                                        className={
                                                            (h.larvaCount ??
                                                                0) > 0
                                                                ? 'font-bold text-rose-600 dark:text-rose-400'
                                                                : 'text-muted-foreground'
                                                        }
                                                    >
                                                        {h.larvaCount ?? 0}
                                                    </span>
                                                </td>
                                                <td className="px-3.5 py-2.5">
                                                    <span className="text-muted-foreground">
                                                        {h.larvaType || 'Aedes'}
                                                    </span>
                                                </td>
                                                <td className="px-3.5 py-2.5">
                                                    <span
                                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                                                            h.abateUsed
                                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                                                : 'bg-muted text-muted-foreground'
                                                        }`}
                                                    >
                                                        {h.abateUsed
                                                            ? 'Diberikan'
                                                            : 'Tidak'}
                                                    </span>
                                                </td>
                                                <td className="px-3.5 py-2.5 text-center">
                                                    <span
                                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                                                            hasLarva
                                                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                                                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                                        }`}
                                                    >
                                                        {hasLarva
                                                            ? 'Positif Jentik'
                                                            : 'Bebas Jentik'}
                                                    </span>
                                                </td>
                                                <td className="px-3.5 py-2.5 text-muted-foreground">
                                                    {h.notes || '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>
            </PageContent>
        </PageBody>
    );
}
