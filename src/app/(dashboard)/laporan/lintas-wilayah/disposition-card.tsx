'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusText } from '@/components/shell/status-text';
import { formatDate } from '@/lib/format';
import { crossBorderDispositionSchema } from '@/lib/domain/form-contracts';
import { disposeCrossBorderAction } from './actions';

export type CrossBorderRow = {
    id: string;
    reportNumber: string;
    kota: string | null;
    provinsi: string | null;
    crossBorderTargetCity: string | null;
    crossBorderNotes: string | null;
    kelurahan: string | null;
    kecamatan: string | null;
    caseType: string;
    status: string;
    createdAt: Date | string;
};

export function DispositionCard({ row }: { row: CrossBorderRow }) {
    const [targetCity, setTargetCity] = useState(
        row.crossBorderTargetCity ?? row.kota ?? '',
    );
    const [notes, setNotes] = useState(row.crossBorderNotes ?? '');
    const [errors, setErrors] = useState<{ targetCity?: string; notes?: string }>({});
    const [pending, start] = useTransition();
    const isArchived = row.status === 'ARCHIVED_CROSS_BORDER';

    function handleDispose(e: React.FormEvent) {
        e.preventDefault();
        setErrors({});

        const parsed = crossBorderDispositionSchema.safeParse({
            reportId: row.id,
            targetCity,
            notes,
        });

        if (!parsed.success) {
            const errMap: { targetCity?: string; notes?: string } = {};
            for (const issue of parsed.error.issues) {
                if (issue.path[0] === 'targetCity') errMap.targetCity = issue.message;
                if (issue.path[0] === 'notes') errMap.notes = issue.message;
            }
            setErrors(errMap);
            toast.error(parsed.error.issues[0]?.message ?? 'Data disposisi belum lengkap.');
            return;
        }

        start(async () => {
            const res = await disposeCrossBorderAction({
                reportId: parsed.data.reportId,
                targetCity: parsed.data.targetCity,
                notes: parsed.data.notes,
            });
            if (!res.ok) {
                toast.error(res.error);
                return;
            }
            toast.success(`Disposisi ${row.reportNumber} dikirim & diarsipkan.`);
        });
    }

    return (
        <form
            onSubmit={handleDispose}
            className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <Link
                        href={`/laporan/${row.id}`}
                        className="font-mono text-[13.5px] font-semibold text-[var(--accent)] hover:underline"
                    >
                        {row.reportNumber}
                    </Link>
                    <p className="text-[12.5px] text-muted-foreground">
                        Domisili: {row.kelurahan ?? '-'}, {row.kecamatan ?? '-'},{' '}
                        {row.kota ?? '-'}
                        {row.provinsi ? `, ${row.provinsi}` : ''} · Dilaporkan:{' '}
                        {formatDate(row.createdAt)}
                    </p>
                </div>
                <StatusText tone={isArchived ? 'good' : 'warn'}>
                    {isArchived ? 'Sudah Didisposisikan' : 'Luar Wilayah'}
                </StatusText>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`city-${row.id}`}>
                        Dinkes Kota/Kab Tujuan
                    </Label>
                    <Input
                        id={`city-${row.id}`}
                        value={targetCity}
                        onChange={(e) => {
                            setTargetCity(e.target.value);
                            if (errors.targetCity) setErrors((prev) => ({ ...prev, targetCity: undefined }));
                        }}
                        placeholder="Contoh: Kota Cimahi"
                        disabled={isArchived}
                        aria-invalid={Boolean(errors.targetCity)}
                        required
                    />
                    {errors.targetCity && (
                        <p className="text-[11.5px] text-[var(--negative)]">{errors.targetCity}</p>
                    )}
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor={`notes-${row.id}`}>
                        Catatan Disposisi / Nomor Surat Rujukan
                    </Label>
                    <Textarea
                        id={`notes-${row.id}`}
                        rows={1}
                        value={notes}
                        onChange={(e) => {
                            setNotes(e.target.value);
                            if (errors.notes) setErrors((prev) => ({ ...prev, notes: undefined }));
                        }}
                        placeholder="Diteruskan ke Dinkes Kota tujuan via surat / WA resmi..."
                        disabled={isArchived}
                        aria-invalid={Boolean(errors.notes)}
                        required
                    />
                    {errors.notes && (
                        <p className="text-[11.5px] text-[var(--negative)]">{errors.notes}</p>
                    )}
                </div>
            </div>

            {!isArchived && (
                <div className="flex justify-end">
                    <Button type="submit" size="sm" disabled={pending}>
                        <Send data-icon="inline-start" />
                        {pending
                            ? 'Memproses...'
                            : 'Kirim Disposisi & Arsipkan'}
                    </Button>
                </div>
            )}
        </form>
    );
}
