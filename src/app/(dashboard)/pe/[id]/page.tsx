import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
    Activity,
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    ClipboardCheck,
    FileDown,
    FileSpreadsheet,
    FileText,
    Home,
    MapPin,
    Pencil,
    ShieldAlert,
    ShieldCheck,
    User,
    Users,
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
            <dt className="text-[11.5px] font-medium text-muted-foreground">{label}</dt>
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
    const canManage =
        actor.role === 'ADMIN' ||
        actor.role === 'DINKES' ||
        actor.institutionId === pe.institutionId;

    const abjVal = Number(pe.abj ?? 0);
    const hiVal = Number(pe.houseIndex ?? 0);
    const ciVal = Number(pe.containerIndex ?? 0);
    const isFogging = pe.foggingRecommended;

    return (
        <PageBody>
            <PageHeader
                title={`Detail Penyelidikan Epidemiologi (PE)`}
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
                        <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                            <Link href={`/laporan/${detail.reportRSId}`}>
                                <ArrowLeft className="size-3.5" aria-hidden />
                                Lihat Laporan Kasus
                            </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                            <Link href={`/api/pdf/pe-lengkap/${pe.id}`} target="_blank">
                                <FileText className="size-3.5 text-rose-600" aria-hidden />
                                Dokumen PDF Kemenkes
                            </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                            <Link href={`/api/export/pe/${pe.id}/excel`} target="_blank">
                                <FileSpreadsheet className="size-3.5 text-emerald-600" aria-hidden />
                                Unduh Excel
                            </Link>
                        </Button>
                        {canManage && (
                            <PeActionToolbar
                                peId={pe.id}
                                reportNumber={detail.reportNumber}
                            />
                        )}
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div
                                className={`mt-0.5 rounded-full p-1.5 shrink-0 ${
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
                                    Hasil Investigasi:{' '}
                                    <span
                                        className={
                                            isFogging
                                                ? 'text-rose-700 dark:text-rose-400'
                                                : 'text-emerald-700 dark:text-emerald-400'
                                        }
                                    >
                                        {isFogging
                                            ? 'Positif Penularan · Rekomendasi Fogging Fokus'
                                            : 'Negatif Penularan · PSN 3M Plus & Larvasidasi'}
                                    </span>
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                    {pe.conclusion ||
                                        (isFogging
                                            ? 'Ditemukan jentik positif atau penderita demam lain di radius 100m. Diperlukan fogging fokus 2 siklus dan larvasidasi serentak.'
                                            : 'Tidak ditemukan bukti penularan aktif setempat. Dilakukan penyuluhan 3M Plus dan pemantauan berkala.')}
                                </p>
                            </div>
                        </div>
                        {pe.recommendation && (
                            <div className="sm:text-right shrink-0">
                                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground block">
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
                    <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3 space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
                        <p className="text-[10px] text-muted-foreground">Standar Kemenkes &ge; 95%</p>
                    </div>

                    <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3 space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            House Index (HI)
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-mono text-2xl font-bold text-foreground tabular-nums">
                                {pe.houseIndex ? `${hiVal.toFixed(1)}%` : '—'}
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Rumah positif jentik</p>
                    </div>

                    <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3 space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Container Index (CI)
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-mono text-2xl font-bold text-foreground tabular-nums">
                                {pe.containerIndex ? `${ciVal.toFixed(1)}%` : '—'}
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Kontainer positif jentik</p>
                    </div>

                    <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3 space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
                        <p className="text-[10px] text-muted-foreground">Radius 100m (min. 20)</p>
                    </div>

                    <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3 space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Kontainer Diperiksa
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-mono text-2xl font-bold text-foreground tabular-nums">
                                {pe.containersInspected ?? 0}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                / {pe.containersPositive ?? 0} (+)
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">TPA dalam & luar</p>
                    </div>

                    <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3 space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Kasus Demam Lain
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
                            <span className="text-xs text-muted-foreground">orang</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Di sekitar radius 100m</p>
                    </div>
                </div>

                {/* 2-Column: Info Petugas & Responden */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Panel
                        padded
                        title={
                            <span className="flex items-center gap-2">
                                <User className="size-4 text-[var(--accent)]" aria-hidden />
                                Informasi Petugas Lapangan
                            </span>
                        }
                    >
                        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                            <Field label="Nama Petugas PE" value={pe.officerName} />
                            <Field label="NIP Petugas" value={pe.officerNip} mono />
                            <Field label="Kepala Puskesmas" value={pe.headOfPuskesmasName} />
                            <Field label="NIP Kepala Puskesmas" value={pe.headOfPuskesmasNip} mono />
                            <Field label="Tanggal Penyelidikan" value={formatDate(pe.peDate)} />
                            <Field label="Sumber Lokasi" value={pe.sourceLocation || 'Rumah / Domisili Penderita'} />
                        </dl>
                    </Panel>

                    <Panel
                        padded
                        title={
                            <span className="flex items-center gap-2">
                                <Home className="size-4 text-[var(--accent)]" aria-hidden />
                                Responden & Wilayah Lapangan
                            </span>
                        }
                    >
                        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                            <Field label="Nama Responden" value={pe.respondentName} />
                            <Field label="Hubungan dengan Kasus" value={pe.respondentRelation} />
                            <Field label="Rukun Tetangga (RT)" value={pe.rt ? `RT ${pe.rt}` : '—'} />
                            <Field label="Rukun Warga (RW)" value={pe.rw ? `RW ${pe.rw}` : '—'} />
                            <Field
                                label="Riwayat Perjalanan 14 Hari"
                                value={pe.travelHistory14d || 'Tidak ada riwayat bepergian'}
                            />
                            <Field
                                label="Penderita DBD Lain di Sekitar"
                                value={
                                    (pe.formData as { hasOtherDenguePatients?: boolean })?.hasOtherDenguePatients
                                        ? 'Ada penderita DBD lain'
                                        : 'Tidak ada'
                                }
                            />
                        </dl>
                    </Panel>
                </div>

                {/* Table of Surveyed Households (Survei Jentik Rumah Tangga 100m) */}
                <Panel
                    title={`Hasil Pemeriksaan Jentik (${detail.households.length} Rumah)`}
                    subtitle="Daftar pemeriksaan jentik per rumah tangga radius 100 meter dari kediaman penderita."
                >
                    {detail.households.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                            Tidak ada data survei jentik rumah tangga individual tersimpan untuk PE ini.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b border-[var(--border)] bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    <tr>
                                        <th className="px-3.5 py-2.5">No</th>
                                        <th className="px-3.5 py-2.5">Alamat / Kepala Keluarga</th>
                                        <th className="px-3.5 py-2.5 text-right">Jml Jiwa</th>
                                        <th className="px-3.5 py-2.5 text-right">Jml Jentik</th>
                                        <th className="px-3.5 py-2.5">Tipe Jentik</th>
                                        <th className="px-3.5 py-2.5">Status Abate</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {detail.households.map((h, i) => (
                                        <tr key={h.id || i} className="hover:bg-muted/20">
                                            <td className="px-3.5 py-2.5 font-mono text-muted-foreground">
                                                {i + 1}
                                            </td>
                                            <td className="px-3.5 py-2.5 font-medium text-foreground">
                                                {h.address || `Rumah #${i + 1}`}
                                            </td>
                                            <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                                                {h.population ?? '—'}
                                            </td>
                                            <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">
                                                <span
                                                    className={
                                                        (h.larvaCount ?? 0) > 0
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
                                                    {h.abateUsed ? 'Diberikan Abate' : 'Tidak'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>
            </PageContent>
        </PageBody>
    );
}
