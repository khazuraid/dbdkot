'use client';

import { useState, useTransition } from 'react';
import {
    Eye,
    EyeOff,
    Info,
    MessageSquare,
    Save,
    Send,
    ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Panel } from '@/components/shell/page';
import { MASKED_SECRET } from '@/lib/security';
import type { WaProvider, WhatsAppGatewaySummary } from '@/lib/whatsapp';
import {
    saveWhatsAppGatewayAction,
    testWhatsAppGatewayAction,
} from './actions';

type Props = {
    initial?: WhatsAppGatewaySummary;
    canManage: boolean;
};

export function WhatsAppSettings({ initial, canManage }: Props) {
    const [isSaving, startSave] = useTransition();
    const [isTesting, startTest] = useTransition();
    const [showToken, setShowToken] = useState(false);

    const [provider, setProvider] = useState<WaProvider>(
        initial?.provider ?? 'openwa',
    );
    const [enabled, setEnabled] = useState(initial?.enabled ?? false);
    const [baseUrl, setBaseUrl] = useState(
        initial?.baseUrl || 'http://openwa:2785',
    );
    const [sessionId, setSessionId] = useState(
        initial?.sessionId || 'wali-epi',
    );
    const [token, setToken] = useState(initial?.hasToken ? MASKED_SECRET : '');
    const [testPhone, setTestPhone] = useState('');

    const envManaged = Boolean(initial?.envManaged);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        startSave(async () => {
            const res = await saveWhatsAppGatewayAction({
                provider,
                baseUrl,
                sessionId: provider === 'openwa' ? sessionId : '',
                token,
                enabled,
            });
            if (res.ok) {
                toast.success(
                    'Konfigurasi WhatsApp Gateway berhasil disimpan.',
                );
            } else {
                toast.error(
                    res.error || 'Gagal menyimpan konfigurasi WhatsApp.',
                );
            }
        });
    };

    const handleTest = () => {
        startTest(async () => {
            const res = await testWhatsAppGatewayAction(testPhone);
            if ('error' in res && res.error) {
                toast.error(res.error);
                return;
            }
            if (res.ok) {
                toast.success('Pesan tes WhatsApp berhasil dikirim.');
            } else if (res.deliveryStatus === 'FALLBACK_LOGGED') {
                toast.warning(
                    'Gateway belum aktif; pesan tes dicatat ke log lokal (wa_dispatches).',
                );
            } else {
                toast.error(
                    `Pengiriman tes gagal${res.detail ? `: ${res.detail}` : '.'}`,
                );
            }
        });
    };

    return (
        <div className="space-y-6">
            <Panel padded title="Gateway WhatsApp (OpenWA / Webhook)">
                <div className="mb-6 rounded-[var(--radius-card)] border border-[var(--pill-info-border)] bg-[var(--pill-info-bg)] p-4 text-[13px] text-[var(--pill-info-ink)]">
                    <div className="flex items-start gap-3">
                        <MessageSquare className="size-5 shrink-0 text-[var(--pill-info-ink)]" />
                        <div className="space-y-1">
                            <p className="font-semibold">
                                Integrasi Sidecar OpenWA & Notifikasi Surveilans
                            </p>
                            <p className="leading-relaxed">
                                Untuk sidecar Docker Compose, buka dashboard
                                OpenWA (lokal:{' '}
                                <code className="font-mono text-[12px]">
                                    http://127.0.0.1:2785
                                </code>
                                , atau domain OpenWA di Coolify) untuk scan QR
                                dan membuat API Key, lalu isi URL internal{' '}
                                <code className="font-mono text-[12px]">
                                    http://openwa:2785
                                </code>{' '}
                                beserta Session ID di bawah.
                            </p>
                        </div>
                    </div>
                </div>

                {envManaged && (
                    <div className="mb-5 flex items-start gap-2.5 rounded-[var(--radius-card)] border border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] p-3.5 text-[12.5px] text-[var(--pill-warning-ink)]">
                        <Info className="mt-0.5 size-4 shrink-0" />
                        <p>
                            Variabel lingkungan{' '}
                            <code className="font-mono">WHATSAPP_API_URL</code>{' '}
                            sedang aktif dan menimpa konfigurasi database di
                            bawah.
                        </p>
                    </div>
                )}

                <form onSubmit={handleSave} className="space-y-5">
                    <div className="flex items-center justify-between rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/40 px-4 py-3">
                        <div>
                            <Label
                                htmlFor="wa-enabled"
                                className="text-[13.5px] font-medium"
                            >
                                Aktifkan Pengiriman WhatsApp
                            </Label>
                            <p className="text-[12px] text-muted-foreground">
                                Jika nonaktif, pesan tetap dicatat di log lokal{' '}
                                <code className="font-mono">wa_dispatches</code>
                                .
                            </p>
                        </div>
                        <Switch
                            id="wa-enabled"
                            checked={enabled}
                            onCheckedChange={setEnabled}
                            disabled={!canManage || envManaged}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="wa-provider">
                                Provider Gateway
                            </Label>
                            <Select
                                value={provider}
                                onValueChange={(v) =>
                                    setProvider(v as WaProvider)
                                }
                                disabled={!canManage || envManaged}
                            >
                                <SelectTrigger id="wa-provider">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="openwa">
                                        OpenWA (Self-hosted Sidecar)
                                    </SelectItem>
                                    <SelectItem value="generic">
                                        Webhook HTTP Generik (Bearer)
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="wa-base-url">
                                {provider === 'openwa'
                                    ? 'Base URL OpenWA'
                                    : 'URL Webhook'}
                            </Label>
                            <Input
                                id="wa-base-url"
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                                placeholder={
                                    provider === 'openwa'
                                        ? 'http://openwa:2785'
                                        : 'https://gateway.example.com/send'
                                }
                                className="font-mono text-[13px]"
                                disabled={!canManage || envManaged}
                            />
                        </div>

                        {provider === 'openwa' && (
                            <div className="space-y-1.5">
                                <Label htmlFor="wa-session-id">
                                    Session ID OpenWA
                                </Label>
                                <Input
                                    id="wa-session-id"
                                    value={sessionId}
                                    onChange={(e) =>
                                        setSessionId(e.target.value)
                                    }
                                    placeholder="wali-epi"
                                    className="font-mono text-[13px]"
                                    disabled={!canManage || envManaged}
                                />
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label htmlFor="wa-token">
                                {provider === 'openwa'
                                    ? 'API Key OpenWA (X-API-Key)'
                                    : 'Bearer Token'}
                            </Label>
                            <div className="relative">
                                <Input
                                    id="wa-token"
                                    type={showToken ? 'text' : 'password'}
                                    value={token}
                                    onChange={(e) => setToken(e.target.value)}
                                    placeholder="Tempel API Key dari dashboard OpenWA"
                                    className="pr-10 font-mono text-[13px]"
                                    disabled={!canManage || envManaged}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowToken((v) => !v)}
                                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                                    aria-label={
                                        showToken
                                            ? 'Sembunyikan token'
                                            : 'Tampilkan token'
                                    }
                                >
                                    {showToken ? (
                                        <EyeOff className="size-4" />
                                    ) : (
                                        <Eye className="size-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {canManage && !envManaged && (
                        <div className="flex justify-end pt-1">
                            <Button
                                type="submit"
                                disabled={isSaving}
                                className="gap-2"
                            >
                                <Save className="size-4" />
                                {isSaving
                                    ? 'Menyimpan…'
                                    : 'Simpan Konfigurasi WhatsApp'}
                            </Button>
                        </div>
                    )}
                </form>
            </Panel>

            <Panel padded title="Uji Coba Pengiriman Pesan">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-1.5">
                        <Label htmlFor="wa-test-phone">
                            Nomor WhatsApp Tujuan
                        </Label>
                        <Input
                            id="wa-test-phone"
                            value={testPhone}
                            onChange={(e) => setTestPhone(e.target.value)}
                            placeholder="Contoh: 081234567890"
                            className="font-mono text-[13px]"
                            disabled={!canManage}
                        />
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleTest}
                        disabled={!canManage || isTesting || !testPhone.trim()}
                        className="gap-2"
                    >
                        <Send className="size-4" />
                        {isTesting ? 'Mengirim…' : 'Kirim Pesan Tes'}
                    </Button>
                </div>
            </Panel>

            <Panel padded title="Praktik Aman Anti-Blokir">
                <div className="flex items-start gap-3 text-[12.5px] text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--positive)]" />
                    <ul className="list-inside list-disc space-y-1.5 leading-relaxed">
                        <li>
                            Gunakan nomor WhatsApp khusus yang sudah aktif dan
                            memiliki riwayat chat wajar (hindari kartu SIM baru
                            langsung mengirim banyak pesan).
                        </li>
                        <li>
                            Minta petugas Puskesmas dan Dinkes menyimpan nomor
                            gateway serta mengirim satu pesan awal agar tidak
                            terhitung sebagai kontak dingin.
                        </li>
                        <li>
                            Worker membatasi laju kirim (1 pesan/5 detik + jeda
                            acak + cooldown duplikat), sementara notifikasi
                            in-app dan email SMTP tetap berjalan sebagai
                            cadangan.
                        </li>
                    </ul>
                </div>
            </Panel>
        </div>
    );
}
