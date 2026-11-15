'use client';

import type { ReactElement } from 'react';
import {
    Controller,
    type Control,
    type UseFormRegisterReturn,
} from 'react-hook-form';
import {
    CheckCircle2,
    Circle,
    Clock,
    Paperclip,
    ShieldCheck,
} from 'lucide-react';
import type { z } from 'zod';
import { createReportSchema } from '@/lib/domain/form-contracts';
import { Panel } from '@/components/shell/page';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type FormValues = z.input<typeof createReportSchema>;

export type KelurahanOption = {
    name: string;
    kecamatan: string;
    kota: string;
    provinsi: string;
};

export const CASE_TYPES: {
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

export const LAB_RESULT_OPTIONS = [
    { value: 'TIDAK_DIPERIKSA', label: 'Tidak diperiksa' },
    { value: 'POSITIF', label: 'Positif (+)' },
    { value: 'NEGATIF', label: 'Negatif (-)' },
] as const;

export type ChecklistItem = {
    key: string;
    label: string;
    done: boolean;
    sectionId: string;
};

export function StepNavigator({
    steps,
}: {
    steps: { id: string; num: number; label: string; done: boolean }[];
}) {
    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <nav
            aria-label="Navigasi bagian formulir"
            className="grid grid-cols-2 gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-2xs sm:grid-cols-4"
        >
            {steps.map((s) => (
                <button
                    key={s.id}
                    type="button"
                    onClick={() => scrollTo(s.id)}
                    className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors',
                        s.done
                            ? 'bg-[var(--pill-positive-bg)]/55 text-foreground hover:bg-[var(--pill-positive-bg)]'
                            : 'bg-[var(--ground)]/60 text-muted-foreground hover:bg-[var(--raised)] hover:text-foreground',
                    )}
                >
                    <span
                        className={cn(
                            'grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums',
                            s.done
                                ? 'bg-[var(--positive)] text-white'
                                : 'border border-[var(--border)] bg-[var(--surface)] text-foreground',
                        )}
                    >
                        {s.done ? '✓' : s.num}
                    </span>
                    <span className="truncate text-[12px] font-medium">{s.label}</span>
                </button>
            ))}
        </nav>
    );
}

