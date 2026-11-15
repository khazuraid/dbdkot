'use client';

import { useState, useTransition } from 'react';
import {
    ExternalLink,
    Eye,
    EyeOff,
    Mail,
    Save,
    Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Panel } from '@/components/shell/page';
import { saveSmtpSettingsAction, testSmtpConnectionAction } from './actions';
import type { SettingRow } from './settings-editor';

type Props = {
    settings: SettingRow[];
    canManage: boolean;
};

export function SmtpSettings({ settings, canManage }: Props) {
    const [isSaving, startSave] = useTransition();
    const [isTesting, startTest] = useTransition();
    const [showPassword, setShowPassword] = useState(false);
    const [testRecipient, setTestRecipient] = useState('');

    const map = new Map<string, string>();
    for (const s of settings) {
        if (s.value !== null && s.value !== undefined) {
            map.set(s.key, s.value);
        }
    }

    const [host, setHost] = useState(map.get('SMTP_HOST') || 'smtp.sumopod.com');
    const [port, setPort] = useState(map.get('SMTP_PORT') || '465');
    const [secure, setSecure] = useState(
        map.get('SMTP_SECURE') !== undefined ? map.get('SMTP_SECURE') === 'true' : true,
    );
    const [user, setUser] = useState(map.get('SMTP_USER') || '');
    const hasStoredPass = Boolean(map.get('SMTP_PASS'));
    const [pass, setPass] = useState(map.get('SMTP_PASS') || '');
    const [fromEmail, setFromEmail] = useState(
        map.get('SMTP_FROM_EMAIL') || 'noreply@wali-epi.id',
    );
    const [fromName, setFromName] = useState(
        map.get('SMTP_FROM_NAME') || 'WALI-EPI Kota Cirebon',
    );

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set('host', host);
        fd.set('port', port);
        fd.set('secure', secure ? 'true' : 'false');
        fd.set('user', user);
        fd.set('pass', pass);
        fd.set('fromEmail', fromEmail);
        fd.set('fromName', fromName);

        startSave(async () => {
            const res = await saveSmtpSettingsAction(fd);
            if (res.ok) {
                toast.success('Pengaturan SMTP Sumopod berhasil disimpan.');
            } else {
                toast.error(res.error || 'Gagal menyimpan pengaturan SMTP.');
            }
        });
    };

    const handleTest = () => {
        startTest(async () => {
            const res = await testSmtpConnectionAction(testRecipient || undefined);
            if (res.ok) {
                toast.success(
                    `Koneksi SMTP berhasil! Email uji coba telah dikirim ke ${res.recipient}.`,
                );
            } else {
                toast.error(`Koneksi SMTP gagal: ${res.error}`);
            }
        });
    };

    return (
        <div className="space-y-6">
            <Panel padded title="Layanan Email SMTP Sumopod">
                <div className="mb-6 rounded-[var(--radius-card)] border border-[var(--pill-info-border)] bg-[var(--pill-info-bg)] p-4 text-[13px] text-[var(--pill-info-ink)]">
                    <div className="flex items-start gap-3">
                        <Mail className="size-5 shrink-0 text-[var(--pill-info-ink)]" />
                        <div className="space-y-1">
                            <p className="font-semibold">
                                Layanan Pengiriman Email OTP & Reset Kata Sandi
                            </p>
                            <p className="leading-relaxed">
                                Pengiriman kode OTP pendaftaran akun dan lupa kata sandi menggunakan layanan
                                resmi <strong>Sumopod Email SMTP</strong>. Buat kredensial di dashboard Sumopod lalu tempelkan username & password di bawah.
                            </p>
                            <div className="pt-1">
                                <a
                                    href="https://docs.sumopod.com/guides/smtp/create-smtp"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 font-medium underline hover:opacity-80"
                                >
                                    <span>Panduan Kredensial Sumopod SMTP</span>
                                    <ExternalLink className="size-3.5" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="smtp-host" className="text-[12.5px] font-medium">
                                Host SMTP Server
                            </Label>
                            <Input
                                id="smtp-host"
                                value={host}
                                onChange={(e) => setHost(e.target.value)}
                                placeholder="smtp.sumopod.com"
                                disabled={!canManage || isSaving}
                                required
                            />
                            <p className="text-[11.5px] text-muted-foreground">
                                Default Sumopod: <code className="font-mono">smtp.sumopod.com</code>
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="smtp-port" className="text-[12.5px] font-medium">
                                    Port SMTP
                                </Label>
                                <Input
                                    id="smtp-port"
                                    type="number"
                                    value={port}
                                    onChange={(e) => {
                                        setPort(e.target.value);
                                        if (e.target.value === '465') setSecure(true);
                                        else if (e.target.value === '587') setSecure(false);
                                    }}
                                    placeholder="465"
                                    disabled={!canManage || isSaving}
                                    required
                                />
                                <p className="text-[11.5px] text-muted-foreground">
                                    465 (SSL) atau 587 (TLS)
                                </p>
                            </div>

                            <div className="flex flex-col justify-between space-y-1.5">
                                <Label htmlFor="smtp-secure" className="text-[12.5px] font-medium">
                                    Enkripsi SSL
                                </Label>
                                <div className="flex items-center gap-2 pt-2">
                                    <Switch
                                        id="smtp-secure"
                                        checked={secure}
                                        onCheckedChange={setSecure}
                                        disabled={!canManage || isSaving}
                                    />
                                    <span className="text-[12px] text-muted-foreground">
                                        {secure ? 'SSL (Port 465)' : 'STARTTLS (587)'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="smtp-user" className="text-[12.5px] font-medium">
                                Username Kredensial SMTP
                            </Label>
                            <Input
                                id="smtp-user"
                                value={user}
                                onChange={(e) => setUser(e.target.value)}
                                placeholder="Misal: crd-xxxxxxxxxx"
                                disabled={!canManage || isSaving}
                                required
                            />
                            <p className="text-[11.5px] text-muted-foreground">
                                Didapat dari tab Credentials di dashboard Sumopod
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="smtp-pass" className="text-[12.5px] font-medium">
                                Password Kredensial SMTP
                            </Label>
                            <div className="relative">
                                <Input
                                    id="smtp-pass"
                                    type={showPassword && pass !== '••••••••' ? 'text' : 'password'}
                                    value={pass}
                                    onFocus={() => {
                                        if (pass === '••••••••') setPass('');
                                    }}
                                    onChange={(e) => setPass(e.target.value)}
                                    placeholder={
                                        hasStoredPass
                                            ? 'Tersimpan (biarkan kosong untuk tidak mengubah)'
                                            : 'Masukkan password / token Sumopod'
                                    }
                                    disabled={!canManage || isSaving}
                                    className="pr-10"
                                    required={!hasStoredPass}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((p) => !p)}
                                    disabled={pass === '••••••••'}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                                >
                                    {showPassword ? (
                                        <EyeOff className="size-4" strokeWidth={1.5} />
                                    ) : (
                                        <Eye className="size-4" strokeWidth={1.5} />
                                    )}
                                </button>
                            </div>
                            <p className="text-[11.5px] text-muted-foreground">
                                {hasStoredPass
                                    ? 'Password tersimpan dengan aman di server; isi hanya jika ingin mengganti.'
                                    : 'Password akun / token credential Sumopod'}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="smtp-from-email" className="text-[12.5px] font-medium">
                                Alamat Email Pengirim (From Email)
                            </Label>
                            <Input
                                id="smtp-from-email"
                                type="email"
                                value={fromEmail}
                                onChange={(e) => setFromEmail(e.target.value)}
                                placeholder="noreply@wali-epi.id"
                                disabled={!canManage || isSaving}
                                required
                            />
                            <p className="text-[11.5px] text-muted-foreground">
                                Email yang tampil sebagai pengirim OTP
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="smtp-from-name" className="text-[12.5px] font-medium">
                                Nama Tampilan Pengirim (From Name)
                            </Label>
                            <Input
                                id="smtp-from-name"
                                value={fromName}
                                onChange={(e) => setFromName(e.target.value)}
                                placeholder="WALI-EPI Kota Cirebon"
                                disabled={!canManage || isSaving}
                                required
                            />
                            <p className="text-[11.5px] text-muted-foreground">
                                Nama institusi yang menyertai email
                            </p>
                        </div>
                    </div>

                    {canManage && (
                        <div className="flex justify-end pt-3">
                            <Button type="submit" disabled={isSaving} className="gap-2 font-medium">
                                <Save className="size-4" />
                                {isSaving ? 'Menyimpan Pengaturan…' : 'Simpan Pengaturan SMTP'}
                            </Button>
                        </div>
                    )}
                </form>
            </Panel>

            <Panel padded title="Uji Coba Pengiriman Email">
                <div className="space-y-3">
                    <p className="text-[13px] text-muted-foreground">
                        Kirim email uji coba untuk memverifikasi apakah kredensial Sumopod SMTP yang disimpan dapat mengirim pesan dengan sukses.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 max-w-md">
                        <Input
                            placeholder="Email penerima (opsional, default: email Anda)"
                            value={testRecipient}
                            onChange={(e) => setTestRecipient(e.target.value)}
                            disabled={isTesting}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleTest}
                            disabled={isTesting || !user || (!pass && !hasStoredPass)}
                            className="gap-2 shrink-0"
                        >
                            <Send className="size-4" />
                            {isTesting ? 'Menguji…' : 'Uji Kirim Email'}
                        </Button>
                    </div>
                </div>
            </Panel>
        </div>
    );
}
