'use client';

import {
    Controller,
    useFieldArray,
    useForm,
    useWatch,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import {
    CheckCircle2,
    Database,
    Plus,
    Trash2,
    UserCheck,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { createPeSchema } from '@/lib/domain/form-contracts';
import type { PeCandidateDetail } from '@/lib/domain/pe';
import { DateField } from '@/components/ui/date-field';
import { AttachmentDropzone } from '@/components/reports/attachment-dropzone';
import { useEntomologyCalculator } from '@/hooks/use-entomology-calculator';
import { cn } from '@/lib/utils';
import { submitPe } from './actions';

type FormValues = z.input<typeof createPeSchema>;
type Household = FormValues['households'][number];

const PRESET_SYMPTOMS = [
    'Demam',
    'Mual',
    'Muntah',
    'Sakit kepala',
    'Tidak nafsu makan',
    'Nyeri otot / sendi',
    'Ruam / bintik merah (petekie)',
    'Uji Torniket positif',
    'Mimisan / gusi berdarah',
];

const RELATION_PRESETS = [
    'Orang tua',
    'Suami / Istri',
    'Anak',
    'Saudara serumah',
    'Tetangga',
    'Teman kantor / sekolah',
];

const FIRST_ACTIONS = [
    'Berobat ke Puskesmas',
    'Berobat ke dokter praktek swasta',
    'Berobat ke klinik',
    'Berobat ke RS',
    'Swamedikasi / Lainnya',
];

const STEPS = [
    { id: 0, label: '1. Kasus & Responden' },
    { id: 1, label: '2. Penyakit & Lab' },
    { id: 2, label: '3. Jentik (40+ Rumah)' },
    { id: 3, label: '4. Kondisi & Pengesahan' },
] as const;

const emptyHouse = (num = 1): Household => ({
    address: `Rumah #${num}`,
    houseCount: 1,
    population: 4,
    larvaCount: 0,
    larvaType: 'Aedes aegypti',
    abateUsed: false,
    insidePositive: false,
    outsidePositive: false,
    containersChecked: 2,
    positiveContainers: 0,
});

function buildInitialHouses(count = 40): Household[] {
    return Array.from({ length: count }, (_, i) => emptyHouse(i + 1));
}

function toIsoDate(value: Date | string | null | undefined): Date | undefined {
    if (!value) return undefined;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

function toDateInputString(value: unknown): string | undefined {
    if (!value) return undefined;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }
    if (typeof value === 'string') return value.slice(0, 10);
    return undefined;
}

export function PeForm({
    candidates,
    initialReportId,
    defaultOfficerName,
}: {
    candidates: PeCandidateDetail[];
    initialReportId?: string;
    defaultOfficerName: string;
}) {
    const router = useRouter();
    const [submitting, start] = useTransition();
    const [step, setStep] = useState(0);
    const [customSymptom, setCustomSymptom] = useState('');
    const [houseFilter, setHouseFilter] = useState<'ALL' | 'POS' | 'NEG'>('ALL');

    const initialCandidate =
        candidates.find((c) => c.id === initialReportId) ?? candidates[0];

    const {
        register,
        control,
        handleSubmit,
        setValue,
        formState: { errors },
    } = useForm<FormValues, unknown, z.output<typeof createPeSchema>>({
        resolver: zodResolver(createPeSchema),
        mode: 'onTouched',
        defaultValues: {
            reportRSId: initialCandidate?.id ?? '',
            peDate: new Date(),
            officerName: defaultOfficerName,
            respondentAddress: initialCandidate?.patientAddress ?? '',
            symptomOnsetDate: toIsoDate(initialCandidate?.symptomOnsetDate),
            clinicalSymptoms: initialCandidate?.diagnosis
                ? ['Demam']
                : [],
            dengueAttackOrder: 'Kesatu',
            labRdtNs1: initialCandidate?.dengueBlot ?? 'TIDAK_DIPERIKSA',
            labIgm: initialCandidate?.igm ?? 'TIDAK_DIPERIKSA',
            labIgg: initialCandidate?.igg ?? 'TIDAK_DIPERIKSA',
            labPlatelet: initialCandidate?.plateletCount ?? undefined,
            labHematocrit: initialCandidate?.hematocrit ?? undefined,
            hasOtherDenguePatients: false,
            otherFeverCasesCount: 0,
            currentPatientCondition: 'Masih dalam perawatan',
            households: buildInitialHouses(40),
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'households',
    });

    const selectedReportId = useWatch({ control, name: 'reportRSId' });
    const watchedHouseholds = useWatch({ control, name: 'households' });
    const rawWatchedSymptoms = useWatch({ control, name: 'clinicalSymptoms' });
    const watchedSymptoms = useMemo(
        () => rawWatchedSymptoms ?? [],
        [rawWatchedSymptoms],
    );
    const watchedRelation = useWatch({ control, name: 'respondentRelation' }) ?? '';
    const watchedFirstAction = useWatch({ control, name: 'firstActionTaken' }) ?? '';
    const watchedCondition = useWatch({ control, name: 'currentPatientCondition' }) ?? '';
    const hasOtherDengue = Boolean(
        useWatch({ control, name: 'hasOtherDenguePatients' }),
    );
    const otherFever = Number(
        useWatch({ control, name: 'otherFeverCasesCount' }) ?? 0,
    );

    const activeReport = useMemo(
        () => candidates.find((c) => c.id === selectedReportId) ?? initialCandidate,
        [candidates, selectedReportId, initialCandidate],
    );

    // Sync overlapping case-report fields automatically whenever selected report changes
    const prevReportIdRef = useRef<string | undefined>(initialCandidate?.id);
    useEffect(() => {
        if (!activeReport || prevReportIdRef.current === activeReport.id) return;
        prevReportIdRef.current = activeReport.id;

        setValue('labRdtNs1', activeReport.dengueBlot ?? 'TIDAK_DIPERIKSA');
        setValue('labIgm', activeReport.igm ?? 'TIDAK_DIPERIKSA');
        setValue('labIgg', activeReport.igg ?? 'TIDAK_DIPERIKSA');
        setValue('labPlatelet', activeReport.plateletCount ?? undefined);
        setValue('labHematocrit', activeReport.hematocrit ?? undefined);
        setValue('symptomOnsetDate', toIsoDate(activeReport.symptomOnsetDate));
        setValue('respondentAddress', activeReport.patientAddress ?? '');
    }, [activeReport, setValue]);

    const surveys = useMemo(
        () =>
            (watchedHouseholds ?? []).map((h, i) => {
                const insidePos =
                    Boolean(h.insidePositive) || Number(h.larvaCount ?? 0) > 0;
                const outsidePos = Boolean(h.outsidePositive);
                const containersChecked = Number(h.containersChecked ?? 2);
                const positiveContainers = Number(
                    h.positiveContainers ?? h.larvaCount ?? 0,
                );
                return {
                    houseNumber: i + 1,
                    houseOwner: h.address || `Rumah #${i + 1}`,
                    isInsideContainerPositive: insidePos,
                    isOutsideContainerPositive: outsidePos,
                    totalContainersChecked: containersChecked,
                    totalPositiveContainers: positiveContainers,
                };
            }),
        [watchedHouseholds],
    );

    const metrics = useEntomologyCalculator(
        surveys,
        hasOtherDengue,
        Number.isFinite(otherFever) ? otherFever : 0,
    );

    const customAddedSymptoms = useMemo(
        () => watchedSymptoms.filter((s) => !PRESET_SYMPTOMS.includes(s)),
        [watchedSymptoms],
    );

    function toggleSymptom(item: string) {
        const current = new Set(watchedSymptoms);
        if (current.has(item)) current.delete(item);
        else current.add(item);
        setValue('clinicalSymptoms', [...current]);
    }

    function addManualSymptom() {
        const clean = customSymptom.trim();
        if (!clean) return;
        if (watchedSymptoms.some((s) => s.toLowerCase() === clean.toLowerCase())) {
            setCustomSymptom('');
            return;
        }
        setValue('clinicalSymptoms', [...watchedSymptoms, clean]);
        setCustomSymptom('');
    }

    function addMoreHouses(count: number) {
        const startNum = fields.length + 1;
        const rows = Array.from({ length: count }, (_, idx) =>
            emptyHouse(startNum + idx),
        );
        append(rows);
    }

    function syncHouseLarvaState(idx: number, nextInside: boolean, nextOutside: boolean, nextPosContainers: number) {
        const isPos = nextInside || nextOutside || nextPosContainers > 0;
        setValue(`households.${idx}.larvaCount`, isPos ? 1 : 0);
    }

    const onSubmit = handleSubmit(
        (data) => {
            const fd = new FormData();
            fd.set('reportRSId', data.reportRSId);
            fd.set('peDate', data.peDate.toISOString());
            fd.set('officerName', data.officerName);
            if (data.officerNip) fd.set('officerNip', data.officerNip);
            if (data.headOfPuskesmasName)
                fd.set('headOfPuskesmasName', data.headOfPuskesmasName);
            if (data.headOfPuskesmasNip)
                fd.set('headOfPuskesmasNip', data.headOfPuskesmasNip);
            if (data.respondentName) fd.set('respondentName', data.respondentName);
            if (data.respondentRelation)
                fd.set('respondentRelation', data.respondentRelation);
            if (data.respondentAge !== undefined)
                fd.set('respondentAge', String(data.respondentAge));
            if (data.respondentAddress)
                fd.set('respondentAddress', data.respondentAddress);
            if (data.respondentJob) fd.set('respondentJob', data.respondentJob);
            if (data.patientJob) fd.set('patientJob', data.patientJob);
            if (data.mainComplaint) fd.set('mainComplaint', data.mainComplaint);
            if (data.symptomOnsetDate)
                fd.set('symptomOnsetDate', data.symptomOnsetDate.toISOString());
            if (data.firstActionTaken)
                fd.set('firstActionTaken', data.firstActionTaken);
            if (data.dengueAttackOrder)
                fd.set('dengueAttackOrder', data.dengueAttackOrder);
            if (data.comorbidity) fd.set('comorbidity', data.comorbidity);
            if (data.travelHistory14d)
                fd.set('travelHistory14d', data.travelHistory14d);
            fd.set(
                'clinicalSymptoms',
                JSON.stringify(data.clinicalSymptoms ?? []),
            );
            if (data.labRdtNs1) fd.set('labRdtNs1', data.labRdtNs1);
            if (data.labIgm) fd.set('labIgm', data.labIgm);
            if (data.labIgg) fd.set('labIgg', data.labIgg);
            if (data.labPlatelet !== undefined)
                fd.set('labPlatelet', String(data.labPlatelet));
            if (data.labHematocrit !== undefined)
                fd.set('labHematocrit', String(data.labHematocrit));
            fd.set(
                'hasOtherDenguePatients',
                data.hasOtherDenguePatients ? 'true' : 'false',
            );
            if (data.otherFeverCasesCount !== undefined)
                fd.set('otherFeverCasesCount', String(data.otherFeverCasesCount));
            if (data.treatmentGiven)
                fd.set('treatmentGiven', data.treatmentGiven);
            if (data.currentPatientCondition)
                fd.set('currentPatientCondition', data.currentPatientCondition);
            if (data.sourceLocation)
                fd.set('sourceLocation', data.sourceLocation);
            if (data.conclusion) fd.set('conclusion', data.conclusion);
            if (data.recommendation)
                fd.set('recommendation', data.recommendation);
            if (data.additionalNotes)
                fd.set('additionalNotes', data.additionalNotes);
            fd.set('households', JSON.stringify(data.households));

            start(async () => {
                const res = await submitPe({}, fd);
                if (!res.ok) {
                    const msg =
                        res.error ??
                        (res.fieldErrors
                            ? Object.values(res.fieldErrors)[0]
                            : undefined) ??
                        'Gagal menyimpan PE.';
                    toast.error(msg);
                    return;
                }
                toast.success(
                    `PE tersimpan (${metrics.transmissionRisk === 'POSITIF_PENULARAN' ? 'Positif Penularan' : 'Negatif Penularan'}).`,
                );
                router.push('/pe');
            });
        },
        (fieldErrors) => {
            const count = Object.keys(fieldErrors).length;
            if (count > 0) {
                toast.error(
                    `Ada ${count} bagian formulir yang belum valid. Periksa kembali isian yang ditandai merah.`,
                );
            }
        },
    );

    const filteredIndices = useMemo(() => {
        return fields
            .map((_, idx) => {
                const row = watchedHouseholds?.[idx];
                const isPos =
                    Boolean(row?.insidePositive) ||
                    Boolean(row?.outsidePositive) ||
                    Number(row?.positiveContainers ?? 0) > 0;
                return { idx, isPos };
            })
            .filter(({ isPos }) => {
                if (houseFilter === 'POS') return isPos;
                if (houseFilter === 'NEG') return !isPos;
                return true;
            });
    }, [fields, watchedHouseholds, houseFilter]);

    const hasCaseLabData = Boolean(
        activeReport &&
            ((activeReport.dengueBlot && activeReport.dengueBlot !== 'TIDAK_DIPERIKSA') ||
                (activeReport.igm && activeReport.igm !== 'TIDAK_DIPERIKSA') ||
                (activeReport.igg && activeReport.igg !== 'TIDAK_DIPERIKSA') ||
                activeReport.plateletCount !== null ||
                activeReport.hematocrit !== null),
    );

    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-24 md:pb-6">
            {/* Compact Live Entomology Bar */}
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                        <MetricReadout
                            label="Rumah"
                            value={`${fields.length}`}
                            sub={`${metrics.positiveHousesCount} (+)`}
                        />
                        <MetricReadout
                            label="ABJ"
                            value={`${metrics.abj}%`}
                            tone={metrics.abj >= 95 ? 'good' : 'bad'}
                        />
                        <MetricReadout
                            label="HI"
                            value={`${metrics.hi}%`}
                            tone={metrics.hi < 5 ? 'good' : 'bad'}
                        />
                        <MetricReadout
                            label="CI"
                            value={`${metrics.ci}%`}
                            tone={metrics.ci < 10 ? 'good' : 'bad'}
                        />
                        <MetricReadout
                            label="BI"
                            value={`${metrics.bi}%`}
                            tone={metrics.bi < 50 ? 'good' : 'bad'}
                        />
                    </div>
                    <span
                        className={cn(
                            'rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold',
                            metrics.transmissionRisk === 'POSITIF_PENULARAN'
                                ? 'border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)]'
                                : 'border-[var(--pill-positive-border)] bg-[var(--pill-positive-bg)] text-[var(--pill-positive-ink)]',
                        )}
                    >
                        {metrics.transmissionRisk === 'POSITIF_PENULARAN'
                            ? 'Positif Penularan · Fogging Fokus'
                            : 'Negatif Penularan · PSN 3M Plus'}
                    </span>
                </div>
            </div>

            {/* Segmented Stepper Navigation */}
            <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--raised)]/60 p-1 sm:grid-cols-4">
                {STEPS.map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => setStep(s.id)}
                        className={cn(
                            'rounded-[var(--radius-control)] px-3 py-2 text-left text-[12.5px] font-medium transition-all',
                            step === s.id
                                ? 'bg-[var(--surface)] text-[var(--accent)] shadow-xs ring-1 ring-[var(--border)]'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* STEP 1: Kasus, Identitas Penderita (Auto) & Kepala Keluarga (Responden) */}
            {step === 0 && (
                <div className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
                    <div className="border-b border-[var(--border)] pb-3">
                        <h2 className="text-[15px] font-semibold">
                            Identitas Kasus, Penderita &amp; Kepala Keluarga (Responden)
                        </h2>
                        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                            Data penderita otomatis diambil dari Laporan Kasus terpilih agar tidak perlu diisi ulang.
                        </p>
                    </div>

                    {/* Case & Officer Row */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="flex flex-col gap-1.5 sm:col-span-1">
                            <Label htmlFor="reportRSId">Laporan Kasus</Label>
                            <Controller
                                control={control}
                                name="reportRSId"
                                render={({ field }) => (
                                    <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                    >
                                        <SelectTrigger id="reportRSId">
                                            <SelectValue placeholder="Pilih laporan..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                {candidates.map((c) => (
                                                    <SelectItem key={c.id} value={c.id}>
                                                        {c.reportNumber} · {c.kelurahan}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="peDate">Tanggal Penyelidikan</Label>
                            <Controller
                                control={control}
                                name="peDate"
                                render={({ field }) => (
                                    <DateField
                                        id="peDate"
                                        value={toDateInputString(field.value)}
                                        onChange={(val) =>
                                            field.onChange(
                                                val
                                                    ? new Date(`${val}T00:00:00`)
                                                    : undefined,
                                            )
                                        }
                                        aria-invalid={errors.peDate ? true : undefined}
                                    />
                                )}
                            />
                            {errors.peDate && (
                                <p className="text-[12px] text-[var(--negative)]">
                                    {errors.peDate.message}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="officerName">Nama Petugas PE</Label>
                            <Input
                                id="officerName"
                                {...register('officerName')}
                                aria-invalid={Boolean(errors.officerName)}
                            />
                            {errors.officerName && (
                                <p className="text-[12px] text-[var(--negative)]">
                                    {errors.officerName.message}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Auto-Populated Patient Identity Strip */}
                    {activeReport && (
                        <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/50 p-4">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
                                    <UserCheck className="size-3.5 text-[var(--accent)]" />
                                    Identitas Penderita (Otomatis dari Laporan Kasus)
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-[11px] font-medium text-[var(--accent)]">
                                    <Database className="size-3" />
                                    {activeReport.reportNumber}
                                </span>
                            </div>

                            <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-[12.5px] sm:grid-cols-2 lg:grid-cols-4">
                                <div>
                                    <dt className="text-muted-foreground">Nama Penderita</dt>
                                    <dd className="font-medium text-foreground">
                                        {activeReport.patientName || '—'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">NIK</dt>
                                    <dd className="font-mono tabular-nums text-foreground">
                                        {activeReport.patientNik || '—'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Umur / JK</dt>
                                    <dd className="tabular-nums text-foreground">
                                        {activeReport.patientAge} th ·{' '}
                                        {activeReport.patientGender === 'L'
                                            ? 'Laki-laki'
                                            : 'Perempuan'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">No. HP Kontak</dt>
                                    <dd className="font-mono tabular-nums text-foreground">
                                        {activeReport.phoneNumber || '—'}
                                    </dd>
                                </div>
                                <div className="sm:col-span-2 lg:col-span-3">
                                    <dt className="text-muted-foreground">Alamat Domisili</dt>
                                    <dd className="text-foreground">
                                        {activeReport.patientAddress || '—'}, Kel.{' '}
                                        {activeReport.kelurahan || '—'}, Kec.{' '}
                                        {activeReport.kecamatan || '—'}, {activeReport.kota || '—'}
                                    </dd>
                                </div>
                                <div>
                                    <Label htmlFor="patientJob" className="text-[12px] text-muted-foreground">
                                        Pekerjaan / Sekolah Penderita
                                    </Label>
                                    <Input
                                        id="patientJob"
                                        placeholder="Pelajar / Karyawan / dll"
                                        className="mt-1 h-8 bg-[var(--surface)] text-[12.5px]"
                                        {...register('patientJob')}
                                    />
                                </div>
                            </dl>
                        </div>
                    )}

                    {/* Respondent / Kepala Keluarga Section (Format PE DBD Revisi) */}
                    <div className="space-y-4">
                        <h3 className="text-[13.5px] font-semibold text-foreground">
                            Identitas Kepala Keluarga (Responden)
                        </h3>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="respondentName">Nama Kepala Keluarga / Responden</Label>
                                <Input
                                    id="respondentName"
                                    placeholder="Contoh: Bpk. Hendra"
                                    {...register('respondentName')}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="respondentAge">Umur Responden (th)</Label>
                                <Input
                                    id="respondentAge"
                                    type="number"
                                    min={1}
                                    max={120}
                                    placeholder="42"
                                    {...register('respondentAge')}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="respondentJob">Pekerjaan Responden</Label>
                                <Input
                                    id="respondentJob"
                                    placeholder="Wiraswasta / ASN / dll"
                                    {...register('respondentJob')}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="respondentRelation">Hubungan dengan Penderita</Label>
                                <Input
                                    id="respondentRelation"
                                    placeholder="Pilih di bawah atau ketik hubungan"
                                    {...register('respondentRelation')}
                                />
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                    {RELATION_PRESETS.map((rel) => (
                                        <button
                                            key={rel}
                                            type="button"
                                            onClick={() => setValue('respondentRelation', rel)}
                                            className={cn(
                                                'rounded-md border px-2 py-0.5 text-[11px] transition-colors',
                                                watchedRelation === rel
                                                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--accent)]'
                                                    : 'border-[var(--border)] bg-[var(--surface)] text-muted-foreground hover:text-foreground',
                                            )}
                                        >
                                            {rel}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <Label htmlFor="respondentAddress">Alamat Responden</Label>
                                    {activeReport?.patientAddress && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setValue(
                                                    'respondentAddress',
                                                    activeReport.patientAddress,
                                                )
                                            }
                                            className="text-[11px] font-medium text-[var(--accent)] hover:underline"
                                        >
                                            Samakan alamat penderita
                                        </button>
                                    )}
                                </div>
                                <Input
                                    id="respondentAddress"
                                    placeholder="Alamat lengkap KK / responden"
                                    {...register('respondentAddress')}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 2: Identitas Penyakit, Gejala Klinis (+ Manual) & Lab (Auto) */}
            {step === 1 && (
                <div className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
                    <div className="border-b border-[var(--border)] pb-3">
                        <h2 className="text-[15px] font-semibold">
                            Identitas Penyakit, Gejala Klinis &amp; Pemeriksaan Spesimen
                        </h2>
                        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                            Hasil lab (NS1, IgM, IgG, Trombosit, Hematokrit) dan tanggal mulai gejala otomatis ditarik dari Laporan Kasus.
                        </p>
                    </div>

                    {/* Disease History */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <Label htmlFor="mainComplaint">Keluhan / Gejala Utama</Label>
                            <Input
                                id="mainComplaint"
                                placeholder="Contoh: Demam tinggi mendadak sejak 3 hari lalu"
                                {...register('mainComplaint')}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <Label htmlFor="symptomOnsetDate">Tgl Muncul Gejala</Label>
                                {activeReport?.symptomOnsetDate && (
                                    <span className="text-[10.5px] font-medium text-[var(--accent)]">
                                        Dari laporan
                                    </span>
                                )}
                            </div>
                            <Controller
                                control={control}
                                name="symptomOnsetDate"
                                render={({ field }) => (
                                    <DateField
                                        id="symptomOnsetDate"
                                        value={toDateInputString(field.value)}
                                        onChange={(val) =>
                                            field.onChange(
                                                val
                                                    ? new Date(`${val}T00:00:00`)
                                                    : undefined,
                                            )
                                        }
                                    />
                                )}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="firstActionTaken">
                                Tindakan Pertama Saat Timbul Gejala
                            </Label>
                            <Input
                                id="firstActionTaken"
                                placeholder="Pilih opsi cepat atau ketik tindakan..."
                                {...register('firstActionTaken')}
                            />
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {FIRST_ACTIONS.map((act) => (
                                    <button
                                        key={act}
                                        type="button"
                                        onClick={() => setValue('firstActionTaken', act)}
                                        className={cn(
                                            'rounded-md border px-2 py-0.5 text-[11px] transition-colors',
                                            watchedFirstAction === act
                                                ? 'border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--accent)]'
                                                : 'border-[var(--border)] bg-[var(--surface)] text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {act}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="dengueAttackOrder">Serangan DBD ke-</Label>
                                <Controller
                                    control={control}
                                    name="dengueAttackOrder"
                                    render={({ field }) => (
                                        <Select
                                            value={field.value ?? 'Kesatu'}
                                            onValueChange={field.onChange}
                                        >
                                            <SelectTrigger id="dengueAttackOrder">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectItem value="Kesatu">Kesatu</SelectItem>
                                                    <SelectItem value="Kedua">Kedua</SelectItem>
                                                    <SelectItem value="Ketiga / Lebih">
                                                        Ketiga / Lebih
                                                    </SelectItem>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="comorbidity">Penyakit Lain / Komorbid</Label>
                                <Input
                                    id="comorbidity"
                                    placeholder="Tidak ada / sebutkan..."
                                    {...register('comorbidity')}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Clinical Symptoms Checklist + Custom Manual Adder */}
                    <div className="flex flex-col gap-2.5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/30 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <Label className="text-[13px] font-semibold">
                                Gejala Klinis yang Timbul
                            </Label>
                            <span className="text-[11.5px] text-muted-foreground tabular-nums">
                                {watchedSymptoms.length} gejala dipilih
                            </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {PRESET_SYMPTOMS.map((sym) => {
                                const active = watchedSymptoms.includes(sym);
                                return (
                                    <button
                                        key={sym}
                                        type="button"
                                        onClick={() => toggleSymptom(sym)}
                                        className={cn(
                                            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] transition-colors',
                                            active
                                                ? 'border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--accent)]'
                                                : 'border-[var(--border)] bg-[var(--surface)] text-foreground hover:bg-[var(--raised)]',
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'size-1.5 rounded-full',
                                                active
                                                    ? 'bg-[var(--accent)]'
                                                    : 'bg-muted-foreground/40',
                                            )}
                                        />
                                        {sym}
                                    </button>
                                );
                            })}

                            {customAddedSymptoms.map((sym) => (
                                <span
                                    key={sym}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] py-1 pr-2 pl-3 text-[12.5px] font-medium text-[var(--accent)]"
                                >
                                    {sym}
                                    <button
                                        type="button"
                                        onClick={() => toggleSymptom(sym)}
                                        aria-label={`Hapus gejala ${sym}`}
                                        className="rounded-full p-0.5 hover:bg-[var(--accent)]/15"
                                    >
                                        <X className="size-3" />
                                    </button>
                                </span>
                            ))}
                        </div>

                        {/* Manual symptom input */}
                        <div className="mt-1 flex gap-2">
                            <Input
                                value={customSymptom}
                                onChange={(e) => setCustomSymptom(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addManualSymptom();
                                    }
                                }}
                                placeholder="Tambah gejala lain secara manual (misal: nyeri ulu hati, ruam kulit) lalu tekan Enter..."
                                className="h-9 bg-[var(--surface)] text-[13px]"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 shrink-0 px-3"
                                onClick={addManualSymptom}
                            >
                                <Plus data-icon="inline-start" />
                                Tambah
                            </Button>
                        </div>
                    </div>

                    {/* Travel & Household Contact */}
                    <div className="grid grid-cols-1 gap-4 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/30 p-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium">
                                <input
                                    type="checkbox"
                                    checked={hasOtherDengue}
                                    onChange={(e) =>
                                        setValue(
                                            'hasOtherDenguePatients',
                                            e.target.checked,
                                        )
                                    }
                                />
                                Ada anggota serumah / tetangga radius 100m dengan gejala serupa
                            </label>
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="travelHistory14d" className="text-[12px]">
                                    Riwayat bepergian 7–14 hari terakhir
                                </Label>
                                <Input
                                    id="travelHistory14d"
                                    placeholder="Tidak ada / ke daerah mana..."
                                    className="bg-[var(--surface)]"
                                    {...register('travelHistory14d')}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="otherFeverCasesCount">
                                Jumlah penderita demam lain (serumah / radius 100m)
                            </Label>
                            <Input
                                id="otherFeverCasesCount"
                                type="number"
                                min={0}
                                className="bg-[var(--surface)]"
                                {...register('otherFeverCasesCount')}
                            />
                            <p className="text-[11.5px] text-muted-foreground">
                                ≥ 3 penderita demam tanpa sebab memicu status Positif Penularan.
                            </p>
                        </div>
                    </div>

                    {/* Lab Specimens (Auto-Populated from Case Report) */}
                    <div className="space-y-3 rounded-[var(--radius-control)] border border-[var(--border)] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h3 className="text-[13.5px] font-semibold">
                                    Spesimen Diperiksa &amp; Parameter Lab (NS1, IgM, IgG)
                                </h3>
                                <p className="text-[11.5px] text-muted-foreground">
                                    Otomatis terisi dari hasil lab Laporan Kasus RS/Puskesmas. Ubah hanya bila ada pemeriksaan ulang di lapangan.
                                </p>
                            </div>
                            {hasCaseLabData && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--accent)]">
                                    <Database className="size-3" />
                                    Diambil dari Laporan Kasus
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {(
                                [
                                    ['labRdtNs1', 'RDT NS1'],
                                    ['labIgm', 'IgM Anti-Dengue'],
                                    ['labIgg', 'IgG Anti-Dengue'],
                                ] as const
                            ).map(([name, label]) => (
                                <div key={name} className="flex flex-col gap-1.5">
                                    <Label htmlFor={name} className="text-[12.5px]">
                                        {label}
                                    </Label>
                                    <Controller
                                        control={control}
                                        name={name}
                                        render={({ field }) => (
                                            <Select
                                                value={field.value ?? 'TIDAK_DIPERIKSA'}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger id={name}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectItem value="TIDAK_DIPERIKSA">
                                                            Tidak diperiksa
                                                        </SelectItem>
                                                        <SelectItem value="POSITIF">
                                                            Positif (+)
                                                        </SelectItem>
                                                        <SelectItem value="NEGATIF">
                                                            Negatif (-)
                                                        </SelectItem>
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="labPlatelet" className="text-[12.5px]">
                                    Trombosit (/µL)
                                </Label>
                                <Input
                                    id="labPlatelet"
                                    type="number"
                                    min={0}
                                    placeholder="Contoh: 85000"
                                    {...register('labPlatelet')}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="labHematocrit" className="text-[12.5px]">
                                    Hematokrit (%)
                                </Label>
                                <Input
                                    id="labHematocrit"
                                    type="number"
                                    step="0.1"
                                    min={0}
                                    max={100}
                                    placeholder="Contoh: 44.5"
                                    {...register('labHematocrit')}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 3: Pemeriksaan Jentik (Default 40 Rumah & Bisa Tambah Lebih) */}
            {step === 2 && (
                <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-[15px] font-semibold">
                                Pemeriksaan Jentik Radius 100m ({fields.length} Rumah)
                            </h2>
                            <p className="text-[12.5px] text-muted-foreground">
                                Standar survei 40 rumah sekitar penderita (dapat ditambah lebih sesuai kondisi klaster).
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addMoreHouses(1)}
                            >
                                <Plus data-icon="inline-start" />
                                +1 Rumah
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addMoreHouses(5)}
                            >
                                <Plus data-icon="inline-start" />
                                +5 Rumah
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addMoreHouses(10)}
                            >
                                <Plus data-icon="inline-start" />
                                +10 Rumah
                            </Button>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] pb-3">
                        {(
                            [
                                ['ALL', `Semua (${fields.length})`],
                                ['POS', `Positif Jentik (${metrics.positiveHousesCount})`],
                                ['NEG', `Bebas Jentik (${metrics.negativeHousesCount})`],
                            ] as const
                        ).map(([key, text]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setHouseFilter(key)}
                                className={cn(
                                    'rounded-full border px-3 py-1 text-[12px] font-medium transition-colors',
                                    houseFilter === key
                                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                                        : 'border-[var(--border)] text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {text}
                            </button>
                        ))}
                    </div>

                    {/* Desktop Dense Clinical Table */}
                    <div className="hidden overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)] md:block">
                        <table className="ledger min-w-[820px]">
                            <thead>
                                <tr>
                                    <th className="w-10 text-center">#</th>
                                    <th>Nama KK / Alamat Rumah</th>
                                    <th className="w-20 text-right">Penghuni</th>
                                    <th className="w-24 text-right">TPA Periksa</th>
                                    <th className="w-24 text-right">TPA (+)</th>
                                    <th className="w-20 text-center">Dalam (+)</th>
                                    <th className="w-20 text-center">Luar (+)</th>
                                    <th className="w-20 text-center">Abate</th>
                                    <th className="w-12" />
                                </tr>
                            </thead>
                            <tbody>
                                {filteredIndices.map(({ idx, isPos }) => {
                                    const item = fields[idx];
                                    const row = watchedHouseholds?.[idx];
                                    return (
                                        <tr
                                            key={item.id}
                                            className={cn(
                                                isPos && 'bg-[var(--pill-negative-bg)]/50',
                                            )}
                                        >
                                            <td className="num text-center font-mono text-[12px] text-muted-foreground">
                                                {idx + 1}
                                            </td>
                                            <td>
                                                <Input
                                                    aria-label={`Alamat rumah ${idx + 1}`}
                                                    className="h-8 text-[12.5px]"
                                                    {...register(`households.${idx}.address`)}
                                                />
                                            </td>
                                            <td>
                                                <Input
                                                    aria-label={`Penghuni rumah ${idx + 1}`}
                                                    type="number"
                                                    min={0}
                                                    className="h-8 text-right font-mono text-[12.5px] tabular-nums"
                                                    {...register(`households.${idx}.population`)}
                                                />
                                            </td>
                                            <td>
                                                <Input
                                                    aria-label={`TPA diperiksa rumah ${idx + 1}`}
                                                    type="number"
                                                    min={0}
                                                    className="h-8 text-right font-mono text-[12.5px] tabular-nums"
                                                    {...register(
                                                        `households.${idx}.containersChecked`,
                                                    )}
                                                />
                                            </td>
                                            <td>
                                                <Input
                                                    aria-label={`TPA positif rumah ${idx + 1}`}
                                                    type="number"
                                                    min={0}
                                                    className="h-8 text-right font-mono text-[12.5px] tabular-nums"
                                                    {...register(
                                                        `households.${idx}.positiveContainers`,
                                                        {
                                                            onChange: (e) => {
                                                                const pos = Number(
                                                                    e.target.value || 0,
                                                                );
                                                                syncHouseLarvaState(
                                                                    idx,
                                                                    Boolean(row?.insidePositive),
                                                                    Boolean(row?.outsidePositive),
                                                                    pos,
                                                                );
                                                            },
                                                        },
                                                    )}
                                                />
                                            </td>
                                            <td className="text-center">
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Jentik dalam rumah ${idx + 1}`}
                                                    className="size-4 accent-[var(--accent)]"
                                                    {...register(
                                                        `households.${idx}.insidePositive`,
                                                        {
                                                            onChange: (e) =>
                                                                syncHouseLarvaState(
                                                                    idx,
                                                                    e.target.checked,
                                                                    Boolean(row?.outsidePositive),
                                                                    Number(
                                                                        row?.positiveContainers ?? 0,
                                                                    ),
                                                                ),
                                                        },
                                                    )}
                                                />
                                            </td>
                                            <td className="text-center">
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Jentik luar rumah ${idx + 1}`}
                                                    className="size-4 accent-[var(--accent)]"
                                                    {...register(
                                                        `households.${idx}.outsidePositive`,
                                                        {
                                                            onChange: (e) =>
                                                                syncHouseLarvaState(
                                                                    idx,
                                                                    Boolean(row?.insidePositive),
                                                                    e.target.checked,
                                                                    Number(
                                                                        row?.positiveContainers ?? 0,
                                                                    ),
                                                                ),
                                                        },
                                                    )}
                                                />
                                            </td>
                                            <td className="text-center">
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Abate rumah ${idx + 1}`}
                                                    className="size-4 accent-[var(--accent)]"
                                                    {...register(`households.${idx}.abateUsed`)}
                                                />
                                            </td>
                                            <td className="text-center">
                                                {fields.length > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label={`Hapus rumah ${idx + 1}`}
                                                        onClick={() => remove(idx)}
                                                    >
                                                        <Trash2 className="size-3.5 text-muted-foreground" />
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Compact Cards */}
                    <div className="flex flex-col gap-2.5 md:hidden">
                        {filteredIndices.map(({ idx, isPos }) => {
                            const item = fields[idx];
                            const row = watchedHouseholds?.[idx];
                            return (
                                <div
                                    key={item.id}
                                    className={cn(
                                        'flex flex-col gap-2.5 rounded-[var(--radius-control)] border border-[var(--border)] p-3',
                                        isPos && 'border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)]/40',
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[12px] font-semibold text-muted-foreground">
                                            #{idx + 1}
                                        </span>
                                        <Input
                                            className="h-8 flex-1 text-[13px]"
                                            {...register(`households.${idx}.address`)}
                                        />
                                        {fields.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => remove(idx)}
                                            >
                                                <Trash2 className="size-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <Label className="text-[11px] text-muted-foreground">
                                                Penghuni
                                            </Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                className="h-8 text-[12.5px] tabular-nums"
                                                {...register(`households.${idx}.population`)}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px] text-muted-foreground">
                                                TPA Periksa
                                            </Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                className="h-8 text-[12.5px] tabular-nums"
                                                {...register(
                                                    `households.${idx}.containersChecked`,
                                                )}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px] text-muted-foreground">
                                                TPA (+)
                                            </Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                className="h-8 text-[12.5px] tabular-nums"
                                                {...register(
                                                    `households.${idx}.positiveContainers`,
                                                    {
                                                        onChange: (e) => {
                                                            const pos = Number(e.target.value || 0);
                                                            syncHouseLarvaState(
                                                                idx,
                                                                Boolean(row?.insidePositive),
                                                                Boolean(row?.outsidePositive),
                                                                pos,
                                                            );
                                                        },
                                                    },
                                                )}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4 pt-1 text-[12.5px]">
                                        <label className="inline-flex min-h-8 items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                className="size-4 accent-[var(--accent)]"
                                                {...register(
                                                    `households.${idx}.insidePositive`,
                                                    {
                                                        onChange: (e) =>
                                                            syncHouseLarvaState(
                                                                idx,
                                                                e.target.checked,
                                                                Boolean(row?.outsidePositive),
                                                                Number(row?.positiveContainers ?? 0),
                                                            ),
                                                    },
                                                )}
                                            />
                                            Dalam (+)
                                        </label>
                                        <label className="inline-flex min-h-8 items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                className="size-4 accent-[var(--accent)]"
                                                {...register(
                                                    `households.${idx}.outsidePositive`,
                                                    {
                                                        onChange: (e) =>
                                                            syncHouseLarvaState(
                                                                idx,
                                                                Boolean(row?.insidePositive),
                                                                e.target.checked,
                                                                Number(row?.positiveContainers ?? 0),
                                                            ),
                                                    },
                                                )}
                                            />
                                            Luar (+)
                                        </label>
                                        <label className="inline-flex min-h-8 items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                className="size-4 accent-[var(--accent)]"
                                                {...register(`households.${idx}.abateUsed`)}
                                            />
                                            Abate
                                        </label>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* STEP 4: Pengobatan, Kondisi Terakhir, Kesimpulan & Pengesahan */}
            {step === 3 && (
                <div className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
                    <div className="border-b border-[var(--border)] pb-3">
                        <h2 className="text-[15px] font-semibold">
                            Pengobatan, Kondisi Penderita &amp; Pengesahan Puskesmas
                        </h2>
                        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                            Ringkasan otomatis entomologi dihitung dari {fields.length} rumah yang diperiksa.
                        </p>
                    </div>

                    <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/50 p-3.5 text-[13px]">
                        <p className="font-semibold">
                            Rekomendasi Sistem: {metrics.actionPlan}
                        </p>
                        <p className="mt-1 font-mono text-[12px] text-muted-foreground tabular-nums">
                            {fields.length} Rumah · ABJ {metrics.abj}% · HI {metrics.hi}% · CI {metrics.ci}% · BI {metrics.bi}%
                        </p>
                    </div>

                    {/* Treatment & Last Condition (Format PE DBD Revisi) */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="treatmentGiven">Perawatan yang Diberikan</Label>
                            <Input
                                id="treatmentGiven"
                                placeholder="Rawat inap RS / Rawat jalan / Infus RL"
                                {...register('treatmentGiven')}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="currentPatientCondition">
                                Keadaan Penderita Saat Ini
                            </Label>
                            <Input
                                id="currentPatientCondition"
                                placeholder="Sembuh / Masih dalam perawatan / Meninggal"
                                {...register('currentPatientCondition')}
                            />
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {[
                                    'Sembuh',
                                    'Masih dalam perawatan',
                                    'Meninggal',
                                ].map((cond) => (
                                    <button
                                        key={cond}
                                        type="button"
                                        onClick={() =>
                                            setValue('currentPatientCondition', cond)
                                        }
                                        className={cn(
                                            'rounded-md border px-2 py-0.5 text-[11px] transition-colors',
                                            watchedCondition === cond
                                                ? 'border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--accent)]'
                                                : 'border-[var(--border)] bg-[var(--surface)] text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {cond}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <Label htmlFor="sourceLocation">
                                Dugaan Lokasi Sumber Penularan
                            </Label>
                            <Input
                                id="sourceLocation"
                                placeholder="Misal: Bak mandi terbuka rumah sebelah / selokan RT 04"
                                {...register('sourceLocation')}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="conclusion">
                                Kesimpulan Lapangan (Opsional)
                            </Label>
                            <Textarea
                                id="conclusion"
                                rows={3}
                                placeholder={metrics.actionPlan}
                                {...register('conclusion')}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="recommendation">
                                Rencana Tindak Lanjut / Catatan
                            </Label>
                            <Textarea
                                id="recommendation"
                                rows={3}
                                placeholder="Koordinasi fogging fokus, PSN 3M Plus, abatisasi..."
                                {...register('recommendation')}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-3">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="officerNip">NIP Petugas PE</Label>
                            <Input
                                id="officerNip"
                                placeholder="19850101 201001 1 001"
                                {...register('officerNip')}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="headOfPuskesmasName">
                                Mengetahui Kepala UPTD Puskesmas
                            </Label>
                            <Input
                                id="headOfPuskesmasName"
                                placeholder="dr. Siti Aminah, M.Kes"
                                {...register('headOfPuskesmasName')}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="headOfPuskesmasNip">
                                NIP Kepala Puskesmas
                            </Label>
                            <Input
                                id="headOfPuskesmasNip"
                                placeholder="19780101 200501 2 002"
                                {...register('headOfPuskesmasNip')}
                            />
                        </div>
                    </div>

                    {activeReport && (
                        <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
                            <div>
                                <h3 className="text-[13.5px] font-semibold">
                                    Lampiran Manual &amp; Dokumentasi Lapangan PE
                                </h3>
                                <p className="text-[12px] text-muted-foreground">
                                    Unggah hasil scan formulir PE manual (kertas), foto jentik/TPA positif, atau surat tugas lapangan (PDF, JPG, PNG, WEBP). Berkas otomatis tersimpan pada arsip laporan kasus {activeReport.reportNumber}.
                                </p>
                            </div>
                            <AttachmentDropzone reportRSId={activeReport.id} />
                        </div>
                    )}
                </div>
            )}

            {/* Wizard Bottom Navigation */}
            <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 shadow-[var(--elev-soft)] backdrop-blur-md md:static md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none md:backdrop-blur-none">
                <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                        <Link href="/pe">Batal</Link>
                    </Button>
                    {step > 0 && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setStep((s) => Math.max(0, s - 1))}
                        >
                            Sebelumnya
                        </Button>
                    )}
                </div>

                {step < STEPS.length - 1 ? (
                    <Button
                        type="button"
                        onClick={() =>
                            setStep((s) => Math.min(STEPS.length - 1, s + 1))
                        }
                    >
                        Lanjut ke {STEPS[step + 1]?.label}
                    </Button>
                ) : (
                    <Button type="submit" disabled={submitting}>
                        <CheckCircle2 data-icon="inline-start" />
                        {submitting ? 'Menyimpan PE...' : 'Simpan Hasil PE'}
                    </Button>
                )}
            </div>
        </form>
    );
}

function MetricReadout({
    label,
    value,
    sub,
    tone,
}: {
    label: string;
    value: string;
    sub?: string;
    tone?: 'good' | 'bad';
}) {
    return (
        <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
                {label}
            </span>
            <span
                data-numeric
                className={cn(
                    'font-mono text-[13.5px] font-semibold tabular-nums',
                    tone === 'good'
                        ? 'text-[var(--positive)]'
                        : tone === 'bad'
                          ? 'text-[var(--negative)]'
                          : 'text-foreground',
                )}
            >
                {value}
            </span>
            {sub && (
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {sub}
                </span>
            )}
        </div>
    );
}
