'use client';

import { useState, useTransition } from 'react';
import {
    Building2,
    CheckCircle2,
    Globe,
    HelpCircle,
    Image as ImageIcon,
    Mail,
    PhoneCall,
    Save,
    Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/shell/page';
import { Badge } from '@/components/ui/badge';
import {
    saveBrandingSettingsAction,
    type BrandingConfig,
} from './actions';
import type { SettingRow } from './settings-editor';

type Props = {
    settings: SettingRow[];
    canManage: boolean;
};

export function BrandingSettings({ settings, canManage }: Props) {
    const [isSaving, startSave] = useTransition();

    const settingsMap = new Map<string, string>();
    for (const s of settings) {
        settingsMap.set(s.key, s.value);
    }

    const [appTitle, setAppTitle] = useState(
        settingsMap.get('APP_TITLE') || 'WALI-EPI Kota Cirebon',
    );
    const [appTagline, setAppTagline] = useState(
        settingsMap.get('APP_TAGLINE') ||
            'Sistem Surveilans & Respons Cepat DBD Berbasis Wilayah',
    );
    const [institutionName, setInstitutionName] = useState(
        settingsMap.get('INSTITUTION_NAME') || 'Dinas Kesehatan Kota Cirebon',
    );
    const [logoUrl, setLogoUrl] = useState(
        settingsMap.get('APP_LOGO_URL') || '',
    );
    const [faviconUrl, setFaviconUrl] = useState(
        settingsMap.get('APP_FAVICON_URL') || '',
    );
    const [footerText, setFooterText] = useState(
        settingsMap.get('APP_FOOTER_TEXT') ||
            '© 2025 Dinas Kesehatan Kota Cirebon. Hak Cipta Dilindungi.',
    );
    const [emergencyHotline, setEmergencyHotline] = useState(
        settingsMap.get('EMERGENCY_HOTLINE') || '119 / (0231) 206444',
    );
    const [supportEmail, setSupportEmail] = useState(
        settingsMap.get('SUPPORT_EMAIL') || 'dinkes@cirebonkota.go.id',
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canManage) return;

        startSave(async () => {
            const payload: BrandingConfig = {
                appTitle,
                appTagline,
                institutionName,
                logoUrl: logoUrl || undefined,
                faviconUrl: faviconUrl || undefined,
                footerText,
                emergencyHotline,
                supportEmail,
            };

            const res = await saveBrandingSettingsAction(payload);
            if (res.ok) {
                toast.success('Pengaturan identitas & branding portal berhasil diperbarui');
            } else {
                toast.error(res.error);
            }
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <Panel
                title="Identitas & Branding Portal"
                subtitle="Kustomisasi nama aplikasi, logo, instansi pembina, dan informasi publik portal surveilans"
                aside={
                    <Badge variant="outline" className="font-mono text-xs">
                        {institutionName}
                    </Badge>
                }
            >
                <div className="p-5 space-y-5">
                    {/* Visual Brand Preview Card */}
                    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--raised)]/40 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                            <Sparkles className="size-3.5 text-[var(--accent)]" />
                            Pratinjau Header & Identitas
                        </div>
                        <div className="flex items-center gap-3.5">
                            <div className="size-11 shrink-0 rounded-[10px] bg-[var(--accent)] text-[var(--accent-ink)] flex items-center justify-center font-bold text-lg shadow-xs overflow-hidden">
                                {logoUrl ? (
                                    <img
                                        src={logoUrl}
                                        alt="Logo Preview"
                                        className="size-full object-contain p-1"
                                        onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).style.display =
                                                'none';
                                        }}
                                    />
                                ) : (
                                    <span>W</span>
                                )}
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-base font-bold text-foreground truncate">
                                    {appTitle || 'WALI-EPI Kota Cirebon'}
                                </h4>
                                <p className="text-xs text-muted-foreground truncate">
                                    {appTagline ||
                                        'Sistem Surveilans & Respons Cepat DBD Berbasis Wilayah'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="app-title" className="text-xs font-semibold">
                                Judul Website / Nama Aplikasi
                            </Label>
                            <Input
                                id="app-title"
                                value={appTitle}
                                onChange={(e) => setAppTitle(e.target.value)}
                                placeholder="WALI-EPI Kota Cirebon"
                                className="text-sm font-medium"
                                disabled={!canManage}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="inst-name" className="text-xs font-semibold">
                                Nama Instansi Pembina
                            </Label>
                            <Input
                                id="inst-name"
                                value={institutionName}
                                onChange={(e) => setInstitutionName(e.target.value)}
                                placeholder="Dinas Kesehatan Kota Cirebon"
                                className="text-sm"
                                disabled={!canManage}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="app-tagline" className="text-xs font-semibold">
                            Subjudul / Slogan Sistem
                        </Label>
                        <Input
                            id="app-tagline"
                            value={appTagline}
                            onChange={(e) => setAppTagline(e.target.value)}
                            placeholder="Sistem Surveilans & Respons Cepat DBD Berbasis Wilayah"
                            className="text-sm"
                            disabled={!canManage}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="logo-url" className="text-xs font-semibold flex items-center gap-1.5">
                                <ImageIcon className="size-3.5 text-muted-foreground" />
                                URL Gambar Logo Utama
                            </Label>
                            <Input
                                id="logo-url"
                                value={logoUrl}
                                onChange={(e) => setLogoUrl(e.target.value)}
                                placeholder="https://domain.com/logo.png atau /logo.png"
                                className="font-mono text-xs"
                                disabled={!canManage}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Format PNG atau SVG transparan direkomendasikan (rasio 1:1).
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="favicon-url" className="text-xs font-semibold flex items-center gap-1.5">
                                <Globe className="size-3.5 text-muted-foreground" />
                                URL Favicon Browser
                            </Label>
                            <Input
                                id="favicon-url"
                                value={faviconUrl}
                                onChange={(e) => setFaviconUrl(e.target.value)}
                                placeholder="https://domain.com/favicon.ico atau /favicon.ico"
                                className="font-mono text-xs"
                                disabled={!canManage}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Icon tab browser (.ico atau .png 32x32).
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="emergency-phone" className="text-xs font-semibold flex items-center gap-1.5">
                                <PhoneCall className="size-3.5 text-rose-500" />
                                Hotline Darurat DBD / PSC 119
                            </Label>
                            <Input
                                id="emergency-phone"
                                value={emergencyHotline}
                                onChange={(e) => setEmergencyHotline(e.target.value)}
                                placeholder="119 / (0231) 206444"
                                className="text-sm font-mono"
                                disabled={!canManage}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="support-email" className="text-xs font-semibold flex items-center gap-1.5">
                                <Mail className="size-3.5 text-[var(--accent)]" />
                                Email Layanan / Pengaduan
                            </Label>
                            <Input
                                id="support-email"
                                type="email"
                                value={supportEmail}
                                onChange={(e) => setSupportEmail(e.target.value)}
                                placeholder="dinkes@cirebonkota.go.id"
                                className="text-sm font-mono"
                                disabled={!canManage}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="footer-text" className="text-xs font-semibold">
                            Teks Hak Cipta & Footer
                        </Label>
                        <Input
                            id="footer-text"
                            value={footerText}
                            onChange={(e) => setFooterText(e.target.value)}
                            placeholder="© 2025 Dinas Kesehatan Kota Cirebon. Hak Cipta Dilindungi."
                            className="text-sm"
                            disabled={!canManage}
                        />
                    </div>

                    {canManage && (
                        <div className="flex justify-end pt-3 border-t border-[var(--border)]">
                            <Button
                                type="submit"
                                disabled={isSaving}
                                className="gap-2 bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90"
                            >
                                <Save className="size-4" />
                                {isSaving ? 'Menyimpan...' : 'Simpan Identitas & Branding'}
                            </Button>
                        </div>
                    )}
                </div>
            </Panel>
        </form>
    );
}
