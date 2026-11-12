'use client';

import {
    Controller,
    useForm,
    type Control,
    type UseFormRegisterReturn,
} from 'react-hook-form';
import { PatternFormat } from 'react-number-format';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { createReportSchema } from '@/lib/domain/form-contracts';
import { DateField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { submitReport } from './actions';

// Derived from the schema, not restated: `z.coerce.number()` takes `unknown`
// as its input type, so a hand-written interface drifts from what the resolver
// actually accepts.
type FormValues = z.input<typeof createReportSchema>;

const CASE_TYPES: [FormValues['caseType'], string][] = [
    ['DENGUE', 'DBD'],
    ['SUSPECTED_DENGUE', 'Suspek DBD'],
    ['DHF', 'DHF'],
    ['DSS', 'DSS'],
];

/**
 * The browser gets the same schema the server enforces, so a field is never
 * rejected for a rule the user was not shown. The server still re-parses: this
 * half is a convenience, not the guard.
 */
export function ReportForm() {
    const router = useRouter();
    const [submitting, start] = useTransition();
    const [formError, setFormError] = useState<string | null>(null);

    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<FormValues, unknown, z.output<typeof createReportSchema>>({
        resolver: zodResolver(createReportSchema),
        defaultValues: { patientGender: 'L', caseType: 'DENGUE' },
    });

    const onSubmit = (values: z.output<typeof createReportSchema>) =>
        start(async () => {
            setFormError(null);

            const formData = new FormData();
            for (const [k, v] of Object.entries(values)) {
                if (v !== undefined && v !== null && v !== '') {
                    formData.set(k, String(v));
                }
            }

            const result = await submitReport({}, formData);

            if (result.ok) {
                toast.success('Laporan tersimpan', {
                    description:
                        'Puskesmas ditugaskan otomatis berdasarkan kelurahan.',
                });
                router.push('/laporan');
                return;
            }

            if (result.error) setFormError(result.error);
            if (result.fieldErrors) {
                toast.error('Periksa kembali isian yang ditandai.');
            }
        });

    return (
        <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="mt-8 max-w-3xl"
        >
            <Section title="Pasien">
                <Field
                    label="Nama lengkap"
                    error={errors.patientName?.message}
                    reg={register('patientName')}
                />
                <Field
                    label="NIK"
                    inputMode="numeric"
                    maxLength={16}
                    error={errors.patientNik?.message}
                    reg={register('patientNik')}
                />
                <Field
                    label="Umur (tahun)"
                    type="number"
                    error={errors.patientAge?.message}
                    reg={register('patientAge')}
                />
                <Field
                    label="Jenis kelamin"
                    error={errors.patientGender?.message}
                >
                    <select {...register('patientGender')} className={CONTROL}>
                        <option value="L">Laki-laki</option>
                        <option value="P">Perempuan</option>
                    </select>
                </Field>
                <Field
                    label="Alamat"
                    wide
                    error={errors.patientAddress?.message}
                    reg={register('patientAddress')}
                />
            </Section>

            <Section title="Wilayah">
                <Field
                    label="Kelurahan"
                    error={errors.kelurahan?.message}
                    reg={register('kelurahan')}
                />
                <Field
                    label="Kecamatan"
                    error={errors.kecamatan?.message}
                    reg={register('kecamatan')}
                />
                <Field
                    label="Kota"
                    error={errors.kota?.message}
                    reg={register('kota')}
                />
                <Field
                    label="Provinsi"
                    error={errors.provinsi?.message}
                    reg={register('provinsi')}
                />
            </Section>

            <Section title="Klinis">
                <Field label="Jenis kasus" error={errors.caseType?.message}>
                    <select {...register('caseType')} className={CONTROL}>
                        {CASE_TYPES.map(([value, text]) => (
                            <option key={value} value={value}>
                                {text}
                            </option>
                        ))}
                    </select>
                </Field>
                <DateInput
                    label="Tanggal masuk"
                    name="admissionDate"
                    control={control}
                    error={errors.admissionDate?.message}
                />
                <DateInput
                    label="Tanggal diagnosis"
                    name="diagnosisDate"
                    control={control}
                    error={errors.diagnosisDate?.message}
                />
                <DateInput
                    label="Awal gejala"
                    name="symptomOnsetDate"
                    control={control}
                    error={errors.symptomOnsetDate?.message}
                />
                <div>
                    <label
                        htmlFor="plateletCount"
                        className="text-[13px] font-medium"
                    >
                        Trombosit
                    </label>
                    {/* Grouped digits while typing: a platelet count read wrong
                        by one digit is a clinical error, not a typo. */}
                    <Controller
                        control={control}
                        name="plateletCount"
                        render={({ field }) => (
                            <NumericInput
                                id="plateletCount"
                                onValueChange={(v) =>
                                    field.onChange(v.floatValue)
                                }
                            />
                        )}
                    />
                    <FieldError message={errors.plateletCount?.message} />
                </div>
                <div>
                    <label
                        htmlFor="phoneNumber"
                        className="text-[13px] font-medium"
                    >
                        Telepon
                    </label>
                    <Controller
                        control={control}
                        name="phoneNumber"
                        render={({ field }) => (
                            <PhoneInput
                                id="phoneNumber"
                                defaultCountry="ID"
                                value={(field.value ?? '') as string}
                                onChange={field.onChange}
                                className="mt-1 flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--control)] px-3 text-[14px]"
                            />
                        )}
                    />
                    <FieldError message={errors.phoneNumber?.message} />
                </div>
                <Field label="Diagnosis" wide error={errors.diagnosis?.message}>
                    <Textarea
                        {...register('diagnosis')}
                        rows={2}
                        className="mt-1 py-2"
                    />
                </Field>
            </Section>

            {formError && (
                <p
                    role="alert"
                    className="mt-4 text-[13px] text-[var(--negative)]"
                >
                    {formError}
                </p>
            )}

            <div className="mt-6 flex items-center gap-3">
                <Button type="submit" className="h-9 px-3" disabled={submitting}>
                    {submitting ? 'Menyimpan…' : 'Kirim laporan'}
                </Button>
                <Link href="/laporan" className="text-[14px] underline">
                    Batal
                </Link>
            </div>
        </form>
    );
}

const CONTROL = 'mt-1 h-9';

/** A real fieldset: a legend outside one is not a group label at all. */
function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <fieldset className="mb-6 grid gap-x-6 gap-y-4 border-0 p-0 sm:grid-cols-2">
            <legend className="mb-3 text-[16px] font-medium">{title}</legend>
            {children}
        </fieldset>
    );
}

