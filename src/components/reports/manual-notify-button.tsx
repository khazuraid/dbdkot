'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { sendManualNotificationAction } from '@/app/(dashboard)/actions';
import {
    buildDefaultManualNotifyMessage,
    type ManualNotifyContext,
    type ManualNotifyTarget,
    type ManualNotifyTargetOption,
    type PuskesmasOfficerOption,
} from '@/lib/domain/report-labels';

const CONTEXT_TITLE: Record<ManualNotifyContext, string> = {
    REPORT: 'Kirim Notifikasi Laporan',
    PE: 'Kirim Pengingat PE',
    FOGGING: 'Kirim Pengingat Fogging',
};

export function ManualNotifyButton({
    reportId,
    reportNumber,
    kelurahan,
    context,
    targets,
    puskesmasName,
    puskesmasOfficers = [],
    locationUnconfirmed = false,
    label = 'Kirim WA & Notif',
    size = 'sm',
    variant = 'outline',
    className,
}: {
    reportId: string;
    reportNumber: string;
    kelurahan: string | null;
    context: ManualNotifyContext;
    targets: ManualNotifyTargetOption[];
    puskesmasName?: string | null;
    puskesmasOfficers?: PuskesmasOfficerOption[];
    locationUnconfirmed?: boolean;
    label?: string;
    size?: 'xs' | 'sm' | 'default';
    variant?: 'outline' | 'default' | 'secondary' | 'ghost';
    className?: string;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [target, setTarget] = useState<ManualNotifyTarget>(
        targets[0]?.value ?? 'DINKES',
    );
    const [officerId, setOfficerId] = useState<string>('ALL');
    const [message, setMessage] = useState(() =>
        buildDefaultManualNotifyMessage({
            context,
            reportId,
            reportNumber,
            kelurahan,
            locationUnconfirmed,
        }),
    );
    const [sendInApp, setSendInApp] = useState(true);
    const [sendWhatsApp, setSendWhatsApp] = useState(true);
    const [pending, startTransition] = useTransition();

    if (targets.length === 0) return null;

    const targetsPuskesmas =
        target === 'PUSKESMAS' || target === 'PUSKESMAS_AND_DINKES';

    function handleOpenChange(next: boolean) {
        if (next) {
            setTarget(targets[0]?.value ?? 'DINKES');
            setOfficerId('ALL');
            setMessage(
                buildDefaultManualNotifyMessage({
                    context,
                    reportId,
                    reportNumber,
                    kelurahan,
                    locationUnconfirmed,
                }),
            );
            setSendInApp(true);
            setSendWhatsApp(true);
        }
        setOpen(next);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!sendInApp && !sendWhatsApp) {
            toast.error('Pilih minimal satu kanal (In-App atau WhatsApp).');
            return;
        }

        startTransition(async () => {
            const res = await sendManualNotificationAction({
                reportId,
                context,
                target,
                puskesmasOfficerId:
                    targetsPuskesmas && officerId !== 'ALL'
                        ? officerId
                        : undefined,
                message: message.trim() || undefined,
                sendInApp,
                sendWhatsApp,
            });

            if (!res.ok) {
                toast.error(res.error);
                return;
            }

            const parts: string[] = [];
            if (sendInApp) parts.push(`${res.inAppCount} notifikasi in-app`);
            if (sendWhatsApp) {
                if (res.waOptInCount === 0) {
                    parts.push('WA dicatat (belum ada nomor opt-in aktif)');
                } else if (res.waQueuedCount > 0) {
                    parts.push(
                        `WA diantrekan (${res.waOptInCount} nomor opt-in)`,
                    );
                } else {
                    parts.push(
                        `WA diproses (${res.waOptInCount} nomor opt-in)`,
                    );
                }
            }

            toast.success(`Notifikasi dikirim ke ${res.targetLabel}`, {
                description: parts.join(' · '),
            });
            setOpen(false);
            router.refresh();
        });
    }

    return (
        <>
            <Button
                type="button"
                size={size}
                variant={variant}
                onClick={() => handleOpenChange(true)}
                className={className}
            >
                <MessageSquare className="size-3.5" aria-hidden />
                <span>{label}</span>
            </Button>

            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{CONTEXT_TITLE[context]}</DialogTitle>
                            <DialogDescription>
                                Kirim pemberitahuan manual untuk kasus{' '}
                                <span className="font-mono font-semibold text-foreground">
                                    {reportNumber}
                                </span>{' '}
                                (Kel. {kelurahan ?? '-'}).
                            </DialogDescription>
                        </DialogHeader>

                        {locationUnconfirmed && context === 'REPORT' && (
                            <div className="rounded-[var(--radius-control)] border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-900 dark:text-amber-200">
                                Koordinat lokasi pasien belum dikonfirmasi.
                                Pesan bawaan meminta penerima memverifikasi
                                lokasi lapangan.
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label
                                htmlFor={`notify-target-${reportId}-${context}`}
                            >
                                Tujuan Notifikasi
                            </Label>
                            <Select
                                value={target}
                                onValueChange={(v) => {
                                    const next = v as ManualNotifyTarget;
                                    setTarget(next);
                                    if (
                                        next !== 'PUSKESMAS' &&
                                        next !== 'PUSKESMAS_AND_DINKES'
                                    ) {
                                        setOfficerId('ALL');
                                    }
                                }}
                            >
                                <SelectTrigger
                                    id={`notify-target-${reportId}-${context}`}
                                    className="w-full"
                                >
                                    <SelectValue placeholder="Pilih tujuan" />
                                </SelectTrigger>
                                <SelectContent>
                                    {targets.map((opt) => (
                                        <SelectItem
                                            key={opt.value}
                                            value={opt.value}
                                        >
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {targetsPuskesmas && (
                            <div className="space-y-1.5">
                                <Label
                                    htmlFor={`notify-officer-${reportId}-${context}`}
                                >
                                    Nomor Petugas Puskesmas Wilayah
                                </Label>
                                {puskesmasOfficers.length > 0 ? (
                                    <>
                                        <Select
                                            value={officerId}
                                            onValueChange={setOfficerId}
                                        >
                                            <SelectTrigger
                                                id={`notify-officer-${reportId}-${context}`}
                                                className="w-full"
                                            >
                                                <SelectValue placeholder="Pilih petugas Puskesmas" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALL">
                                                    Semua petugas opt-in (
                                                    {puskesmasOfficers.length}{' '}
                                                    nomor)
                                                </SelectItem>
                                                {puskesmasOfficers.map((o) => (
                                                    <SelectItem
                                                        key={o.id}
                                                        value={o.id}
                                                    >
                                                        {o.name} · {o.phone}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[11.5px] text-muted-foreground">
                                            Wilayah:{' '}
                                            {puskesmasName ??
                                                'Puskesmas terkait'}
                                        </p>
                                    </>
                                ) : (
                                    <p className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/60 px-3 py-2 text-[12px] text-muted-foreground">
                                        Belum ada petugas{' '}
                                        {puskesmasName ?? 'Puskesmas wilayah'}{' '}
                                        dengan nomor WhatsApp opt-in aktif.
                                        Notifikasi tetap dikirim ke in-app
                                        Puskesmas.
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Kanal Pengiriman</Label>
                            <div className="flex flex-wrap gap-4 text-[13px]">
                                <label className="flex cursor-pointer items-center gap-2 select-none">
                                    <input
                                        type="checkbox"
                                        checked={sendInApp}
                                        onChange={(e) =>
                                            setSendInApp(e.target.checked)
                                        }
                                        className="size-4 rounded border-[var(--border)] accent-[var(--accent)]"
                                    />
                                    <span>Notifikasi In-App</span>
                                </label>
                                <label className="flex cursor-pointer items-center gap-2 select-none">
                                    <input
                                        type="checkbox"
                                        checked={sendWhatsApp}
                                        onChange={(e) =>
                                            setSendWhatsApp(e.target.checked)
                                        }
                                        className="size-4 rounded border-[var(--border)] accent-[var(--accent)]"
                                    />
                                    <span>WhatsApp Petugas (Opt-in)</span>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label
                                htmlFor={`notify-msg-${reportId}-${context}`}
                            >
                                Isi Pesan
                            </Label>
                            <Textarea
                                id={`notify-msg-${reportId}-${context}`}
                                rows={4}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Tulis pesan pengingat..."
                            />
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                disabled={pending}
                            >
                                Batal
                            </Button>
                            <Button type="submit" disabled={pending}>
                                {pending ? (
                                    <>
                                        <Loader2 className="size-3.5 animate-spin" />
                                        <span>Mengirim...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="size-3.5" />
                                        <span>Kirim Sekarang</span>
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
