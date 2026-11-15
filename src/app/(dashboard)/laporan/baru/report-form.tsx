'use client';

import { useMemo, useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { NumericFormat, PatternFormat } from 'react-number-format';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
    Activity,
    AlertCircle,
    Building2,
    CheckCircle2,
    ChevronDown,
    Clock,
    Compass,
    Loader2,
    MapPin,
    Paperclip,
    Phone,
    Save,
    Search,
    Send,
    Stethoscope,
    User,
} from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod';
import { createReportSchema } from '@/lib/domain/form-contracts';
import { Panel } from '@/components/shell/page';
import { DateField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    StagedAttachmentPicker,
    uploadStagedAttachment,
    type StagedAttachment,
} from '@/components/reports/staged-attachment-picker';
import { cn } from '@/lib/utils';
import { submitReport, geocodePatientAddress } from './actions';
import {
    CASE_TYPES,
    ControllerField,
    Field,
    LAB_RESULT_OPTIONS,
    StepNavigator,
    SummarySidebar,
    type ChecklistItem,
    type FormValues,
    type KelurahanOption,
} from './form-fields';

export type { KelurahanOption };

const PatientLocationMap = dynamic(
    () => import('@/components/reports/patient-location-map'),
    {
        ssr: false,
        loading: () => (
            <div
                className="flex h-[260px] w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/60 text-sm text-muted-foreground"
                aria-busy
                role="status"
            >
                <Loader2 className="size-4 animate-spin text-[var(--accent)]" />
                <span>Memuat peta interaktif domisili…</span>
            </div>
        ),
    },
);

