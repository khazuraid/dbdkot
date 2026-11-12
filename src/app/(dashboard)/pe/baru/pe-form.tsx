'use client';

import {
    Controller,
    useFieldArray,
    useForm,
    useWatch,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { createPeSchema } from '@/lib/domain/form-contracts';
import { DateField } from '@/components/ui/date-field';
import { submitPe } from './actions';

type Candidate = { id: string; reportNumber: string };

// Input side of the schema (`z.coerce.number()` takes `unknown`), so the form
// and the server cannot disagree about what a household row is.
type FormValues = z.input<typeof createPeSchema>;
type Household = FormValues['households'][number] & {
    key?: string;
};

const emptyHouse = (): Household => ({
    address: '',
    houseCount: 1,
    population: 1,
    larvaCount: 0,
    larvaType: '',
    abateUsed: false,
});

export function PeForm({ candidates }: { candidates: Candidate[] }) {
    const router = useRouter();
    const [submitting, start] = useTransition();

    const {
        register,
        control,
        handleSubmit,
        setValue,
        formState: { errors },
    } = useForm<FormValues, unknown, z.output<typeof createPeSchema>>({
        resolver: zodResolver(createPeSchema),
        defaultValues: {
            officerName: '',
            households: [emptyHouse()],
        },
    });

    // A stable key per row: index keys make React reuse the wrong inputs after
    // a removal, which silently moves a value to the neighbouring house.
    const reportRSId = useWatch({ control, name: 'reportRSId' });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'households',
        keyName: 'key',
    });

    const onSubmit = (values: z.output<typeof createPeSchema>) =>
        start(async () => {
            const formData = new FormData();
            for (const [k, v] of Object.entries(values)) {
                if (k === 'households') continue;
                if (v !== undefined && v !== null && v !== '') {
                    formData.set(k, String(v));
                }
            }
            formData.set('households', JSON.stringify(values.households));

            const result = await submitPe({}, formData);

            if (result.ok) {
                toast.success('Laporan PE tersimpan', {
                    description: 'Laporan RS ditandai selesai PE.',
                });
                router.push('/pe');
                return;
            }

            if (result.error) toast.error(result.error);
        });

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8">
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <Label htmlFor="reportRSId">Laporan RS</Label>
                    {/* Radix Select renders no native input, so the id is held
                        in form state and mirrored into a hidden field. */}
                    <input
                        type="hidden"
                        value={reportRSId ?? ''}
                        {...register('reportRSId')}
                    />
                    <Select
                        value={reportRSId ?? ''}
                        onValueChange={(v) =>
                            setValue('reportRSId', v, {
                                shouldValidate: true,
                            })
                        }
                    >
                        <SelectTrigger id="reportRSId" className="mt-1 w-full">
                            <SelectValue placeholder="Pilih laporan" />
                        </SelectTrigger>
                        <SelectContent>
                            {candidates.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                    {c.reportNumber}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FieldError message={errors.reportRSId?.message} />
                </div>

                <div>
                    <Label htmlFor="peDate">Tanggal PE</Label>
                    <Controller
                        control={control}
                        name="peDate"
                        render={({ field }) => (
                            <DateField
                                id="peDate"
                                value={
                                    typeof field.value === 'string'
                                        ? field.value
                                        : undefined
                                }
                                onChange={field.onChange}
                                aria-invalid={
                                    errors.peDate ? true : undefined
                                }
                                aria-describedby={
                                    errors.peDate ? 'peDate-err' : undefined
                                }
                            />
                        )}
                    />
                    <FieldError
                        id="peDate-err"
                        message={errors.peDate?.message}
                    />
                </div>

                <div>
                    <Label htmlFor="officerName">Petugas</Label>
                    <Input
                        id="officerName"
                        className="mt-1"
                        aria-invalid={errors.officerName ? true : undefined}
                        {...register('officerName')}
                    />
                    <FieldError message={errors.officerName?.message} />
                </div>

                <div>
                    <Label htmlFor="sourceLocation">Lokasi sumber</Label>
                    <Input
                        id="sourceLocation"
                        className="mt-1"
                        {...register('sourceLocation')}
                    />
                </div>
            </div>

            <fieldset className="mt-8 border-0 p-0">
                <legend className="text-[16px] font-medium">
                    Pemeriksaan rumah
                </legend>
                <p className="mt-1 text-[13px] text-muted-foreground">
                    Jentik diperiksa per rumah; angka index dihitung dari baris
                    di bawah.
                </p>

                <div className="mt-4 space-y-4">
                    {fields.map((field, index) => (
                        <div
                            key={field.key}
                            className="grid gap-3 rounded-[var(--radius-card)] border border-border p-3 sm:grid-cols-6"
                        >
                            <div className="sm:col-span-2">
                                <Label htmlFor={`address-${index}`}>
                                    Alamat
                                </Label>
                                <Input
                                    id={`address-${index}`}
                                    className="mt-1"
                                    {...register(`households.${index}.address`)}
                                />
                                <FieldError
                                    message={
                                        errors.households?.[index]?.address
                                            ?.message
                                    }
                                />
                            </div>
                            <Num
                                id={`houseCount-${index}`}
                                label="Rumah"
                                min={1}
                                reg={register(`households.${index}.houseCount`)}
                                error={
                                    errors.households?.[index]?.houseCount
                                        ?.message
                                }
                            />
                            <Num
                                id={`population-${index}`}
                                label="Jiwa"
                                min={0}
                                reg={register(`households.${index}.population`)}
                                error={
                                    errors.households?.[index]?.population
                                        ?.message
                                }
                            />
                            <Num
                                id={`larvaCount-${index}`}
                                label="Positif jentik"
                                min={0}
                                reg={register(`households.${index}.larvaCount`)}
                                error={
                                    errors.households?.[index]?.larvaCount
                                        ?.message
                                }
                            />
                            <div className="flex items-end">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => remove(index)}
                                    disabled={fields.length === 1}
                                >
                                    Hapus
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                <FieldError message={errors.households?.message} />

                <Button
                    type="button"
                    variant="outline"
                    className="mt-3"
                    onClick={() => append(emptyHouse())}
                >
                    Tambah rumah
                </Button>
            </fieldset>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div>
                    <Label htmlFor="conclusion">Kesimpulan</Label>
                    <Textarea
                        id="conclusion"
                        className="mt-1"
                        {...register('conclusion')}
                    />
                </div>
                <div>
                    <Label htmlFor="recommendation">Rekomendasi</Label>
                    <Textarea
                        id="recommendation"
                        className="mt-1"
                        {...register('recommendation')}
                    />
                </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
                <Button type="submit" disabled={submitting}>
                    {submitting ? 'Menyimpan…' : 'Kirim PE'}
                </Button>
                <Link href="/pe" className="text-[14px] underline">
                    Batal
                </Link>
            </div>
        </form>
    );
}

function Num({
    id,
    label,
    min,
    reg,
    error,
}: {
    id: string;
    label: string;
    min: number;
    reg: ReturnType<ReturnType<typeof useForm>['register']>;
    error?: string;
}) {
    return (
        <div>
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type="number"
                min={min}
                className="mt-1"
                aria-invalid={error ? true : undefined}
                {...reg}
            />
            <FieldError message={error} />
        </div>
    );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
    if (!message) return null;
    return (
        <p id={id} className="mt-1 text-[12px] text-[var(--negative)]">
            {message}
        </p>
    );
}
