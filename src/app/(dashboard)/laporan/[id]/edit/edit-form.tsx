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

export function EditReportForm({
    report,
    kelurahanOptions,
}: {
    report: ReportDetail;
    kelurahanOptions: KelurahanOption[];
}) {
    const router = useRouter();
    const [isSaving, startSave] = useTransition();
    const [isSending, startSend] = useTransition();
    const [formError, setFormError] = useState<string | null>(null);

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

    const handleSave = (formData: FormData) => {
        setFormError(null);
        startSave(async () => {
            const res = await updateDraftReportAction(report.id, formData);
            if (res.ok) {
                toast.success('Draf laporan berhasil diperbarui');
                router.push(`/laporan/${report.id}`);
            } else {
                setFormError(res.error || 'Gagal menyimpan perubahan');
                toast.error(res.error || 'Gagal menyimpan perubahan');
            }
        });
    };

    const handleSaveAndSend = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formEl = e.currentTarget;
        const formData = new FormData(formEl);

        setFormError(null);
        startSend(async () => {
            const updateRes = await updateDraftReportAction(report.id, formData);
            if (!updateRes.ok) {
                setFormError(updateRes.error || 'Gagal menyimpan data');
                toast.error(updateRes.error || 'Gagal menyimpan data');
                return;
            }

            const sendRes = await submitDraftReportAction(report.id);
            if (sendRes.ok) {
                toast.success('Laporan berhasil diperbarui dan dikirim ke surveilans!');
                router.push(`/laporan/${report.id}`);
            } else {
                setFormError(sendRes.error || 'Gagal mengirim laporan');
                toast.error(sendRes.error || 'Gagal mengirim laporan');
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
        <form onSubmit={handleSaveAndSend} className="space-y-6">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="patientName">Nama Lengkap Pasien *</Label>
                        <Input
                            id="patientName"
                            name="patientName"
                            defaultValue={report.patient.name}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="patientNik">NIK Pasien (16 digit) *</Label>
                        <Input
                            id="patientNik"
                            name="patientNik"
                            defaultValue={report.patient.nik}
                            maxLength={16}
                            required
                        />
                    </div>

                    <div className="space-y-1.5 sm:col-span-3">
                        <Label htmlFor="patientAddress">Alamat Lengkap Domisili *</Label>
                        <Input
                            id="patientAddress"
                            name="patientAddress"
                            defaultValue={report.patient.address}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="patientAge">Usia Pasien (Tahun) *</Label>
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
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="phoneNumber">Nomor Telepon / WhatsApp</Label>
                        <Input
                            id="phoneNumber"
                            name="phoneNumber"
                            defaultValue={report.patient.phone === '—' ? '' : report.patient.phone}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="kelurahan">Kelurahan *</Label>
                        <div className="relative">
                            <select
                                id="kelurahan"
                                name="kelurahan"
                                value={kelurahan}
                                onChange={(e) => handleKelurahanChange(e.target.value)}
                                className="h-9 w-full appearance-none rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-foreground outline-none focus-visible:border-[var(--accent)] font-medium"
                            >
                                <option value="">Pilih Kelurahan...</option>
                                {kelurahanOptions.map((k) => (
                                    <option key={k.name} value={k.name}>
                                        {k.name} ({k.kecamatan})
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="caseType">Diagnosis Kasus *</Label>
                        <div className="relative">
                            <select
                                id="caseType"
                                name="caseType"
                                defaultValue={report.caseType}
                                className="h-9 w-full appearance-none rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-foreground outline-none focus-visible:border-[var(--accent)] font-medium"
                            >
                                <option value="DENGUE">Dengue Fever (DF / Demam Dengue)</option>
                                <option value="DHF">DHF (Demam Berdarah Dengue / DBD)</option>
                                <option value="DSS">DSS (Dengue Shock Syndrome)</option>
                                <option value="SUSPECTED_DENGUE">Suspek Dengue</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="admissionDate">Tanggal Masuk Rawat *</Label>
                        <Input
                            id="admissionDate"
                            name="admissionDate"
                            type="date"
                            defaultValue={toInputDate(report.admissionDate)}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="symptomOnsetDate">Tanggal Onset Gejala</Label>
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
                        <Label htmlFor="plateletCount">Trombosit Terakhir (sel/µL)</Label>
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
                                defaultValue={report.dengueBlot ?? 'TIDAK_DIPERIKSA'}
                                className="h-9 w-full appearance-none rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-foreground outline-none focus-visible:border-[var(--accent)]"
                            >
                                <option value="TIDAK_DIPERIKSA">Tidak Diperiksa</option>
                                <option value="POSITIF">Positif (+)</option>
                                <option value="NEGATIF">Negatif (-)</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
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
                                <option value="TIDAK_DIPERIKSA">Tidak Diperiksa</option>
                                <option value="POSITIF">Positif (+)</option>
                                <option value="NEGATIF">Negatif (-)</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        </div>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                        <Label htmlFor="diagnosis">Catatan Diagnosis / Komplikasi</Label>
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

            {/* Bottom Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Button asChild variant="ghost" size="sm">
                    <Link href={`/laporan/${report.id}`}>Batal</Link>
                </Button>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isSaving || isSending}
                        onClick={(e) => {
                            const form = e.currentTarget.closest('form');
                            if (form) {
                                handleSave(new FormData(form));
                            }
                        }}
                        className="gap-1.5 text-xs font-medium"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="size-3.5 animate-spin" />
                                <span>Menyimpan Perubahan…</span>
                            </>
                        ) : (
                            <>
                                <Save className="size-3.5" />
                                <span>Simpan Perubahan Draf</span>
                            </>
                        )}
                    </Button>

                    <Button
                        type="submit"
                        disabled={isSaving || isSending}
                        className="gap-1.5 text-xs font-semibold bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90 shadow-xs"
                    >
                        {isSending ? (
                            <>
                                <Loader2 className="size-3.5 animate-spin" />
                                <span>Mengirimkan…</span>
                            </>
                        ) : (
                            <>
                                <Send className="size-3.5" />
                                <span>Simpan & Kirim Sekarang</span>
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </form>
    );
}
