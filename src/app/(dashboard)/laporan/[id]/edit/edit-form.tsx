'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Activity,
    CheckCircle2,
    ChevronDown,
    Loader2,
    MapPin,
    Save,
    Send,
    Stethoscope,
    User,
} from 'lucide-react';
import { toast } from 'sonner';
import { Panel } from '@/components/shell/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateDraftReportAction, submitDraftReportAction } from '../actions';
import type { ReportDetail } from '@/lib/domain/report-detail';
import type { KelurahanOption } from '@/app/(dashboard)/laporan/baru/report-form';
import { cn } from '@/lib/utils';

export function EditReportForm({
    report,
    kelurahanOptions,
}: {
    report: ReportDetail;
    kelurahanOptions: KelurahanOption[];
}) {
    const router = useRouter();
    const [isSaving, startSave] = useTransition();
    const [formError, setFormError] = useState<string | null>(null);
    const [isDraftState, setIsDraftState] = useState(report.status === 'DRAFT');

    const [kelurahan, setKelurahan] = useState(report.kelurahan ?? '');
    const [kecamatan, setKecamatan] = useState(report.kecamatan ?? '');
    const [kota, setKota] = useState(report.kota ?? 'Kota Cirebon');
    const [provinsi, setProvinsi] = useState(report.provinsi ?? 'Jawa Barat');

    const handleKelurahanChange = (val: string) => {
        setKelurahan(val);
        const match = kelurahanOptions.find(
            (k) => k.name.toLowerCase() === val.toLowerCase(),
        );
        if (match) {
            setKecamatan(match.kecamatan);
            setKota(match.kota);
            setProvinsi(match.provinsi);
        }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formEl = e.currentTarget;
        const formData = new FormData(formEl);
        formData.set('isDraft', isDraftState ? 'true' : 'false');

        setFormError(null);
        startSave(async () => {
            const res = await updateDraftReportAction(report.id, formData);
            if (res.ok) {
                toast.success(
                    isDraftState
                        ? 'Laporan berhasil diperbarui dan disimpan sebagai draf.'
                        : 'Laporan berhasil diperbarui dan dikirim ke surveilans.',
                );
                router.push(`/laporan/${report.id}`);
            } else {
                setFormError(res.error || 'Gagal menyimpan perubahan');
                toast.error(res.error || 'Gagal menyimpan perubahan');
            }
        });
    };

    const toInputDate = (d: Date | null | undefined) => {
        if (!d) return '';
        try {
            return new Date(d).toISOString().split('T')[0] ?? '';
        } catch {
            return '';
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {formError && (
                <div className="rounded-[var(--radius-control)] border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-400">
                    {formError}
                </div>
            )}

            {/* Bagian 1: Identitas Pasien */}
            <Panel
                padded
                title={
                    <span className="flex items-center gap-2">
                        <User className="size-4 text-[var(--accent)]" />
                        <span>Identitas Pasien Terlindungi (PII)</span>
                    </span>
                }
            >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="patientName">
                            Nama Lengkap Pasien *
                        </Label>
                        <Input
                            id="patientName"
                            name="patientName"
                            defaultValue={report.patient.name}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="patientNik">
                            NIK Pasien (16 digit) *
                        </Label>
                        <Input
                            id="patientNik"
                            name="patientNik"
                            defaultValue={report.patient.nik}
                            maxLength={16}
                            required
                        />
                    </div>

                    <div className="space-y-1.5 sm:col-span-3">
                        <Label htmlFor="patientAddress">
                            Alamat Lengkap Domisili *
                        </Label>
                        <Input
                            id="patientAddress"
                            name="patientAddress"
                            defaultValue={report.patient.address}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="patientAge">
                            Usia Pasien (Tahun) *
                        </Label>
                        <Input
                            id="patientAge"
                            name="patientAge"
                            type="number"
                            min={0}
                            max={130}
                            defaultValue={report.patient.age}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="patientGender">Jenis Kelamin *</Label>
                        <div className="relative">
                            <select
                                id="patientGender"
                                name="patientGender"
                                defaultValue={report.patient.gender}
                                className="h-9 w-full appearance-none rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-foreground outline-none focus-visible:border-[var(--accent)]"
                            >
                                <option value="L">Laki-laki (L)</option>
                                <option value="P">Perempuan (P)</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="phoneNumber">
                            Nomor Telepon / WhatsApp
                        </Label>
                        <Input
                            id="phoneNumber"
                            name="phoneNumber"
                            defaultValue={
                                report.patient.phone === '—'
                                    ? ''
                                    : report.patient.phone
                            }
                            placeholder="Contoh: 08123456789"
                        />
                    </div>
                </div>
            </Panel>

            {/* Bagian 2: Wilayah & Lokasi */}
            <Panel
                padded
                title={
                    <span className="flex items-center gap-2">
                        <MapPin className="size-4 text-[var(--accent)]" />
                        <span>Wilayah & Domisili Penugasan PE</span>
                    </span>
                }
            >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="kelurahan">Kelurahan *</Label>
                        <div className="relative">
                            <select
                                id="kelurahan"
                                name="kelurahan"
                                value={kelurahan}
                                onChange={(e) =>
                                    handleKelurahanChange(e.target.value)
                                }
                                className="h-9 w-full appearance-none rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-foreground outline-none focus-visible:border-[var(--accent)]"
                            >
                                <option value="">Pilih Kelurahan...</option>
                                {kelurahanOptions.map((k) => (
                                    <option key={k.name} value={k.name}>
                                        {k.name} ({k.kecamatan})
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="kecamatan">Kecamatan *</Label>
                        <Input
                            id="kecamatan"
                            name="kecamatan"
                            value={kecamatan}
                            onChange={(e) => setKecamatan(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="kota">Kota / Kabupaten *</Label>
                        <Input
                            id="kota"
                            name="kota"
                            value={kota}
                            onChange={(e) => setKota(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="provinsi">Provinsi *</Label>
                        <Input
                            id="provinsi"
                            name="provinsi"
                            value={provinsi}
                            onChange={(e) => setProvinsi(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="rt">RT</Label>
                        <Input
                            id="rt"
                            name="rt"
                            defaultValue={report.rt ?? ''}
                            placeholder="Contoh: 003"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="rw">RW</Label>
                        <Input
                            id="rw"
                            name="rw"
                            defaultValue={report.rw ?? ''}
                            placeholder="Contoh: 005"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="latitude">Latitude (Opsional)</Label>
                        <Input
                            id="latitude"
                            name="latitude"
                            defaultValue={report.latitude ?? ''}
                            placeholder="-6.72145"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="longitude">Longitude (Opsional)</Label>
                        <Input
                            id="longitude"
                            name="longitude"
                            defaultValue={report.longitude ?? ''}
                            placeholder="108.556"
                        />
                    </div>
                </div>
            </Panel>

            {/* Bagian 3: Klinis & Laboratorium */}
            <Panel
                padded
                title={
                    <span className="flex items-center gap-2">
                        <Stethoscope className="size-4 text-[var(--accent)]" />
                        <span>Klinis & Parameter Laboratorium</span>
                    </span>
                }
            >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="caseType">Diagnosis Kasus *</Label>
                        <div className="relative">
                            <select
                                id="caseType"
                                name="caseType"
                                defaultValue={report.caseType}
                                className="h-9 w-full appearance-none rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-foreground outline-none focus-visible:border-[var(--accent)]"
                            >
                                <option value="DENGUE">
                                    Dengue Fever (DF / Demam Dengue)
                                </option>
                                <option value="DHF">
                                    DHF (Demam Berdarah Dengue / DBD)
                                </option>
                                <option value="DSS">
                                    DSS (Dengue Shock Syndrome)
                                </option>
                                <option value="SUSPECTED_DENGUE">
                                    Suspek Dengue
                                </option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="admissionDate">
                            Tanggal Masuk Rawat *
                        </Label>
                        <Input
                            id="admissionDate"
                            name="admissionDate"
                            type="date"
                            defaultValue={toInputDate(report.admissionDate)}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="symptomOnsetDate">
                            Tanggal Onset Gejala
                        </Label>
                        <Input
                            id="symptomOnsetDate"
                            name="symptomOnsetDate"
                            type="date"
                            defaultValue={toInputDate(report.symptomOnsetDate)}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="diagnosisDate">Tanggal Diagnosis</Label>
                        <Input
                            id="diagnosisDate"
                            name="diagnosisDate"
                            type="date"
                            defaultValue={toInputDate(report.diagnosisDate)}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="plateletCount">
                            Trombosit Terakhir (sel/µL)
                        </Label>
                        <Input
                            id="plateletCount"
                            name="plateletCount"
                            type="number"
                            min={0}
                            max={2000000}
                            defaultValue={report.plateletCount ?? ''}
                            placeholder="Contoh: 85000"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="hematocrit">Hematokrit (%)</Label>
                        <Input
                            id="hematocrit"
                            name="hematocrit"
                            type="number"
                            step="0.1"
                            min={0}
                            max={100}
                            defaultValue={report.hematocrit ?? ''}
                            placeholder="Contoh: 42.5"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="ns1Result">NS1 Rapid Test</Label>
                        <div className="relative">
                            <select
                                id="ns1Result"
                                name="ns1Result"
                                defaultValue={
                                    report.dengueBlot ?? 'TIDAK_DIPERIKSA'
                                }
                                className="h-9 w-full appearance-none rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-foreground outline-none focus-visible:border-[var(--accent)]"
                            >
                                <option value="TIDAK_DIPERIKSA">
                                    Tidak Diperiksa
                                </option>
                                <option value="POSITIF">Positif (+)</option>
                                <option value="NEGATIF">Negatif (-)</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="igmResult">Serologi IgM</Label>
                        <div className="relative">
                            <select
                                id="igmResult"
                                name="igmResult"
                                defaultValue={report.igm ?? 'TIDAK_DIPERIKSA'}
                                className="h-9 w-full appearance-none rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-foreground outline-none focus-visible:border-[var(--accent)]"
                            >
                                <option value="TIDAK_DIPERIKSA">
                                    Tidak Diperiksa
                                </option>
                                <option value="POSITIF">Positif (+)</option>
                                <option value="NEGATIF">Negatif (-)</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        </div>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                        <Label htmlFor="diagnosis">
                            Catatan Diagnosis / Komplikasi
                        </Label>
                        <Textarea
                            id="diagnosis"
                            name="diagnosis"
                            rows={2}
                            defaultValue={report.diagnosis ?? ''}
                            placeholder="Catatan klinis tambahan, tanda bahaya (warning signs), atau komorbid..."
                        />
                    </div>
                </div>
            </Panel>

            {/* Bagian 4: Status Alur Laporan */}
            <Panel
                padded
                title={
                    <span className="flex items-center gap-2">
                        <CheckCircle2
                            className="size-4 text-[var(--accent)]"
                            aria-hidden
                        />
                        <span>Bagian 4: Status Alur Laporan</span>
                    </span>
                }
            >
                <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                        Pilih apakah laporan ini langsung diserahkan ke tim
                        surveilans (Puskesmas / Dinkes) atau disimpan sementara
                        sebagai Draf internal faskes Anda.
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setIsDraftState(false)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setIsDraftState(false);
                                }
                            }}
                            className={cn(
                                'flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border p-3.5 transition-colors',
                                !isDraftState
                                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-950 ring-1 ring-emerald-500/30 dark:text-emerald-100'
                                    : 'border-border bg-card/50 text-foreground hover:bg-muted/50',
                            )}
                        >
                            <input
                                type="radio"
                                name="statusChoice"
                                checked={!isDraftState}
                                onChange={() => setIsDraftState(false)}
                                className="mt-0.5 size-4 accent-emerald-600"
                            />
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-xs font-semibold">
                                    <Send className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span>Terkirim ke Surveilans (Aktif)</span>
                                </div>
                                <p className="text-[11px] leading-relaxed text-muted-foreground">
                                    Laporan terkirim ke sistem surveilans
                                    terpadu. Setelah terkirim, notifikasi
                                    WhatsApp otomatis dikirim sesuai wilayah
                                    laporan ke Puskesmas terkait dan Dinkes
                                    untuk verifikasi serta penugasan PE.
                                </p>
                            </div>
                        </div>

                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setIsDraftState(true)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setIsDraftState(true);
                                }
                            }}
                            className={cn(
                                'flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border p-3.5 transition-colors',
                                isDraftState
                                    ? 'border-amber-500 bg-amber-500/10 text-amber-950 ring-1 ring-amber-500/30 dark:text-amber-100'
                                    : 'border-border bg-card/50 text-foreground hover:bg-muted/50',
                            )}
                        >
                            <input
                                type="radio"
                                name="statusChoice"
                                checked={isDraftState}
                                onChange={() => setIsDraftState(true)}
                                className="mt-0.5 size-4 accent-amber-600"
                            />
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-xs font-semibold">
                                    <Save className="size-3.5 text-amber-600 dark:text-amber-400" />
                                    <span>Simpan sebagai Draf</span>
                                </div>
                                <p className="text-[11px] leading-relaxed text-muted-foreground">
                                    Hanya disimpan di faskes Anda. Belum
                                    diteruskan ke puskesmas wilayah atau dinas
                                    kesehatan hingga Anda mengirimkannya.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </Panel>

            {/* Bottom Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Button asChild variant="ghost" size="sm">
                    <Link href={`/laporan/${report.id}`}>Batal</Link>
                </Button>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="submit"
                        disabled={isSaving}
                        className={cn(
                            'gap-1.5 text-xs font-semibold shadow-xs',
                            isDraftState
                                ? 'bg-amber-600 text-white hover:bg-amber-700'
                                : 'bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90',
                        )}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="size-3.5 animate-spin" />
                                <span>Menyimpan Perubahan…</span>
                            </>
                        ) : isDraftState ? (
                            <>
                                <Save className="size-3.5" />
                                <span>Simpan sebagai Draf</span>
                            </>
                        ) : (
                            <>
                                <Send className="size-3.5" />
                                <span>Simpan & Kirim ke Surveilans</span>
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </form>
    );
}
