import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/lib/session';
import { getReport } from '@/lib/domain/report-detail';
import { CASE_TYPE_LABEL, STATUS_LABEL } from '@/lib/domain/reports';
import { formatDate } from '@/lib/format';
import { ReportAction } from './report-action';
import { Field } from './field';
import { AttachmentDropzone } from '@/components/reports/attachment-dropzone';

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

    const canReview =
        actor.role === 'PUSKESMAS' &&
        report.status === 'ASSIGNED' &&
        report.assignedPuskesmasId === actor.institutionId;
    const canVerify =
        actor.role === 'DINKES' && report.status === 'PE_COMPLETED';

    return (
        <div className="px-[var(--pad)] py-8">
            <Link
                href="/laporan"
                className="text-[13px] text-muted-foreground underline"
            >
                Laporan
            </Link>

            <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1
                        data-numeric
                        className="text-[24px] font-medium tracking-tight"
                    >
                        {report.reportNumber}
                    </h1>
                    <p className="mt-1 text-[14px] text-muted-foreground">
                        {STATUS_LABEL[report.status]} ·{' '}
                        {CASE_TYPE_LABEL[report.caseType] ?? report.caseType}
                    </p>
                </div>
                {(canReview || canVerify) && (
                    <div className="flex gap-2">
                        {canReview && (
                            <>
                                <ReportAction
                                    id={id}
                                    transition="ACCEPT"
                                    label="Terima"
                                    primary
                                />
                                <ReportAction
                                    id={id}
                                    transition="REJECT"
                                    label="Tolak"
                                />
                            </>
                        )}
                        {canVerify && (
                            <>
                                <ReportAction
                                    id={id}
                                    transition="VERIFY"
                                    label="Verifikasi"
                                    primary
                                />
                                <ReportAction
                                    id={id}
                                    transition="REJECT_BY_DINKES"
                                    label="Kembalikan"
                                />
                            </>
                        )}
                    </div>
                )}
            </header>

            <section className="mt-8">
                <h2 className="text-[16px] font-medium">Pasien</h2>
                <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Nama" value={report.patient.name} />
                    <Field label="NIK" value={report.patient.nik} numeric />
                    <Field
                        label="Umur"
                        value={`${report.patient.age} tahun`}
                        numeric
                    />
                    <Field
                        label="Jenis kelamin"
                        value={
                            report.patient.gender === 'L'
                                ? 'Laki-laki'
                                : 'Perempuan'
                        }
                    />
                    <Field label="Alamat" value={report.patient.address} wide />
                </dl>
            </section>

            <section className="mt-10">
                <h2 className="text-[16px] font-medium">Wilayah & rujukan</h2>
                <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Kelurahan" value={report.kelurahan ?? '—'} />
                    <Field label="Kecamatan" value={report.kecamatan ?? '—'} />
                    <Field label="Kota" value={report.kota ?? '—'} />
                    <Field
                        label="Fasilitas pelapor"
                        value={report.institutionName ?? '—'}
                    />
                    <Field
                        label="Puskesmas tujuan"
                        value={
                            report.assignedPuskesmasName ?? 'Belum ditugaskan'
                        }
                    />
                </dl>
            </section>

            <section className="mt-10">
                <h2 className="text-[16px] font-medium">Klinis</h2>
                <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field
                        label="Tanggal masuk"
                        value={formatDate(report.admissionDate)}
                        numeric
                    />
                    <Field
                        label="Tanggal diagnosis"
                        value={
                            report.diagnosisDate
                                ? formatDate(report.diagnosisDate)
                                : '—'
                        }
                        numeric
                    />
                    <Field
                        label="Trombosit"
                        value={
                            report.plateletCount?.toLocaleString('id-ID') ?? '—'
                        }
                        numeric
                    />
                    <Field
                        label="Hematokrit"
                        value={report.hematocrit ?? '—'}
                        numeric
                    />
                    <Field
                        label="Diagnosis"
                        value={report.diagnosis ?? '—'}
                        wide
                    />
                </dl>
            </section>

            <section className="mt-10">
                <h2 className="text-[16px] font-medium">Lampiran</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                    Hasil laboratorium atau dokumen pendukung.
                </p>
                <div className="mt-3 max-w-xl">
                    <AttachmentDropzone reportRSId={report.id} />
                </div>
            </section>

            {report.rejectionReason && (
                <section className="mt-10">
                    <h2 className="text-[16px] font-medium">
                        Alasan penolakan
                    </h2>
                    <p className="mt-2 text-[14px] text-[var(--negative)]">
                        {report.rejectionReason}
                    </p>
                </section>
            )}
        </div>
    );
}
