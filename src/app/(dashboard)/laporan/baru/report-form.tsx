'use client';

import {
    Controller,
    useForm,
    useWatch,
    type Control,
    type UseFormRegisterReturn,
} from 'react-hook-form';
import { NumericFormat, PatternFormat } from 'react-number-format';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
    Activity,
    AlertCircle,
    Building2,
    CheckCircle2,
    ChevronDown,
    Circle,
    Compass,
    Loader2,
    MapPin,
    Phone,
    Search,
    Send,
    ShieldCheck,
    Stethoscope,
    User,
    Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { createReportSchema } from '@/lib/domain/form-contracts';
import { Panel } from '@/components/shell/page';
import { DateField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { submitReport, geocodePatientAddress } from './actions';

type FormValues = z.input<typeof createReportSchema>;

export type KelurahanOption = {
    name: string;
    kecamatan: string;
    kota: string;
    provinsi: string;
};

const PatientLocationMap = dynamic(
    () => import('@/components/reports/patient-location-map'),
    {
        ssr: false,
        loading: () => (
            <div
                className="flex h-[260px] w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] text-[12px] text-muted-foreground"
                aria-busy
                role="status"
            >
                <Loader2 className="size-4 animate-spin text-[var(--accent)]" />
                <span>Memuat peta interaktif domisili...</span>
            </div>
        ),
    },
);

const CASE_TYPES: {
    value: FormValues['caseType'];
    label: string;
    badge: string;
    hint: string;
    tone: 'warn' | 'bad' | 'info';
}[] = [
    {
        value: 'DENGUE',
        label: 'DBD (Dengue)',
        badge: 'Terkonfirmasi',
        hint: 'Demam Berdarah Dengue dengan manifestasi perdarahan / efusi',
        tone: 'warn',
    },
    {
        value: 'SUSPECTED_DENGUE',
        label: 'Suspek DBD',
        badge: 'Observasi',
        hint: 'Gejala klinis mengarah ke dengue, menunggu hasil lab lanjutan',
        tone: 'info',
    },
    {
        value: 'DHF',
        label: 'DHF (Grade I-II)',
        badge: 'Serius',
        hint: 'Kebocoran plasma, hemokonsentrasi, trombositopenia (<100.000)',
        tone: 'bad',
    },
    {
        value: 'DSS',
        label: 'DSS (Dengue Shock)',
        badge: 'Kritis',
        hint: 'Kegagalan sirkulasi darah, nadi cepat dan lemah, hipotensi',
        tone: 'bad',
    },
];

const LAB_RESULT_OPTIONS = [
    { value: 'TIDAK_DIPERIKSA', label: 'Tidak diperiksa' },
    { value: 'POSITIF', label: 'Positif (+)' },
    { value: 'NEGATIF', label: 'Negatif (-)' },
] as const;

export function ReportForm({
    kelurahanOptions = [],
    sourceType = 'RS',
}: {
    kelurahanOptions?: KelurahanOption[];
    sourceType?: 'RS' | 'PUSKESMAS_POLI';
}) {
    const router = useRouter();
    const [submitting, start] = useTransition();
    const [formError, setFormError] = useState<string | null>(null);
    const [selectedPreset, setSelectedPreset] = useState('');
    const [gpsBusy, setGpsBusy] = useState(false);
    const [geocodingBusy, setGeocodingBusy] = useState(false);
    const [geocodeNotice, setGeocodeNotice] = useState<string | null>(null);
    const [skipGeotag, setSkipGeotag] = useState(false);

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
            admissionDate: new Date().toISOString().split('T')[0],
        },
    });

    const watched = useWatch({ control });
    const nikDigits = (watched.patientNik ?? '').replace(/\D/g, '').length;
    const parsedLat = watched.latitude ? parseFloat(String(watched.latitude)) : null;
    const parsedLng = watched.longitude ? parseFloat(String(watched.longitude)) : null;

    const checklist = useMemo(() => {
        const items = [
            {
                key: 'name',
                label: 'Nama lengkap pasien (min. 3)',
                done: (watched.patientName ?? '').trim().length >= 3,
            },
            {
                key: 'nik',
                label: 'NIK 16 digit angka',
                done: /^\d{16}$/.test((watched.patientNik ?? '').trim()),
            },
            {
                key: 'age',
                label: 'Umur pasien terisi',
                done:
                    watched.patientAge !== undefined &&
                    watched.patientAge !== '' &&
                    !Number.isNaN(Number(watched.patientAge)),
            },
            {
                key: 'address',
                label: 'Alamat domisili lengkap',
                done: (watched.patientAddress ?? '').trim().length >= 5,
            },
            {
                key: 'kelurahan',
                label: 'Kelurahan & kecamatan',
                done: Boolean(
                    (watched.kelurahan ?? '').trim() &&
                        (watched.kecamatan ?? '').trim(),
                ),
            },
            {
                key: 'admission',
                label: 'Tanggal masuk / dirawat',
                done: Boolean(watched.admissionDate),
            },
            {
                key: 'caseType',
                label: 'Jenis kasus klinis dipilih',
                done: Boolean(watched.caseType),
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
                setValue(
                    'latitude',
                    Number(pos.coords.latitude.toFixed(6)) as unknown as string,
                    { shouldValidate: true },
                );
                setValue(
                    'longitude',
                    Number(pos.coords.longitude.toFixed(6)) as unknown as string,
                    { shouldValidate: true },
                );
                setGpsBusy(false);
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
                const label = res.isFallback
                    ? `Perkiraan kelurahan: ${res.displayName}`
                    : `Alamat terverifikasi: ${res.displayName}`;
                setGeocodeNotice(label);
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
            toast.info('Geotag dilewati. Koordinat dapat diisi saat Penyelidikan Epidemiologi (PE) di lapangan.');
        }
    };

    const handleMapLocationSelect = (lat: number, lng: number) => {
        setValue('latitude', lat.toFixed(6), { shouldValidate: true });
        setValue('longitude', lng.toFixed(6), { shouldValidate: true });
        setSkipGeotag(false);
        setGeocodeNotice('Titik koordinat ditentukan dari peta interaktif.');
        toast.success('Koordinat diperbarui dari titik peta.');
    };

    const onSubmit = (data: z.output<typeof createReportSchema>) => {
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

            const result = await submitReport({}, formData);

            if (result.ok) {
                toast.success('Laporan kasus berhasil dikirim', {
                    description:
                        'Notifikasi penugasan PE otomatis diteruskan ke Puskesmas wilayah.',
                });
                router.push('/laporan');
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

    return (
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                {/* Left Primary Column: 3 Form Sections */}
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

                    {/* Sumber Pelaporan Kasus (RS vs Puskesmas) */}
                    <Panel
                        padded
                        title={
                            <span className="flex items-center gap-2.5">
                                <span className="grid size-7 place-items-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
                                    <Building2 className="size-4" aria-hidden />
                                </span>
                                <span>Sumber Pelaporan Kasus</span>
                            </span>
                        }
                    >
                        <div className="space-y-2">
                            <Label className="text-[12.5px] font-semibold text-foreground">
                                Asal Sumber Laporan <span className="text-[var(--negative)]">*</span>
                            </Label>
                            <p className="text-[12px] text-muted-foreground">
                                Pilih asal fasilitas pelapor kasus: Rumah Sakit (KDRS) atau Puskesmas (Poli/IGD).
                            </p>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setValue('sourceType', 'RS', { shouldValidate: true })}
                                    className={cn(
                                        'flex items-start gap-3 rounded-[var(--radius-control)] border p-3.5 text-left transition-all',
                                        watched.sourceType === 'RS'
                                            ? 'border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/30'
                                            : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--raised)]',
                                    )}
                                >
                                    <div className="grid size-8 shrink-0 place-items-center rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-400">
                                        <Building2 className="size-4" aria-hidden />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-[13px] text-foreground flex items-center gap-1.5">
                                            Rumah Sakit (KDRS)
                                            {watched.sourceType === 'RS' && (
                                                <span className="text-[10px] rounded bg-sky-500/20 px-1 py-0.2 font-bold text-sky-700 dark:text-sky-300">
                                                    Aktif
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-[11.5px] text-muted-foreground mt-0.5">
                                            Laporan Kewaspadaan Dini Rumah Sakit dari IGD atau bangsal rawat inap.
                                        </p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setValue('sourceType', 'PUSKESMAS_POLI', { shouldValidate: true })}
                                    className={cn(
                                        'flex items-start gap-3 rounded-[var(--radius-control)] border p-3.5 text-left transition-all',
                                        watched.sourceType === 'PUSKESMAS_POLI'
                                            ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                                            : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--raised)]',
                                    )}
                                >
                                    <div className="grid size-8 shrink-0 place-items-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                        <Activity className="size-4" aria-hidden />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-[13px] text-foreground flex items-center gap-1.5">
                                            Puskesmas (Poli / IGD)
                                            {watched.sourceType === 'PUSKESMAS_POLI' && (
                                                <span className="text-[10px] rounded bg-emerald-500/20 px-1 py-0.2 font-bold text-emerald-700 dark:text-emerald-300">
                                                    Aktif
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-[11.5px] text-muted-foreground mt-0.5">
                                            Pelaporan langsung dari Poli Umum/Anak Puskesmas; otomatis masuk ke tugas PE internal.
                                        </p>
                                    </div>
                                </button>
                            </div>
                            <input type="hidden" {...register('sourceType')} />
                        </div>
                    </Panel>

                    {/* Section 1: Identitas Pasien */}
                    <Panel
                        padded
                        title={
                            <span className="flex items-center gap-2.5">
                                <span className="grid size-7 place-items-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
                                    <User className="size-4" aria-hidden />
                                </span>
                                <span>Identitas Pasien</span>
                            </span>
                        }
                        aside={
                            <span className="inline-flex items-center rounded-md bg-[var(--raised)] px-2 py-1 text-[11px] font-medium text-muted-foreground border border-[var(--border)]">
                                Bagian 1 dari 3
                            </span>
                        }
                    >
                        <div className="space-y-5">
                            {/* AES Security Callout */}
                            <div className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--raised)]/40 p-3 text-[12px] text-muted-foreground">
                                <ShieldCheck className="size-4 shrink-0 text-[var(--accent)]" />
                                <span>
                                    Data NIK, nama lengkap, dan nomor kontak pasien dilindungi enkripsi standar medis{' '}
                                    <strong className="text-foreground">AES-256-GCM</strong>.
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {/* NIK */}
                                <div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="f-patientNik">
                                            NIK (Nomor Induk Kependudukan){' '}
                                            <span className="text-[var(--negative)]" aria-hidden>*</span>
                                        </Label>
                                        <span
                                            data-numeric
                                            className={cn(
                                                'text-[11.5px] tabular-nums font-mono',
                                                nikDigits === 16
                                                    ? 'text-[var(--positive)] font-semibold'
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
                                                value={typeof value === 'string' || typeof value === 'number' ? value : ''}
                                                onValueChange={(val) =>
                                                    onChange(val.value)
                                                }
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

                                {/* Nama Pasien */}
                                <Field
                                    label="Nama lengkap pasien"
                                    required
                                    placeholder="Nama sesuai KTP / KK"
                                    error={errors.patientName?.message}
                                    reg={register('patientName')}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                {/* Jenis Kelamin */}
                                <div>
                                    <Label id="lbl-gender">
                                        Jenis Kelamin{' '}
                                        <span className="text-[var(--negative)]" aria-hidden>*</span>
                                    </Label>
                                    <Controller
                                        control={control}
                                        name="patientGender"
                                        render={({ field }) => (
                                            <div
                                                role="radiogroup"
                                                aria-labelledby="lbl-gender"
                                                className="mt-1.5 grid grid-cols-2 gap-2"
                                            >
                                                {[
                                                    { value: 'L', label: 'Laki-laki' },
                                                    { value: 'P', label: 'Perempuan' },
                                                ].map((opt) => {
                                                    const active = field.value === opt.value;
                                                    return (
                                                        <label
                                                            key={opt.value}
                                                            className={cn(
                                                                'flex h-[var(--control-height)] cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-control)] border text-[13px] font-medium transition-all select-none',
                                                                active
                                                                    ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] font-semibold shadow-xs ring-1 ring-[var(--accent)]'
                                                                    : 'border-[var(--control)] bg-[var(--surface)] text-foreground hover:bg-[var(--raised)]/50',
                                                            )}
                                                        >
                                                            <input
                                                                type="radio"
                                                                className="sr-only"
                                                                name={field.name}
                                                                value={opt.value}
                                                                checked={active}
                                                                onChange={() => field.onChange(opt.value)}
                                                            />
                                                            {opt.label}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    />
                                    {errors.patientGender && (
                                        <p className="mt-1 text-[12px] text-[var(--negative)]">
                                            {errors.patientGender.message}
                                        </p>
                                    )}
                                </div>

                                {/* Umur */}
                                <Field
                                    label="Umur (Tahun)"
                                    required
                                    type="number"
                                    min={0}
                                    max={130}
                                    placeholder="Contoh: 28"
                                    error={errors.patientAge?.message}
                                    reg={register('patientAge')}
                                />
                            </div>

                            {/* Nomor Telepon */}
                            <div className="space-y-1.5">
                                <Label htmlFor="f-phone" className="text-[13px] font-medium">
                                    Nomor Telepon / WhatsApp Pasien (Opsional)
                                </Label>
                                <div className="relative max-w-md">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                                        <Phone className="size-4 text-muted-foreground" aria-hidden />
                                    </div>
                                    <Input
                                        id="f-phone"
                                        type="tel"
                                        inputMode="tel"
                                        placeholder="Contoh: 0812-3456-7890 atau 81234567890"
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
                                        Format Indonesia (08... atau +62...). Digunakan untuk koordinasi investigasi kontak dan surveilans PE Puskesmas lapangan.
                                    </p>
                                )}
                            </div>
                        </div>
                    </Panel>

                    {/* Section 2: Domisili & Wilayah Puskesmas */}
                    <Panel
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
                            <span className="inline-flex items-center rounded-md bg-[var(--raised)] px-2 py-1 text-[11px] font-medium text-muted-foreground border border-[var(--border)]">
                                Bagian 2 dari 3
                            </span>
                        }
                    >
                        <div className="space-y-5">
                            {/* Quick Preset Autocomplete */}
                            {kelurahanOptions.length > 0 && (
                                <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/45 p-3.5 space-y-2">
                                    <Label htmlFor="kelurahan-preset" className="text-[12.5px] font-semibold text-foreground">
                                        Isi cepat dari kelurahan terdaftar (Kota Cirebon):
                                    </Label>
                                    <div className="relative">
                                        <select
                                            id="kelurahan-preset"
                                            value={selectedPreset}
                                            onChange={(e) => applyKelurahanPreset(e.target.value)}
                                            className="h-[var(--control-height)] w-full appearance-none rounded-[var(--radius-control)] border border-[var(--control)] bg-[var(--surface)] pr-9 pl-3 text-[13.5px] text-foreground outline-none transition-colors focus-visible:border-[var(--accent)]"
                                        >
                                            <option value="">
                                                -- Pilih kelurahan untuk otomatis mengisi 4 wilayah --
                                            </option>
                                            {kelurahanOptions.map((opt, idx) => (
                                                <option
                                                    key={`${opt.name}-${opt.kecamatan}-${idx}`}
                                                    value={String(idx)}
                                                >
                                                    {opt.name} — Kec. {opt.kecamatan}, {opt.kota}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown
                                            aria-hidden
                                            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                                        />
                                    </div>
                                    <p className="text-[11.5px] text-muted-foreground">
                                        Memilih kelurahan dari daftar memastikan otomatisasi penugasan ke Puskesmas berjalan akurat.
                                    </p>
                                </div>
                            )}

                            {/* Alamat Lengkap */}
                            <div>
                                <Label htmlFor="f-address">
                                    Alamat tempat tinggal / domisili pasien{' '}
                                    <span className="text-[var(--negative)]" aria-hidden>*</span>
                                </Label>
                                <Textarea
                                    id="f-address"
                                    rows={2}
                                    placeholder="Nama jalan, gang, nomor rumah, atau patokan lokasi domisili..."
                                    aria-invalid={Boolean(errors.patientAddress) ? true : undefined}
                                    {...register('patientAddress')}
                                    className="mt-1.5 resize-y text-[13.5px]"
                                />
                                {errors.patientAddress && (
                                    <p className="mt-1 text-[12px] text-[var(--negative)]">
                                        {errors.patientAddress.message}
                                    </p>
                                )}
                            </div>

                            {/* Wilayah Grid (2x2) */}
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
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                            {/* Koordinat GPS & Lokasi Geospasial */}
                            <div className="space-y-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/40 p-3.5">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-[13px] font-semibold text-foreground">
                                            Koordinat Geospasial Domisili Pasien
                                        </p>
                                        <p className="text-[11.5px] text-muted-foreground">
                                            Diperlukan untuk pemetaan klaster 100 meter dan radius penyelidikan epidemiologi.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        <Button
                                            type="button"
                                            variant="default"
                                            size="sm"
                                            onClick={handleSearchAddressCoords}
                                            disabled={geocodingBusy || skipGeotag}
                                            className="h-8 gap-1.5 text-[12px] shadow-xs"
                                        >
                                            {geocodingBusy ? (
                                                <Loader2 className="size-3.5 animate-spin" />
                                            ) : (
                                                <Search className="size-3.5" />
                                            )}
                                            {geocodingBusy ? 'Mencari Alamat…' : 'Cari dari Alamat'}
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

                                {/* Option to skip geotag if coordinates cannot be found */}
                                <div className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px]">
                                    <label htmlFor="skip-geotag-checkbox" className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            id="skip-geotag-checkbox"
                                            type="checkbox"
                                            checked={skipGeotag}
                                            onChange={(e) => handleToggleSkipGeotag(e.target.checked)}
                                            className="size-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                                        />
                                        <span className="font-medium text-foreground">
                                            Lewati geotag / Tanpa koordinat saat ini
                                        </span>
                                    </label>
                                    <span className="text-[11px] text-muted-foreground hidden sm:inline">
                                        Bisa dilengkapi saat PE lapangan
                                    </span>
                                </div>

                                {skipGeotag ? (
                                    <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--raised)]/20 px-3.5 py-2.5 text-[12px] text-muted-foreground">
                                        <p className="font-medium text-foreground">Geotag dilewati</p>
                                        <p className="mt-0.5 text-[11.5px]">
                                            Petugas surveilans Puskesmas akan mengambil koordinat GPS langsung saat pelaksanaan Penyelidikan Epidemiologi (PE) di rumah pasien.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {geocodeNotice && (
                                            <div className="flex items-start gap-2 rounded-md border border-[var(--positive)]/30 bg-[var(--positive)]/10 px-3 py-2 text-[12px] text-foreground">
                                                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--positive)]" />
                                                <p className="leading-snug">{geocodeNotice}</p>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <Field
                                                label="Latitude (Garis Lintang)"
                                                placeholder="Contoh: -6.721450"
                                                error={errors.latitude?.message}
                                                reg={register('latitude')}
                                            />
                                            <Field
                                                label="Longitude (Garis Bujur)"
                                                placeholder="Contoh: 108.556210"
                                                error={errors.longitude?.message}
                                                reg={register('longitude')}
                                            />
                                        </div>

                                        {/* Interactive Map Preview */}
                                        <div className="space-y-1.5 pt-1">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[12.5px] font-medium text-foreground">
                                                    Peta Domisili & Radius Penyelidikan (100 Meter)
                                                </Label>
                                                <span className="text-[11px] text-muted-foreground">
                                                    Klik pada peta untuk menyesuaikan titik
                                                </span>
                                            </div>
                                            <PatientLocationMap
                                                lat={parsedLat}
                                                lng={parsedLng}
                                                onLocationSelect={handleMapLocationSelect}
                                                height="260px"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </Panel>

                    {/* Section 3: Data Klinis & Laboratorium */}
                    <Panel
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
                            <span className="inline-flex items-center rounded-md bg-[var(--raised)] px-2 py-1 text-[11px] font-medium text-muted-foreground border border-[var(--border)]">
                                Bagian 3 dari 3
                            </span>
                        }
                    >
                        <div className="space-y-5">
                            {/* Case Type Cards Selector */}
                            <div>
                                <Label id="lbl-casetype">
                                    Klasifikasi Kasus Dengue{' '}
                                    <span className="text-[var(--negative)]" aria-hidden>*</span>
                                </Label>
                                <Controller
                                    control={control}
                                    name="caseType"
                                    render={({ field }) => (
                                        <div
                                            role="radiogroup"
                                            aria-labelledby="lbl-casetype"
                                            className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2"
                                        >
                                            {CASE_TYPES.map((ct) => {
                                                const active = field.value === ct.value;
                                                return (
                                                    <label
                                                        key={ct.value}
                                                        className={cn(
                                                            'flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border p-3.5 transition-all select-none',
                                                            active
                                                                ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-xs ring-1 ring-[var(--accent)]'
                                                                : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--raised)]/45',
                                                        )}
                                                    >
                                                        <input
                                                            type="radio"
                                                            className="sr-only"
                                                            name={field.name}
                                                            value={ct.value}
                                                            checked={active}
                                                            onChange={() => field.onChange(ct.value)}
                                                        />
                                                        <span
                                                            className={cn(
                                                                'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors',
                                                                active
                                                                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                                                                    : 'border-[var(--control)] bg-[var(--surface)]',
                                                            )}
                                                        >
                                                            {active && (
                                                                <span className="size-1.5 rounded-full bg-white" />
                                                            )}
                                                        </span>
                                                        <div className="min-w-0 flex-1 space-y-1">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="font-semibold text-[13.5px] text-foreground">
                                                                    {ct.label}
                                                                </span>
                                                                <span
                                                                    className={cn(
                                                                        'rounded px-1.5 py-0.5 text-[10.5px] font-semibold border',
                                                                        ct.tone === 'bad'
                                                                            ? 'border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] text-[var(--negative)]'
                                                                            : ct.tone === 'warn'
                                                                              ? 'border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] text-[var(--warning)]'
                                                                              : 'border-[var(--pill-info-border)] bg-[var(--pill-info-bg)] text-[var(--info)]',
                                                                    )}
                                                                >
                                                                    {ct.badge}
                                                                </span>
                                                            </div>
                                                            <p className="text-[12px] text-muted-foreground leading-relaxed">
                                                                {ct.hint}
                                                            </p>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                />
                                {errors.caseType && (
                                    <p className="mt-1 text-[12px] text-[var(--negative)]">
                                        {errors.caseType.message}
                                    </p>
                                )}
                            </div>

                            {/* Dates Grid */}
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
                                    label="Tanggal Mulai Demam (Onset)"
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

                            {/* Lab Parameters */}
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <Label htmlFor="f-platelet">
                                        Trombosit Terakhir (sel/µL)
                                    </Label>
                                    <ControllerField
                                        name="plateletCount"
                                        control={control}
                                        error={errors.plateletCount?.message}
                                        render={({ id, value, onChange, invalid }) => (
                                            <div className="relative mt-1.5 flex items-center">
                                                <NumericFormat
                                                    id={id}
                                                    value={typeof value === 'number' || typeof value === 'string' ? value : ''}
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
                                                        'h-[var(--control-height)] w-full rounded-[var(--radius-control)] border border-[var(--control)] bg-[var(--surface)] px-3 text-[13.5px] text-foreground outline-none transition-colors placeholder:text-faint focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/25',
                                                        invalid &&
                                                            'border-[var(--negative)] ring-2 ring-[var(--negative)]/20',
                                                    )}
                                                />
                                            </div>
                                        )}
                                    />
                                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                                        Nilai &lt; 100.000 sel/µL masuk kriteria trombositopenia
                                    </p>
                                </div>

                                <div>
                                    <Label htmlFor="f-hematocrit">Hematokrit (%)</Label>
                                    <Input
                                        id="f-hematocrit"
                                        type="number"
                                        step="0.1"
                                        min={0}
                                        max={100}
                                        placeholder="Contoh: 42.5"
                                        {...register('hematocrit')}
                                        className="mt-1.5"
                                    />
                                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                                        Kenaikan ≥ 20% mengindikasikan hemokonsentrasi
                                    </p>
                                </div>
                            </div>

                            {/* RDT Rapid Test Grid (3 Columns) */}
                            <div>
                                <Label className="mb-2 block font-semibold text-foreground">
                                    Hasil Pemeriksaan Serologi / RDT Dengue
                                </Label>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    {/* NS1 */}
                                    <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/30 p-3 space-y-1.5">
                                        <Label htmlFor="f-ns1" className="text-[12.5px] font-medium">
                                            NS1 Antigen
                                        </Label>
                                        <div className="relative">
                                            <select
                                                id="f-ns1"
                                                {...register('ns1Result')}
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

                                    {/* IgM */}
                                    <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/30 p-3 space-y-1.5">
                                        <Label htmlFor="f-igm" className="text-[12.5px] font-medium">
                                            IgM Anti-Dengue
                                        </Label>
                                        <div className="relative">
                                            <select
                                                id="f-igm"
                                                {...register('igmResult')}
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

                                    {/* IgG */}
                                    <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/30 p-3 space-y-1.5">
                                        <Label htmlFor="f-igg" className="text-[12.5px] font-medium">
                                            IgG Anti-Dengue
                                        </Label>
                                        <div className="relative">
                                            <select
                                                id="f-igg"
                                                {...register('iggResult')}
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
                                </div>
                            </div>

                            {/* Catatan Diagnosis Tambahan */}
                            <div>
                                <Label htmlFor="f-diagnosis">
                                    Catatan Klinis / Komplikasi Tambahan (Opsional)
                                </Label>
                                <Textarea
                                    id="f-diagnosis"
                                    rows={3}
                                    placeholder="Catatan gejala penyerta, penyakit komorbid, atau kondisi klinis khusus..."
                                    {...register('diagnosis')}
                                    className="mt-1.5 text-[13.5px]"
                                />
                            </div>
                        </div>
                    </Panel>

                    {/* Bottom Primary Action Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
                        <div className="flex items-center gap-3">
                            <div
                                className={cn(
                                    'grid size-10 shrink-0 place-items-center rounded-xl transition-colors',
                                    pct === 100
                                        ? 'bg-[var(--positive)]/15 text-[var(--positive)]'
                                        : 'bg-[var(--accent)]/15 text-[var(--accent)]',
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
                                    Target investigasi PE Puskesmas wilayah ≤ 24 jam sejak laporan dikirim.
                                </p>
                            </div>
                        </div>

                        <div className="flex w-full sm:w-auto items-center gap-2.5">
                            <Button
                                asChild
                                variant="outline"
                                className="h-10 flex-1 sm:flex-none px-4 text-[13px]"
                            >
                                <Link href="/laporan">Batalkan & Kembali</Link>
                            </Button>
                            <Button
                                type="submit"
                                disabled={submitting}
                                className="h-10 flex-1 sm:flex-none px-5 text-[13.5px] font-semibold gap-2 shadow-sm"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" />
                                        <span>Menyimpan Laporan…</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="size-4" />
                                        <span>Kirim laporan kasus</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Right Sticky Column: Compact Validation & SLA Assistant */}
                <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
                    {/* Compact Validation & SLA Card */}
                    <Panel
                        padded
                        title="Validasi & Protokol SLA"
                        subtitle="Kriteria data minimum dan alur respon"
                    >
                        <div className="space-y-4">
                            {/* Progress Bar */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[12px]">
                                    <span className="font-medium text-foreground">
                                        Kelengkapan Berkas
                                    </span>
                                    <span
                                        data-numeric
                                        className={cn(
                                            'font-semibold tabular-nums text-[12px]',
                                            pct === 100
                                                ? 'text-[var(--positive)]'
                                                : 'text-[var(--accent)]',
                                        )}
                                    >
                                        {pct}% ({checklist.completed}/{checklist.total})
                                    </span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--raised)]">
                                    <div
                                        className={cn(
                                            'h-full rounded-full transition-all duration-300',
                                            pct === 100
                                                ? 'bg-[var(--positive)]'
                                                : 'bg-[var(--accent)]',
                                        )}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>

                            {/* Checklist Items */}
                            <ul className="divide-y divide-[var(--rule)] text-[12px]">
                                {checklist.items.map((item) => (
                                    <li
                                        key={item.key}
                                        className="flex items-center gap-2 py-1.5 transition-colors"
                                    >
                                        {item.done ? (
                                            <CheckCircle2
                                                className="size-3.5 shrink-0 text-[var(--positive)]"
                                                aria-hidden
                                            />
                                        ) : (
                                            <Circle
                                                className="size-3.5 shrink-0 text-muted-foreground/40"
                                                aria-hidden
                                            />
                                        )}
                                        <span
                                            className={
                                                item.done
                                                    ? 'text-foreground font-medium'
                                                    : 'text-muted-foreground'
                                            }
                                        >
                                            {item.label}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            {/* Compact SLA Box */}
                            <div className="rounded-lg border border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] p-2.5 text-[11.5px] text-[var(--warning)]">
                                <div className="flex items-start gap-2">
                                    <Clock className="mt-0.5 size-3.5 shrink-0" />
                                    <div>
                                        <p className="font-semibold text-foreground">
                                            Respon Puskesmas: ≤ 24 Jam
                                        </p>
                                        <p className="mt-0.5 text-muted-foreground leading-relaxed">
                                            Otomatis ditugaskan ke Puskesmas kelurahan domisili pasien.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Submit Button in Sidebar */}
                            <Button
                                type="submit"
                                disabled={submitting}
                                className="h-10 w-full text-[13px] font-semibold gap-2 shadow-xs"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" />
                                        <span>Menyimpan…</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="size-4" />
                                        <span>Kirim laporan kasus</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </Panel>
                </aside>
            </div>
        </form>
    );
}

function Field({
    label,
    placeholder,
    error,
    reg,
    required = false,
    type = 'text',
    min,
    max,
    className,
}: {
    label: string;
    placeholder?: string;
    error?: string;
    reg: UseFormRegisterReturn;
    required?: boolean;
    type?: string;
    min?: number;
    max?: number;
    className?: string;
}) {
    const invalid = Boolean(error);
    const id = `f-${reg.name}`;

    return (
        <div className={className}>
            <Label htmlFor={id}>
                {label}
                {required && (
                    <span className="text-[var(--negative)]" aria-hidden>
                        {' '}*
                    </span>
                )}
            </Label>
            <Input
                id={id}
                type={type}
                min={min}
                max={max}
                placeholder={placeholder}
                aria-invalid={invalid ? true : undefined}
                aria-describedby={invalid ? `${id}-err` : undefined}
                {...reg}
                className={cn('mt-1.5', invalid && 'border-[var(--negative)] ring-2 ring-[var(--negative)]/20')}
            />
            {error && (
                <p
                    id={`${id}-err`}
                    role="alert"
                    className="mt-1 text-[12px] text-[var(--negative)]"
                >
                    {error}
                </p>
            )}
        </div>
    );
}

function ControllerField({
    name,
    label,
    required = false,
    error,
    control,
    render,
    className,
}: {
    name: keyof FormValues;
    label?: string;
    required?: boolean;
    error?: string;
    control: Control<FormValues>;
    render: (props: {
        id: string;
        value: unknown;
        onChange: (v: unknown) => void;
        invalid: boolean;
    }) => React.ReactElement | null;
    className?: string;
}) {
    const id = `f-${String(name)}`;
    const invalid = Boolean(error);

    return (
        <div className={className}>
            {label && (
                <Label htmlFor={id}>
                    {label}
                    {required && (
                        <span className="text-[var(--negative)]" aria-hidden>
                            {' '}*
                        </span>
                    )}
                </Label>
            )}
            <Controller
                name={name}
                control={control}
                render={({ field }) =>
                    (render({
                        id,
                        value: field.value,
                        onChange: field.onChange,
                        invalid,
                    }) as React.ReactElement)
                }
            />
            {error && (
                <p role="alert" className="mt-1 text-[12px] text-[var(--negative)]">
                    {error}
                </p>
            )}
        </div>
    );
}
