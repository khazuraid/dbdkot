'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { saveWhatsAppProfileAction } from './actions';

const waProfileSchema = z.object({
    phone: z
        .string()
        .trim()
        .refine(
            (val) => {
                if (!val) return true;
                const cleaned = val.replace(/[\s-]/g, '');
                return /^(\+?62|0|8)[0-9]{7,14}$/.test(cleaned);
            },
            'Nomor HP/WhatsApp tidak valid (contoh: 081234567890 atau 6281234567890)',
        ),
    optIn: z.boolean(),
});

export function WaProfileCard({
    initialPhone,
    initialOptIn,
}: {
    initialPhone: string;
    initialOptIn: boolean;
}) {
    const [phone, setPhone] = useState(initialPhone);
    const [optIn, setOptIn] = useState(initialOptIn);
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [pending, start] = useTransition();

    function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setPhoneError(null);

        const parsed = waProfileSchema.safeParse({ phone, optIn });
        if (!parsed.success) {
            const msg = parsed.error.issues[0]?.message ?? 'Nomor telepon tidak valid.';
            setPhoneError(msg);
            toast.error(msg);
            return;
        }

        start(async () => {
            const res = await saveWhatsAppProfileAction({
                whatsappPhone: parsed.data.phone,
                whatsappOptIn: parsed.data.optIn,
            });
            if (!res.ok) {
                toast.error(res.error);
                return;
            }
            toast.success('Preferensi WhatsApp diperbarui.');
        });
    }

    return (
        <form
            onSubmit={handleSave}
            className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]"
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <MessageSquare
                        className="size-4 text-[var(--accent)]"
                        aria-hidden
                    />
                    <div>
                        <p className="text-[14px] font-semibold">
                            Notifikasi WhatsApp Petugas
                        </p>
                        <p className="text-[12px] text-muted-foreground">
                            Terima peringatan SLA 18j/24j, tugas PE baru, dan
                            jadwal Fogging Fokus.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Switch
                        id="wa-opt-in"
                        checked={optIn}
                        onCheckedChange={setOptIn}
                    />
                    <Label htmlFor="wa-opt-in" className="text-[12.5px]">
                        Aktif
                    </Label>
                </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                    <Label htmlFor="wa-phone" className="text-[12px]">
                        Nomor WhatsApp (format 628xxx)
                    </Label>
                    <Input
                        id="wa-phone"
                        value={phone}
                        onChange={(e) => {
                            setPhone(e.target.value);
                            if (phoneError) setPhoneError(null);
                        }}
                        aria-invalid={Boolean(phoneError)}
                        placeholder="6281234567890"
                    />
                    {phoneError && (
                        <p className="mt-1 text-[11.5px] text-[var(--negative)]">
                            {phoneError}
                        </p>
                    )}
                </div>
                <Button type="submit" size="sm" disabled={pending}>
                    {pending ? 'Menyimpan...' : 'Simpan Preferensi WA'}
                </Button>
            </div>
        </form>
    );
}