export function ReportForm({
    kelurahanOptions = [],
    sourceType = 'RS',
    actorRole,
    defaultAdmissionDate,
}: {
    kelurahanOptions?: KelurahanOption[];
    sourceType?: 'RS' | 'PUSKESMAS_POLI';
    actorRole?: string;
    defaultAdmissionDate?: string;
}) {
    const router = useRouter();
    const [submitting, start] = useTransition();
    const [uploadingAttachments, setUploadingAttachments] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [selectedPreset, setSelectedPreset] = useState('');
    const [gpsBusy, setGpsBusy] = useState(false);
    const [geocodingBusy, setGeocodingBusy] = useState(false);
    const [geocodeNotice, setGeocodeNotice] = useState<string | null>(null);
    const [skipGeotag, setSkipGeotag] = useState(false);
    const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);

    const {
        register,
        control,
        setValue,
        setError,
        handleSubmit,
        formState: { errors },
    } = useForm<FormValues, unknown, z.output<typeof createReportSchema>>({
        resolver: zodResolver(createReportSchema),
        mode: 'onTouched',
        defaultValues: {
            patientGender: 'L',
            caseType: 'DENGUE',
            sourceType,
            ns1Result: 'TIDAK_DIPERIKSA',
            igmResult: 'TIDAK_DIPERIKSA',
            iggResult: 'TIDAK_DIPERIKSA',
            admissionDate:
                defaultAdmissionDate ?? new Date().toISOString().split('T')[0],
        },
    });

    const watched = useWatch({ control });
    const nikDigits = (watched.patientNik ?? '').replace(/\D/g, '').length;
    const parsedLat = watched.latitude ? parseFloat(String(watched.latitude)) : null;
    const parsedLng = watched.longitude ? parseFloat(String(watched.longitude)) : null;

    const checklist = useMemo(() => {
        const items: ChecklistItem[] = [
            {
                key: 'name',
                label: 'Nama lengkap pasien (min. 3)',
                done: (watched.patientName ?? '').trim().length >= 3,
                sectionId: 'sec-identitas',
            },
            {
                key: 'nik',
                label: 'NIK 16 digit angka',
                done: /^\d{16}$/.test((watched.patientNik ?? '').trim()),
                sectionId: 'sec-identitas',
            },
            {
                key: 'age',
                label: 'Umur pasien terisi',
                done:
                    watched.patientAge !== undefined &&
                    watched.patientAge !== '' &&
                    !Number.isNaN(Number(watched.patientAge)),
                sectionId: 'sec-identitas',
            },
            {
                key: 'address',
                label: 'Alamat domisili lengkap',
                done: (watched.patientAddress ?? '').trim().length >= 5,
                sectionId: 'sec-domisili',
            },
            {
                key: 'kelurahan',
                label: 'Kelurahan & kecamatan',
                done: Boolean(
                    (watched.kelurahan ?? '').trim() &&
                        (watched.kecamatan ?? '').trim(),
                ),
                sectionId: 'sec-domisili',
            },
            {
                key: 'admission',
                label: 'Tanggal masuk / dirawat',
                done: Boolean(watched.admissionDate),
                sectionId: 'sec-klinis',
            },
            {
                key: 'caseType',
                label: 'Jenis kasus klinis dipilih',
                done: Boolean(watched.caseType),
                sectionId: 'sec-klinis',
            },
        ];

        const completed = items.filter((i) => i.done).length;
        return { items, completed, total: items.length };
    }, [
        watched.patientName,
        watched.patientNik,
        watched.patientAge,
        watched.patientAddress,
        watched.kelurahan,
        watched.kecamatan,
        watched.admissionDate,
        watched.caseType,
    ]);

    const pct = Math.round((checklist.completed / checklist.total) * 100);
    const steps = useMemo(
        () => [
            {
                id: 'sec-identitas',
                num: 1,
                label: 'Identitas Pasien',
                done:
                    checklist.items[0].done &&
                    checklist.items[1].done &&
                    checklist.items[2].done,
            },
            {
                id: 'sec-domisili',
                num: 2,
                label: 'Domisili & Peta',
                done: checklist.items[3].done && checklist.items[4].done,
            },
            {
                id: 'sec-klinis',
                num: 3,
                label: 'Klinis & Lab',
                done: checklist.items[5].done && checklist.items[6].done,
            },
            {
                id: 'sec-lampiran',
                num: 4,
                label: 'Lampiran Berkas',
                done: stagedAttachments.length > 0,
            },
        ],
        [checklist.items, stagedAttachments.length],
    );

    const applyKelurahanPreset = (idxStr: string) => {
        setSelectedPreset(idxStr);
        if (!idxStr) return;
        const opt = kelurahanOptions[Number(idxStr)];
        if (!opt) return;
        setValue('kelurahan', opt.name, { shouldValidate: true });
        setValue('kecamatan', opt.kecamatan, { shouldValidate: true });
        setValue('kota', opt.kota, { shouldValidate: true });
        setValue('provinsi', opt.provinsi, { shouldValidate: true });
    };

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            toast.error('Perangkat Anda tidak mendukung geolokasi GPS.');
            return;
        }
        setGpsBusy(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setSkipGeotag(false);
                setValue('latitude', pos.coords.latitude.toFixed(6), {
                    shouldValidate: true,
                });
                setValue('longitude', pos.coords.longitude.toFixed(6), {
                    shouldValidate: true,
                });
                setGpsBusy(false);
                setGeocodeNotice('Koordinat GPS perangkat berhasil disematkan.');
                toast.success('Koordinat GPS berhasil diambil dari perangkat.');
            },
            (err) => {
                setGpsBusy(false);
                toast.error(`Gagal mengambil koordinat: ${err.message}`);
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
        );
    };

    const handleSearchAddressCoords = async () => {
        const address = (watched.patientAddress ?? '').trim();
        const kelurahan = (watched.kelurahan ?? '').trim();
        const kecamatan = (watched.kecamatan ?? '').trim();
        const kota = (watched.kota ?? '').trim();

        if (!address && !kelurahan && !kecamatan) {
            toast.error(
                'Mohon isi alamat jalan atau pilih kelurahan/kecamatan terlebih dahulu.',
            );
            return;
        }

        setGeocodingBusy(true);
        setGeocodeNotice(null);

        try {
            const res = await geocodePatientAddress({
                address,
                kelurahan,
                kecamatan,
                kota,
            });

            if (res.ok && res.lat !== undefined && res.lng !== undefined) {
                setSkipGeotag(false);
                setValue('latitude', String(res.lat), { shouldValidate: true });
                setValue('longitude', String(res.lng), { shouldValidate: true });
                setGeocodeNotice(
                    res.isFallback
                        ? `Perkiraan kelurahan: ${res.displayName}`
                        : `Alamat terverifikasi: ${res.displayName}`,
                );
                toast.success('Koordinat geospasial berhasil ditemukan dari alamat.');
            } else {
                toast.error(
                    res.error ??
                        'Koordinat tidak ditemukan. Anda dapat menggunakan opsi Lewati Geotag di bawah.',
                );
            }
        } catch {
            toast.error('Terjadi gangguan saat mencari koordinat alamat.');
        } finally {
            setGeocodingBusy(false);
        }
    };

    const handleToggleSkipGeotag = (checked: boolean) => {
        setSkipGeotag(checked);
        if (checked) {
            setValue('latitude', '', { shouldValidate: true });
            setValue('longitude', '', { shouldValidate: true });
            setGeocodeNotice(null);
            toast.info(
                'Geotag dilewati. Koordinat dapat diisi saat Penyelidikan Epidemiologi (PE) di lapangan.',
            );
        }
    };

    const handleMapLocationSelect = (lat: number, lng: number) => {
        setValue('latitude', lat.toFixed(6), { shouldValidate: true });
        setValue('longitude', lng.toFixed(6), { shouldValidate: true });
        setSkipGeotag(false);
        setGeocodeNotice('Titik koordinat ditentukan dari peta interaktif.');
        toast.success('Koordinat diperbarui dari titik peta.');
    };

    const executeSubmit = (
        data: z.output<typeof createReportSchema>,
        isDraft = false,
    ) => {
        if (stagedAttachments.some((a) => a.status === 'compressing')) {
            toast.info('Mohon tunggu hingga kompresi gambar selesai sebelum mengirim.');
            return;
        }

        setFormError(null);
        start(async () => {
            const formData = new FormData();
            for (const [k, v] of Object.entries(data)) {
                if (v !== undefined && v !== null && v !== '') {
                    if (v instanceof Date) {
                        formData.set(k, v.toISOString().split('T')[0] ?? '');
                    } else {
                        formData.set(k, String(v));
                    }
                }
            }
            if (isDraft) {
                formData.set('isDraft', 'true');
            }

            let result: Awaited<ReturnType<typeof submitReport>>;
            try {
                result = await submitReport({}, formData);
            } catch (err) {
                console.error('[ReportForm] submitReport threw:', err);
                const message =
                    'Koneksi atau pemrosesan server terganggu saat menyimpan laporan. Silakan coba lagi.';
                setFormError(message);
                toast.error(message);
                return;
            }

            if (result.ok && result.id) {
                const pendingFiles = stagedAttachments.filter(
                    (item) => item.status !== 'done',
                );
                let failedUploads = 0;

                if (pendingFiles.length > 0) {
                    setUploadingAttachments(true);
                    for (const item of pendingFiles) {
                        setStagedAttachments((prev) =>
                            prev.map((x) =>
                                x.id === item.id
                                    ? { ...x, status: 'uploading', progress: 5 }
                                    : x,
                            ),
                        );
                        const uploadRes = await uploadStagedAttachment(
                            item.file,
                            result.id,
                            (pctValue) => {
                                setStagedAttachments((prev) =>
                                    prev.map((x) =>
                                        x.id === item.id
                                            ? { ...x, progress: pctValue }
                                            : x,
                                    ),
                                );
                            },
                        );
                        if (uploadRes.ok) {
                            setStagedAttachments((prev) =>
                                prev.map((x) =>
                                    x.id === item.id
                                        ? { ...x, status: 'done', progress: 100 }
                                        : x,
                                ),
                            );
                        } else {
                            failedUploads += 1;
                            setStagedAttachments((prev) =>
                                prev.map((x) =>
                                    x.id === item.id
                                        ? {
                                              ...x,
                                              status: 'error',
                                              error: uploadRes.error ?? 'Gagal unggah',
                                          }
                                        : x,
                                ),
                            );
                        }
                    }
                    setUploadingAttachments(false);
                }

                if (failedUploads > 0) {
                    toast.warning(
                        `Laporan tersimpan, namun ${failedUploads} lampiran gagal diunggah. Anda bisa mengunggah ulang dari halaman detail laporan.`,
                    );
                } else if (result.isDraft) {
                    toast.success('Laporan berhasil disimpan sebagai draf', {
                        description:
                            'Laporan belum dikirim ke surveilans. Anda dapat melengkapinya kembali nanti.',
                    });
                } else {
                    toast.success('Laporan kasus berhasil dikirim', {
                        description:
                            pendingFiles.length > 0
                                ? `${pendingFiles.length} lampiran terenkripsi ikut tersimpan.`
                                : 'Puskesmas wilayah menerima penugasan Penyelidikan Epidemiologi.',
                    });
                }

                router.push(`/laporan/${result.id}`);
                return;
            }

            if (result.fieldErrors) {
                for (const [field, message] of Object.entries(result.fieldErrors)) {
                    setError(field as keyof FormValues, {
                        type: 'server',
                        message,
                    });
                }
                toast.error('Mohon periksa kembali kolom isian yang ditandai merah.');
            }
            if (result.error) {
                setFormError(result.error);
                toast.error(result.error);
            }
        });
    };

    const onInvalid = (fieldErrors: Record<string, unknown>) => {
        const errCount = Object.keys(fieldErrors).length;
        if (errCount > 0) {
            toast.error(
                `Ada ${errCount} data yang belum lengkap atau tidak valid. Silakan periksa kolom yang bertanda merah.`,
            );
        }
    };

    const busy = submitting || uploadingAttachments;
    const trombositNum =
        watched.plateletCount !== undefined && watched.plateletCount !== ''
            ? Number(watched.plateletCount)
            : null;
    const isLowPlatelet =
        trombositNum !== null && !Number.isNaN(trombositNum) && trombositNum < 100_000;

    return (
        <form
            onSubmit={handleSubmit((d) => executeSubmit(d, false), onInvalid)}
            noValidate
            className="space-y-6 pb-20 sm:pb-6"
        >
            <StepNavigator steps={steps} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
                <div className="min-w-0 space-y-6">
                    {formError && (
                        <div
                            role="alert"
                            className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] p-4 text-[13px] text-[var(--pill-negative-ink)] shadow-xs"
                        >
                            <AlertCircle
                                className="mt-0.5 size-5 shrink-0 text-[var(--negative)]"
                                aria-hidden
                            />
                            <div className="space-y-1">
                                <p className="font-semibold text-foreground">
                                    Gagal Menyimpan Laporan
                                </p>
                                <p>{formError}</p>
                            </div>
                        </div>
                    )}

                    {/* Sumber Pelaporan */}
                    <Panel
                        padded
                        title={
                            <span className="flex items-center gap-2.5">
                                <span className="grid size-7 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                                    <Building2 className="size-4" aria-hidden />
                                </span>
                                <span>Sumber Pelaporan Kasus</span>
                            </span>
                        }
                        aside={
                            actorRole ? (
                                <span className="rounded-md border border-[var(--border)] bg-[var(--raised)] px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
                                    Peran: {actorRole}
                                </span>
                            ) : undefined
                        }
                    >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() =>
                                    setValue('sourceType', 'RS', { shouldValidate: true })
                                }
                                className={cn(
                                    'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all',
                                    watched.sourceType === 'RS'
                                        ? 'border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/25'
                                        : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--raised)]',
                                )}
                            >
                                <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                                    <Building2 className="size-4" aria-hidden />
                                </div>
                                <div className="min-w-0">
                                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                                        Rumah Sakit (KDRS)
                                        {watched.sourceType === 'RS' && (
                                            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                                                Aktif
                                            </span>
                                        )}
                                    </p>
                                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                                        Rujukan rawat inap / IGD RS; menugaskan Puskesmas wilayah pasien.
                                    </p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setValue('sourceType', 'PUSKESMAS_POLI', {
                                        shouldValidate: true,
                                    })
                                }
                                className={cn(
                                    'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all',
                                    watched.sourceType === 'PUSKESMAS_POLI'
                                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]/50 ring-2 ring-[var(--accent)]/25'
                                        : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--raised)]',
                                )}
                            >
                                <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
                                    <Stethoscope className="size-4" aria-hidden />
                                </div>
                                <div className="min-w-0">
                                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                                        Puskesmas (Poli / IGD)
                                        {watched.sourceType === 'PUSKESMAS_POLI' && (
                                            <span className="rounded bg-[var(--accent)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                                                Aktif
                                            </span>
                                        )}
                                    </p>
                                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                                        Temuan langsung Poli/IGD Puskesmas untuk alur PE terpadu.
                                    </p>
                                </div>
                            </button>
                        </div>
                    </Panel>

                    {/* Section 1: Identitas Pasien */}
                    <Panel
                        id="sec-identitas"
                        padded
                        title={
                            <span className="flex items-center gap-2.5">
                                <span className="grid size-7 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                                    <User className="size-4" aria-hidden />
                                </span>
                                <span>Identitas Pasien</span>
                            </span>
                        }
                        aside={
                            <span className="rounded-md border border-[var(--border)] bg-[var(--raised)] px-2 py-1 text-[11px] font-medium text-muted-foreground">
                                Bagian 1 dari 4
                            </span>
                        }
                    >
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="f-patientNik">
                                            NIK (Nomor Induk Kependudukan){' '}
                                            <span className="text-[var(--negative)]" aria-hidden>
                                                *
                                            </span>
                                        </Label>
                                        <span
                                            className={cn(
                                                'font-mono text-[11.5px] tabular-nums',
                                                nikDigits === 16
                                                    ? 'font-semibold text-[var(--positive)]'
                                                    : 'text-muted-foreground',
                                            )}
                                        >
                                            {nikDigits}/16 digit
                                        </span>
                                    </div>
                                    <ControllerField
                                        name="patientNik"
                                        control={control}
                                        error={errors.patientNik?.message}
                                        render={({ id, value, onChange, invalid }) => (
                                            <PatternFormat
                                                id={id}
                                                value={
                                                    typeof value === 'string' ||
                                                    typeof value === 'number'
                                                        ? value
                                                        : ''
                                                }
                                                onValueChange={(val) => onChange(val.value)}
                                                format="#### #### #### ####"
                                                mask="_"
                                                placeholder="3274 0123 4567 8901"
                                                className={cn(
                                                    'mt-1.5 h-[var(--control-height)] w-full rounded-[var(--radius-control)] border border-[var(--control)] bg-[var(--surface)] px-3 font-mono text-[13.5px] text-foreground transition-colors placeholder:text-faint focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/25 outline-none',
                                                    invalid &&
                                                        'border-[var(--negative)] ring-2 ring-[var(--negative)]/20',
                                                )}
                                            />
                                        )}
                                    />
                                </div>

                                <Field
                                    label="Nama Lengkap Pasien"
                                    required
                                    placeholder="Sesuai KTP / KK"
                                    error={errors.patientName?.message}
                                    reg={register('patientName')}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <Label id="lbl-gender">
                                        Jenis Kelamin{' '}
                                        <span className="text-[var(--negative)]" aria-hidden>
                                            *
                                        </span>
                                    </Label>
                                    <ControllerField
                                        name="patientGender"
                                        control={control}
                                        error={errors.patientGender?.message}
                                        render={({ value, onChange }) => (
                                            <div
                                                role="radiogroup"
                                                aria-labelledby="lbl-gender"
                                                className="mt-1.5 grid grid-cols-2 gap-2"
                                            >
                                                {[
                                                    { value: 'L', label: 'Laki-laki' },
                                                    { value: 'P', label: 'Perempuan' },
                                                ].map((opt) => {
                                                    const active = value === opt.value;
                                                    return (
                                                        <label
                                                            key={opt.value}
                                                            className={cn(
                                                                'flex h-[var(--control-height)] cursor-pointer items-center justify-center rounded-[var(--radius-control)] border text-[13px] font-medium transition-colors',
                                                                active
                                                                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                                                                    : 'border-[var(--control)] bg-[var(--surface)] text-foreground hover:bg-[var(--raised)]',
                                                            )}
                                                        >
                                                            <input
                                                                type="radio"
                                                                className="sr-only"
                                                                value={opt.value}
                                                                checked={active}
                                                                onChange={() => onChange(opt.value)}
                                                            />
                                                            {opt.label}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    />
                                </div>

                                <Field
                                    label="Umur"
                                    required
                                    type="number"
                                    min={0}
                                    max={130}
                                    suffix="Tahun"
                                    placeholder="28"
                                    error={errors.patientAge?.message}
                                    reg={register('patientAge')}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="f-phone">
                                    Nomor Telepon / WhatsApp Pasien (Opsional)
                                </Label>
                                <div className="relative max-w-md">
                                    <Phone
                                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                                        aria-hidden
                                    />
                                    <Input
                                        id="f-phone"
                                        type="tel"
                                        inputMode="tel"
                                        placeholder="0812-3456-7890"
                                        aria-invalid={Boolean(errors.phoneNumber)}
                                        {...register('phoneNumber')}
                                        className={cn(
                                            'pl-9 font-mono text-[13px]',
                                            errors.phoneNumber &&
                                                'border-[var(--negative)] ring-2 ring-[var(--negative)]/20',
                                        )}
                                    />
                                </div>
                                {errors.phoneNumber ? (
                                    <p className="text-[11.5px] font-medium text-[var(--negative)]">
                                        {errors.phoneNumber.message}
                                    </p>
                                ) : (
                                    <p className="text-[11.5px] text-muted-foreground">
                                        Digunakan tim Puskesmas untuk koordinasi PE lapangan.
                                    </p>
                                )}
                            </div>
                        </div>
                    </Panel>

                    {/* Section 2: Domisili & Peta */}
                    <Panel
                        id="sec-domisili"
                        padded
                        title={
                            <span className="flex items-center gap-2.5">
                                <span className="grid size-7 place-items-center rounded-lg bg-[var(--info)]/15 text-[var(--info)]">
                                    <MapPin className="size-4" aria-hidden />
                                </span>
                                <span>Domisili & Wilayah Penugasan PE</span>
                            </span>
                        }
                        aside={
                            <span className="rounded-md border border-[var(--border)] bg-[var(--raised)] px-2 py-1 text-[11px] font-medium text-muted-foreground">
                                Bagian 2 dari 4
                            </span>
                        }
                    >
                        <div className="space-y-5">
                            {kelurahanOptions.length > 0 && (
                                <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--raised)]/45 p-3.5">
                                    <Label htmlFor="kelurahan-preset" className="text-[12.5px] font-semibold">
                                        Isi Cepat dari Daftar Kelurahan Terdaftar
                                    </Label>
                                    <div className="relative">
                                        <select
                                            id="kelurahan-preset"
                                            value={selectedPreset}
                                            onChange={(e) => applyKelurahanPreset(e.target.value)}
                                            className="h-[var(--control-height)] w-full appearance-none rounded-[var(--radius-control)] border border-[var(--control)] bg-[var(--surface)] pr-9 pl-3 text-[13px] text-foreground outline-none transition-colors focus-visible:border-[var(--accent)]"
                                        >
                                            <option value="">
                                                — Pilih kelurahan untuk melengkapi kecamatan/kota otomatis —
                                            </option>
                                            {kelurahanOptions.map((opt, idx) => (
                                                <option
                                                    key={`${opt.name}-${opt.kecamatan}`}
                                                    value={idx}
                                                >
                                                    {opt.name} · Kec. {opt.kecamatan} ({opt.kota})
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                    </div>
                                </div>
                            )}

                            <div>
                                <Label htmlFor="f-address">
                                    Alamat Lengkap Domisili{' '}
                                    <span className="text-[var(--negative)]" aria-hidden>
                                        *
                                    </span>
                                </Label>
                                <Textarea
                                    id="f-address"
                                    rows={2}
                                    placeholder="Nama jalan, nomor rumah, blok, atau patokan terdekat…"
                                    aria-invalid={Boolean(errors.patientAddress)}
                                    {...register('patientAddress')}
                                    className="mt-1.5 resize-y text-[13.5px]"
                                />
                                {errors.patientAddress && (
                                    <p className="mt-1 text-[12px] text-[var(--negative)]">
                                        {errors.patientAddress.message}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Field
                                    label="RT"
                                    placeholder="Contoh: 003"
                                    error={errors.rt?.message}
                                    reg={register('rt')}
                                />
                                <Field
                                    label="RW"
                                    placeholder="Contoh: 005"
                                    error={errors.rw?.message}
                                    reg={register('rw')}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Field
                                    label="Kelurahan"
                                    required
                                    placeholder="Contoh: Kesambi"
                                    error={errors.kelurahan?.message}
                                    reg={register('kelurahan')}
                                />
                                <Field
                                    label="Kecamatan"
                                    required
                                    placeholder="Contoh: Kesambi"
                                    error={errors.kecamatan?.message}
                                    reg={register('kecamatan')}
                                />
                                <Field
                                    label="Kota / Kabupaten"
                                    required
                                    placeholder="Contoh: Kota Cirebon"
                                    error={errors.kota?.message}
                                    reg={register('kota')}
                                />
                                <Field
                                    label="Provinsi"
                                    required
                                    placeholder="Contoh: Jawa Barat"
                                    error={errors.provinsi?.message}
                                    reg={register('provinsi')}
                                />
                            </div>

                            {/* Koordinat & Peta */}
                            <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--raised)]/35 p-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-[13px] font-semibold text-foreground">
                                            Koordinat Geospasial Domisili Pasien
                                        </p>
                                        <p className="text-[11.5px] text-muted-foreground">
                                            Untuk pemetaan klaster 100 m & penentuan radius fokus PE.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleSearchAddressCoords}
                                            disabled={geocodingBusy || skipGeotag}
                                            className="h-8 gap-1.5 text-[12px]"
                                        >
                                            {geocodingBusy ? (
                                                <Loader2 className="size-3.5 animate-spin" />
                                            ) : (
                                                <Search className="size-3.5" />
                                            )}
                                            {geocodingBusy ? 'Mencari…' : 'Cari dari Alamat'}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleGetLocation}
                                            disabled={gpsBusy || skipGeotag}
                                            className="h-8 gap-1.5 text-[12px]"
                                        >
                                            {gpsBusy ? (
                                                <Loader2 className="size-3.5 animate-spin text-[var(--accent)]" />
                                            ) : (
                                                <Compass className="size-3.5 text-[var(--accent)]" />
                                            )}
                                            {gpsBusy ? 'GPS Aktif…' : 'Gunakan GPS'}
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px]">
                                    <label
                                        htmlFor="skip-geotag-checkbox"
                                        className="flex cursor-pointer items-center gap-2 select-none"
                                    >
                                        <input
                                            id="skip-geotag-checkbox"
                                            type="checkbox"
                                            checked={skipGeotag}
                                            onChange={(e) =>
                                                handleToggleSkipGeotag(e.target.checked)
                                            }
                                            className="size-4 rounded border-[var(--border)] accent-[var(--accent)]"
                                        />
                                        <span className="font-medium text-foreground">
                                            Lewati geotag / Tanpa koordinat saat ini
                                        </span>
                                    </label>
                                    <span className="hidden text-[11px] text-muted-foreground sm:inline">
                                        Bisa dilengkapi saat PE lapangan
                                    </span>
                                </div>

                                {skipGeotag ? (
                                    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)]/60 px-3.5 py-2.5 text-[12px] text-muted-foreground">
                                        Geotag dilewati. Petugas Puskesmas dapat melakukan geotagging rumah pasien saat kunjungan lapangan.
                                    </div>
                                ) : (
                                    <>
                                        {geocodeNotice && (
                                            <div className="flex items-center gap-2 rounded-lg border border-[var(--pill-positive-border)] bg-[var(--pill-positive-bg)] px-3 py-2 text-[11.5px] text-[var(--pill-positive-ink)]">
                                                <CheckCircle2 className="size-3.5 shrink-0" />
                                                <span className="truncate">{geocodeNotice}</span>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <Field
                                                label="Latitude"
                                                placeholder="-6.720000"
                                                error={errors.latitude?.message}
                                                reg={register('latitude')}
                                            />
                                            <Field
                                                label="Longitude"
                                                placeholder="108.550000"
                                                error={errors.longitude?.message}
                                                reg={register('longitude')}
                                            />
                                        </div>
                                        <PatientLocationMap
                                            lat={
                                                parsedLat !== null && !Number.isNaN(parsedLat)
                                                    ? parsedLat
                                                    : null
                                            }
                                            lng={
                                                parsedLng !== null && !Number.isNaN(parsedLng)
                                                    ? parsedLng
                                                    : null
                                            }
                                            onLocationSelect={handleMapLocationSelect}
                                            height="250px"
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    </Panel>

                    {/* Section 3: Diagnosis Klinis & Lab */}
                    <Panel
                        id="sec-klinis"
                        padded
                        title={
                            <span className="flex items-center gap-2.5">
                                <span className="grid size-7 place-items-center rounded-lg bg-[var(--warning)]/15 text-[var(--warning)]">
                                    <Stethoscope className="size-4" aria-hidden />
                                </span>
                                <span>Diagnosis Klinis & Hasil Lab</span>
                            </span>
                        }
                        aside={
                            <span className="rounded-md border border-[var(--border)] bg-[var(--raised)] px-2 py-1 text-[11px] font-medium text-muted-foreground">
                                Bagian 3 dari 4
                            </span>
                        }
                    >
                        <div className="space-y-5">
                            <div>
                                <Label id="lbl-casetype">
                                    Klasifikasi Kasus Dengue{' '}
                                    <span className="text-[var(--negative)]" aria-hidden>
                                        *
                                    </span>
                                </Label>
                                <ControllerField
                                    name="caseType"
                                    control={control}
                                    error={errors.caseType?.message}
                                    render={({ value, onChange }) => (
                                        <div
                                            role="radiogroup"
                                            aria-labelledby="lbl-casetype"
                                            className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2"
                                        >
                                            {CASE_TYPES.map((ct) => {
                                                const active = value === ct.value;
                                                return (
                                                    <label
                                                        key={ct.value}
                                                        className={cn(
                                                            'cursor-pointer rounded-xl border p-3.5 transition-all',
                                                            active
                                                                ? 'border-[var(--accent)] bg-[var(--accent-soft)]/50 ring-2 ring-[var(--accent)]/25'
                                                                : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--raised)]',
                                                        )}
                                                    >
                                                        <input
                                                            type="radio"
                                                            className="sr-only"
                                                            checked={active}
                                                            onChange={() => onChange(ct.value)}
                                                        />
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-[13px] font-semibold text-foreground">
                                                                {ct.label}
                                                            </span>
                                                            <span
                                                                className={cn(
                                                                    'rounded px-1.5 py-0.5 text-[10.5px] font-semibold',
                                                                    ct.tone === 'bad'
                                                                        ? 'bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)]'
                                                                        : ct.tone === 'warn'
                                                                          ? 'bg-[var(--pill-warning-bg)] text-[var(--pill-warning-ink)]'
                                                                          : 'bg-[var(--pill-info-bg)] text-[var(--pill-info-ink)]',
                                                                )}
                                                            >
                                                                {ct.badge}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                                                            {ct.hint}
                                                        </p>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <ControllerField
                                    name="admissionDate"
                                    label="Tanggal masuk RS / Faskes"
                                    required
                                    control={control}
                                    error={errors.admissionDate?.message}
                                    render={({ id, value, onChange, invalid }) => (
                                        <DateField
                                            id={id}
                                            value={value as string | undefined}
                                            onChange={onChange}
                                            placeholder="Pilih tanggal"
                                            aria-invalid={invalid ? true : undefined}
                                        />
                                    )}
                                />

                                <ControllerField
                                    name="symptomOnsetDate"
                                    label="Tanggal Mulai Demam"
                                    control={control}
                                    error={errors.symptomOnsetDate?.message}
                                    render={({ id, value, onChange, invalid }) => (
                                        <DateField
                                            id={id}
                                            value={value as string | undefined}
                                            onChange={onChange}
                                            placeholder="Pilih bila diketahui"
                                            aria-invalid={invalid ? true : undefined}
                                        />
                                    )}
                                />

                                <ControllerField
                                    name="diagnosisDate"
                                    label="Tanggal Diagnosis"
                                    control={control}
                                    error={errors.diagnosisDate?.message}
                                    render={({ id, value, onChange, invalid }) => (
                                        <DateField
                                            id={id}
                                            value={value as string | undefined}
                                            onChange={onChange}
                                            placeholder="Pilih bila ditegakkan"
                                            aria-invalid={invalid ? true : undefined}
                                        />
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="f-platelet">
                                            Trombosit Terakhir (sel/µL)
                                        </Label>
                                        {isLowPlatelet && (
                                            <span className="inline-flex items-center gap-1 rounded bg-[var(--pill-negative-bg)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--pill-negative-ink)]">
                                                <Activity className="size-3" />
                                                Trombositopenia (&lt;100rb)
                                            </span>
                                        )}
                                    </div>
                                    <ControllerField
                                        name="plateletCount"
                                        control={control}
                                        error={errors.plateletCount?.message}
                                        render={({ id, value, onChange, invalid }) => (
                                            <div className="relative mt-1.5">
                                                <NumericFormat
                                                    id={id}
                                                    value={
                                                        typeof value === 'number' ||
                                                        typeof value === 'string'
                                                            ? value
                                                            : ''
                                                    }
                                                    onValueChange={(val) =>
                                                        onChange(
                                                            val.value === ''
                                                                ? undefined
                                                                : Number(val.value),
                                                        )
                                                    }
                                                    thousandSeparator="."
                                                    decimalSeparator=","
                                                    placeholder="Contoh: 75.000"
                                                    className={cn(
                                                        'h-[var(--control-height)] w-full rounded-[var(--radius-control)] border border-[var(--control)] bg-[var(--surface)] px-3 pr-16 font-mono text-[13.5px] tabular-nums text-foreground outline-none transition-colors focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/25',
                                                        invalid &&
                                                            'border-[var(--negative)] ring-2 ring-[var(--negative)]/20',
                                                    )}
                                                />
                                                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11.5px] text-muted-foreground">
                                                    sel/µL
                                                </span>
                                            </div>
                                        )}
                                    />
                                </div>

                                <div>
                                    <Field
                                        label="Hematokrit (%)"
                                        type="number"
                                        step="0.1"
                                        min={0}
                                        max={100}
                                        suffix="%"
                                        placeholder="Contoh: 42.5"
                                        error={errors.hematocrit?.message}
                                        reg={register('hematocrit')}
                                    />
                                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                                        Kenaikan ≥ 20% mengindikasikan hemokonsentrasi.
                                    </p>
                                </div>
                            </div>

                            <div>
                                <Label className="mb-2 block font-semibold text-foreground">
                                    Hasil Pemeriksaan Serologi / RDT Dengue
                                </Label>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    {(
                                        [
                                            { id: 'f-ns1', name: 'ns1Result', label: 'NS1 Antigen' },
                                            {
                                                id: 'f-igm',
                                                name: 'igmResult',
                                                label: 'IgM Anti-Dengue',
                                            },
                                            {
                                                id: 'f-igg',
                                                name: 'iggResult',
                                                label: 'IgG Anti-Dengue',
                                            },
                                        ] as const
                                    ).map((ser) => (
                                        <div
                                            key={ser.name}
                                            className="space-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--raised)]/30 p-3"
                                        >
                                            <Label htmlFor={ser.id} className="text-[12.5px] font-medium">
                                                {ser.label}
                                            </Label>
                                            <div className="relative">
                                                <select
                                                    id={ser.id}
                                                    {...register(ser.name)}
                                                    className="h-[var(--control-height)] w-full appearance-none rounded-[var(--radius-control)] border border-[var(--control)] bg-[var(--surface)] pr-8 pl-2.5 text-[13px] text-foreground outline-none transition-colors focus-visible:border-[var(--accent)]"
                                                >
                                                    {LAB_RESULT_OPTIONS.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="f-diagnosis">
                                    Catatan Klinis / Komplikasi Tambahan (Opsional)
                                </Label>
                                <Textarea
                                    id="f-diagnosis"
                                    rows={3}
                                    placeholder="Catatan gejala penyerta, penyakit komorbid, atau kondisi klinis khusus…"
                                    {...register('diagnosis')}
                                    className="mt-1.5 text-[13.5px]"
                                />
                            </div>
                        </div>
                    </Panel>

                    {/* Section 4: Lampiran Berkas PDF / JPG Terkompresi */}
                    <Panel
                        id="sec-lampiran"
                        padded
                        title={
                            <span className="flex items-center gap-2.5">
                                <span className="grid size-7 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                                    <Paperclip className="size-4" aria-hidden />
                                </span>
                                <span>Berkas Lampiran Hasil Lab & Dokumentasi</span>
                            </span>
                        }
                        aside={
                            <span className="rounded-md border border-[var(--border)] bg-[var(--raised)] px-2 py-1 text-[11px] font-medium text-muted-foreground">
                                Bagian 4 dari 4 · Opsional
                            </span>
                        }
                    >
                        <StagedAttachmentPicker
                            items={stagedAttachments}
                            onChange={setStagedAttachments}
                            disabled={busy}
                        />
                    </Panel>

                    {/* Action Bar */}
                    <div className="flex flex-col items-center justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:flex-row">
                        <div className="flex items-center gap-3">
                            <div
                                className={cn(
                                    'grid size-10 shrink-0 place-items-center rounded-xl transition-colors',
                                    pct === 100
                                        ? 'bg-[var(--positive)]/15 text-[var(--positive)]'
                                        : 'bg-[var(--accent-soft)] text-[var(--accent)]',
                                )}
                            >
                                {pct === 100 ? (
                                    <CheckCircle2 className="size-5" />
                                ) : (
                                    <Clock className="size-5" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[13.5px] font-semibold text-foreground">
                                    {pct === 100
                                        ? 'Semua data wajib telah lengkap'
                                        : `${checklist.completed} dari ${checklist.total} data wajib terisi (${pct}%)`}
                                </p>
                                <p className="text-[12px] text-muted-foreground">
                                    {stagedAttachments.length > 0
                                        ? `${stagedAttachments.length} berkas lampiran akan diunggah otomatis setelah laporan dibuat.`
                                        : 'Target investigasi PE Puskesmas wilayah ≤ 24 jam sejak dikirim.'}
                                </p>
                            </div>
                        </div>

                        <div className="flex w-full flex-wrap items-center justify-end gap-2.5 sm:w-auto">
                            <Button
                                asChild
                                variant="ghost"
                                className="h-10 px-3 text-[13px] text-muted-foreground"
                            >
                                <Link href="/laporan">Batalkan</Link>
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    handleSubmit((d) => executeSubmit(d, true), onInvalid)()
                                }
                                disabled={busy}
                                className="h-10 gap-2 px-4 text-[13px] font-medium"
                            >
                                <Save className="size-4 text-[var(--accent)]" />
                                <span>Simpan Draf</span>
                            </Button>
                            <Button
                                type="submit"
                                disabled={busy}
                                className="h-10 gap-2 px-5 text-[13.5px] font-semibold"
                            >
                                {busy ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" />
                                        <span>
                                            {uploadingAttachments
                                                ? 'Mengunggah Berkas…'
                                                : 'Menyimpan Laporan…'}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="size-4" />
                                        <span>Kirim Laporan Kasus</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                <SummarySidebar
                    checklist={checklist}
                    pct={pct}
                    stagedCount={stagedAttachments.length}
                    patientName={watched.patientName}
                    kelurahan={watched.kelurahan}
                    caseType={watched.caseType}
                    sourceType={watched.sourceType}
                />
            </div>
        </form>
    );
}