export function SummarySidebar({
    checklist,
    pct,
    stagedCount,
    patientName,
    kelurahan,
    caseType,
    sourceType,
}: {
    checklist: { items: ChecklistItem[]; completed: number; total: number };
    pct: number;
    stagedCount: number;
    patientName?: string;
    kelurahan?: string;
    caseType?: FormValues['caseType'];
    sourceType?: 'RS' | 'PUSKESMAS_POLI';
}) {
    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const activeCase = CASE_TYPES.find((c) => c.value === caseType);

    return (
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Panel
                padded
                title="Ringkasan & Kelengkapan"
                subtitle="Pratinjau cepat sebelum dikirim"
            >
                <div className="space-y-4">
                    {/* Live Mini Dossier */}
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--ground)]/70 p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {sourceType === 'PUSKESMAS_POLI'
                                    ? 'Poli / IGD Puskesmas'
                                    : 'KDRS Rumah Sakit'}
                            </span>
                            {activeCase && (
                                <span
                                    className={cn(
                                        'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                                        activeCase.tone === 'bad'
                                            ? 'bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)]'
                                            : activeCase.tone === 'warn'
                                              ? 'bg-[var(--pill-warning-bg)] text-[var(--pill-warning-ink)]'
                                              : 'bg-[var(--pill-info-bg)] text-[var(--pill-info-ink)]',
                                    )}
                                >
                                    {activeCase.label}
                                </span>
                            )}
                        </div>
                        <p className="truncate text-[13.5px] font-semibold text-foreground">
                            {patientName?.trim() ? patientName : 'Nama pasien belum diisi'}
                        </p>
                        <p className="truncate text-[11.5px] text-muted-foreground">
                            {kelurahan?.trim()
                                ? `Kel. ${kelurahan}`
                                : 'Kelurahan domisili belum ditentukan'}
                        </p>
                    </div>

                    {/* Progress */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[12px]">
                            <span className="font-medium text-foreground">
                                Kelengkapan Data Wajib
                            </span>
                            <span className="font-mono font-semibold tabular-nums text-[var(--accent)]">
                                {pct}%
                            </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--raised)]">
                            <div
                                className={cn(
                                    'h-full transition-all duration-300',
                                    pct === 100
                                        ? 'bg-[var(--positive)]'
                                        : 'bg-[var(--accent)]',
                                )}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>

                    {/* Checklist */}
                    <ul className="space-y-1.5">
                        {checklist.items.map((item) => (
                            <li key={item.key}>
                                <button
                                    type="button"
                                    onClick={() => scrollTo(item.sectionId)}
                                    className={cn(
                                        'flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12.5px] transition-colors hover:bg-[var(--raised)]',
                                        item.done
                                            ? 'text-foreground'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    {item.done ? (
                                        <CheckCircle2
                                            className="size-3.5 shrink-0 text-[var(--positive)]"
                                            aria-hidden
                                        />
                                    ) : (
                                        <Circle
                                            className="size-3.5 shrink-0 text-muted-foreground/45"
                                            aria-hidden
                                        />
                                    )}
                                    <span className="truncate">{item.label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>

                    {/* Staged Attachment Pill */}
                    <button
                        type="button"
                        onClick={() => scrollTo('sec-lampiran')}
                        className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--raised)]/40 px-3 py-2 text-[12px] transition-colors hover:bg-[var(--raised)]"
                    >
                        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                            <Paperclip className="size-3.5 text-[var(--accent)]" aria-hidden />
                            Lampiran Berkas
                        </span>
                        <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
                            {stagedCount > 0 ? `${stagedCount} berkas siap` : 'Opsional'}
                        </span>
                    </button>

                    {/* SLA Protocol Callout */}
                    <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--raised)]/35 p-3 text-[12px]">
                        <div className="flex items-center gap-2 font-semibold text-foreground">
                            <Clock className="size-3.5 text-[var(--accent)]" aria-hidden />
                            <span>Target Respon SLA 24 Jam</span>
                        </div>
                        <p className="leading-relaxed text-muted-foreground">
                            Puskesmas wilayah menerima penugasan otomatis dan wajib memverifikasi serta memulai PE dalam 24 jam.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
                        <ShieldCheck
                            className="size-4 shrink-0 text-[var(--positive)]"
                            aria-hidden
                        />
                        <span>
                            NIK, alamat & telepon dienkripsi AES-256-GCM sebelum disimpan.
                        </span>
                    </div>
                </div>
            </Panel>
        </aside>
    );
}

export function Field({
    label,
    placeholder,
    error,
    reg,
    required = false,
    type = 'text',
    min,
    max,
    step,
    suffix,
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
    step?: string;
    suffix?: string;
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
                        {' '}
                        *
                    </span>
                )}
            </Label>
            <div className="relative mt-1.5">
                <Input
                    id={id}
                    type={type}
                    min={min}
                    max={max}
                    step={step}
                    placeholder={placeholder}
                    aria-invalid={invalid ? true : undefined}
                    aria-describedby={invalid ? `${id}-err` : undefined}
                    {...reg}
                    className={cn(
                        suffix && 'pr-14',
                        invalid &&
                            'border-[var(--negative)] ring-2 ring-[var(--negative)]/20',
                    )}
                />
                {suffix && (
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11.5px] font-medium text-muted-foreground">
                        {suffix}
                    </span>
                )}
            </div>
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

export function ControllerField({
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
        onChange: (value: unknown) => void;
        invalid: boolean;
    }) => ReactElement;
    className?: string;
}) {
    const invalid = Boolean(error);
    const id = `f-${String(name)}`;

    return (
        <div className={className}>
            {label && (
                <Label htmlFor={id}>
                    {label}
                    {required && (
                        <span className="text-[var(--negative)]" aria-hidden>
                            {' '}
                            *
                        </span>
                    )}
                </Label>
            )}
            <Controller
                name={name}
                control={control}
                render={({ field }) =>
                    render({
                        id,
                        value: field.value,
                        onChange: field.onChange,
                        invalid,
                    })
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