function Field({
    label,
    wide,
    error,
    reg,
    children,
    ...rest
}: {
    label: string;
    wide?: boolean;
    error?: string;
    reg?: UseFormRegisterReturn;
} & React.InputHTMLAttributes<HTMLInputElement>) {
    const id = `f-${reg?.name ?? label}`;

    return (
        <div className={wide ? 'sm:col-span-2' : undefined}>
            <Label htmlFor={id} className="text-[13px] font-medium">
                {label}
            </Label>
            {children ?? (
                <Input
                    id={id}
                    className={CONTROL}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-err` : undefined}
                    {...rest}
                    {...reg}
                />
            )}
            {error && (
                <span
                    id={`${id}-err`}
                    className="mt-1 block text-[12px] text-[var(--negative)]"
                >
                    {error}
                </span>
            )}
        </div>
    );
}

/** A calendar in place of the native date input, via `react-hook-form`. */
function DateInput<TName extends DateFieldName>({
    label,
    name,
    control,
    error,
}: {
    label: string;
    name: TName;
    control: Control<FormValues>;
    error?: string;
}) {
    const id = `f-${name}`;

    return (
        <div>
            <label htmlFor={id} className="text-[13px] font-medium">
                {label}
            </label>
            <Controller
                control={control}
                name={name}
                render={({ field }) => (
                    <DateField
                        id={id}
                        value={
                            typeof field.value === 'string'
                                ? field.value
                                : undefined
                        }
                        onChange={field.onChange}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? `${id}-err` : undefined}
                    />
                )}
            />
            <FieldError id={`${id}-err`} message={error} />
        </div>
    );
}

type DateFieldName = 'admissionDate' | 'diagnosisDate' | 'symptomOnsetDate';

/** Thousands-separated integer input; the form keeps the raw number. */
function NumericInput({
    id,
    onValueChange,
    ...rest
}: {
    id: string;
    onValueChange: (values: { floatValue?: number }) => void;
} & Omit<
    React.ComponentProps<typeof PatternFormat>,
    'format' | 'onValueChange'
>) {
    return (
        <PatternFormat
            id={id}
            format="#.###"
            allowEmptyFormatting
            className={CONTROL}
            onValueChange={onValueChange}
            {...rest}
        />
    );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
    if (!message) return null;
    return (
        <span
            id={id}
            role="alert"
            className="mt-1 block text-[12px] text-[var(--negative)]"
        >
            {message}
        </span>
    );
}
