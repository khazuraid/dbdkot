'use client';

import { useState, useTransition } from 'react';
import { useTheme } from 'next-themes';
import {
    Building2,
    Clock,
    Eye,
    EyeOff,
    KeyRound,
    Laptop,
    Lock,
    Moon,
    Phone,
    Save,
    Settings,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Smartphone,
    Sun,
    User,
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Panel } from '@/components/shell/page';
import { ROLE_LABEL } from '@/lib/nav';
import type { Role } from '@/lib/roles';
import { cn } from '@/lib/utils';
import {
    changeUserPasswordAction,
    updateUserProfileAction,
} from './actions';
import {
    CreateSettingButton,
    SettingRowActions,
    type SettingRow,
} from './settings-editor';

type UserProfileData = {
    id: string;
    name: string;
    email: string;
    role: Role;
    status: string;
    institution: string | null;
    whatsappPhone: string;
    whatsappOptIn: boolean;
    createdAt?: Date | string | null;
};

const profileClientSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, 'Nama lengkap minimal 2 karakter')
        .max(100, 'Nama lengkap maksimal 100 karakter'),
    whatsappPhone: z
        .string()
        .trim()
        .refine(
            (val) => {
                if (!val) return true;
                const cleaned = val.replace(/[\s-]/g, '');
                return /^(\+?62|0|8)[0-9]{7,14}$/.test(cleaned);
            },
            'Nomor HP/WhatsApp tidak valid (contoh: 081234567890 atau 6281234567890)',
        )
        .optional(),
    whatsappOptIn: z.boolean(),
});

const passwordClientSchema = z
    .object({
        currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi'),
        newPassword: z
            .string()
            .min(10, 'Kata sandi baru minimal 10 karakter')
            .max(100, 'Kata sandi baru maksimal 100 karakter'),
        confirmPassword: z.string().min(1, 'Konfirmasi kata sandi baru wajib diisi'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: 'Konfirmasi kata sandi baru tidak cocok',
        path: ['confirmPassword'],
    });

export function SettingsClient({
    user,
    systemSettings = [],
    totalSettings = 0,
    categories = [],
    canManageSystem = false,
    isAdmin = false,
}: {
    user: UserProfileData;
    systemSettings?: SettingRow[];
    totalSettings?: number;
    categories?: string[];
    canManageSystem?: boolean;
    isAdmin?: boolean;
}) {
    const { theme, setTheme } = useTheme();

    // Profile state & Zod errors
    const [name, setName] = useState(user.name);
    const [phone, setPhone] = useState(user.whatsappPhone);
    const [optIn, setOptIn] = useState(user.whatsappOptIn);
    const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
    const [savingProfile, startProfileTransition] = useTransition();

    // Password state & Zod errors
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
    const [showPassword, setShowPassword] = useState(false);
    const [savingPassword, startPasswordTransition] = useTransition();

    // Notification toggles
    const [alertCase, setAlertCase] = useState(true);
    const [alertSla, setAlertSla] = useState(true);
    const [alertTask, setAlertTask] = useState(true);

    const handleSaveProfile = (e: React.FormEvent) => {
        e.preventDefault();
        setProfileErrors({});

        const parsed = profileClientSchema.safeParse({
            name,
            whatsappPhone: phone,
            whatsappOptIn: optIn,
        });

        if (!parsed.success) {
            const errs: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
                if (issue.path[0]) errs[String(issue.path[0])] = issue.message;
            }
            setProfileErrors(errs);
            toast.error(parsed.error.issues[0]?.message ?? 'Format data profil tidak valid.');
            return;
        }

        startProfileTransition(async () => {
            const res = await updateUserProfileAction(parsed.data);
            if (!res.ok) {
                toast.error(res.error);
                return;
            }
            toast.success('Profil berhasil diperbarui');
        });
    };

    const handleChangePassword = (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordErrors({});

        const parsed = passwordClientSchema.safeParse({
            currentPassword,
            newPassword,
            confirmPassword,
        });

        if (!parsed.success) {
            const errs: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
                if (issue.path[0]) errs[String(issue.path[0])] = issue.message;
            }
            setPasswordErrors(errs);
            toast.error(parsed.error.issues[0]?.message ?? 'Format kata sandi tidak valid.');
            return;
        }

        startPasswordTransition(async () => {
            const res = await changeUserPasswordAction(parsed.data);
            if (!res.ok) {
                toast.error(res.error);
                return;
            }
            toast.success('Kata sandi berhasil diperbarui');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        });
    };

    // Group system settings by category
    const groupedSettings = new Map<string, SettingRow[]>();
    for (const row of systemSettings) {
        const cat = row.category ?? 'Lainnya';
        const list = groupedSettings.get(cat) ?? [];
        list.push(row);
        groupedSettings.set(cat, list);
    }

    const initials = (name || user.email || 'U')
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <div className="space-y-6">
            <Tabs defaultValue="profil" className="w-full flex flex-col space-y-6">
                {/* Horizontal Tab Navigation */}
                <div className="border-b border-[var(--border)]">
                    <TabsList variant="line" className="h-11 gap-4 -mb-px">
                        <TabsTrigger
                            value="profil"
                            className="flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium"
                        >
                            <User className="size-4" />
                            Profil & Akun
                        </TabsTrigger>
                        <TabsTrigger
                            value="keamanan"
                            className="flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium"
                        >
                            <Shield className="size-4" />
                            Keamanan & Kata Sandi
                        </TabsTrigger>
                        <TabsTrigger
                            value="preferensi"
                            className="flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium"
                        >
                            <Smartphone className="size-4" />
                            Notifikasi & Tampilan
                        </TabsTrigger>
                        {canManageSystem && (
                            <TabsTrigger
                                value="sistem"
                                className="flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium"
                            >
                                <Settings className="size-4" />
                                Parameter Sistem & SLA
                            </TabsTrigger>
                        )}
                    </TabsList>
                </div>

                {/* 1. Profil Pengguna */}
                <TabsContent value="profil" className="space-y-6 pt-4">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {/* Profile Summary Card */}
                        <Panel padded className="lg:col-span-1 space-y-4">
                            <div className="flex flex-col items-center text-center">
                                <div className="grid size-20 place-items-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)] font-bold text-2xl shadow-xs">
                                    {initials}
                                </div>
                                <h3 className="mt-3 text-base font-semibold text-foreground">
                                    {name}
                                </h3>
                                <p className="text-[12.5px] text-muted-foreground">
                                    {user.email}
                                </p>
                                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--raised)] px-2.5 py-1 text-[11.5px] font-medium">
                                    <span className="size-2 rounded-full bg-[var(--positive)]" />
                                    <span>{ROLE_LABEL[user.role] ?? user.role}</span>
                                </div>
                            </div>

                            <div className="border-t border-[var(--rule)] pt-4 space-y-2.5 text-[12.5px]">
                                <div className="flex items-center justify-between text-muted-foreground">
                                    <span>Instansi:</span>
                                    <span className="font-medium text-foreground">
                                        {user.institution ?? 'Dinas Kesehatan Kota Cirebon'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-muted-foreground">
                                    <span>Status Akun:</span>
                                    <span className="font-semibold text-[var(--positive)]">
                                        {user.status === 'APPROVED' ? 'Terverifikasi' : user.status}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-muted-foreground">
                                    <span>Otorisasi:</span>
                                    <span className="font-mono text-[11.5px] text-foreground">
                                        {user.role}
                                    </span>
                                </div>
                            </div>
                        </Panel>

                        {/* Profile Edit Form */}
                        <Panel
                            padded
                            title="Informasi Pribadi & Kontak"
                            subtitle="Perbarui nama lengkap dan nomor kontak WhatsApp untuk koordinasi kedaruratan DBD"
                            className="lg:col-span-2"
                        >
                            <form onSubmit={handleSaveProfile} className="space-y-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <Label htmlFor="prof-name">Nama Lengkap</Label>
                                        <Input
                                            id="prof-name"
                                            value={name}
                                            onChange={(e) => {
                                                setName(e.target.value);
                                                if (profileErrors.name) setProfileErrors((prev) => ({ ...prev, name: '' }));
                                            }}
                                            placeholder="Nama lengkap petugas"
                                            aria-invalid={Boolean(profileErrors.name)}
                                            className="mt-1.5"
                                            required
                                        />
                                        {profileErrors.name && (
                                            <p className="mt-1 text-[12px] text-[var(--negative)]">
                                                {profileErrors.name}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <Label htmlFor="prof-email">Alamat Email (Akun)</Label>
                                        <div className="relative mt-1.5">
                                            <Input
                                                id="prof-email"
                                                value={user.email}
                                                disabled
                                                className="bg-[var(--raised)] text-muted-foreground pr-8 cursor-not-allowed"
                                            />
                                            <Lock className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
                                        </div>
                                        <p className="mt-1 text-[11px] text-muted-foreground">
                                            Email dikunci demi kepatuhan audit sistem
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <Label htmlFor="prof-role">Peran & Tanggung Jawab</Label>
                                        <Input
                                            id="prof-role"
                                            value={ROLE_LABEL[user.role] ?? user.role}
                                            disabled
                                            className="mt-1.5 bg-[var(--raised)] text-muted-foreground cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="prof-inst">Fasilitas / Instansi</Label>
                                        <Input
                                            id="prof-inst"
                                            value={user.institution ?? 'Dinas Kesehatan'}
                                            disabled
                                            className="mt-1.5 bg-[var(--raised)] text-muted-foreground cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-[var(--rule)] pt-4 space-y-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="prof-wa" className="text-[13px] font-medium">
                                            Nomor WhatsApp Petugas
                                        </Label>
                                        <div className="relative">
                                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                                                <Phone className="size-4 text-[var(--accent)]" aria-hidden />
                                            </div>
                                            <Input
                                                id="prof-wa"
                                                type="tel"
                                                inputMode="tel"
                                                value={phone}
                                                onChange={(e) => {
                                                    setPhone(e.target.value);
                                                    if (profileErrors.whatsappPhone) {
                                                        setProfileErrors((prev) => ({ ...prev, whatsappPhone: '' }));
                                                    }
                                                }}
                                                placeholder="Contoh: 0812-3456-7890 atau +6281234567890"
                                                aria-invalid={Boolean(profileErrors.whatsappPhone)}
                                                className={cn(
                                                    'pl-9 font-mono text-[13px]',
                                                    profileErrors.whatsappPhone &&
                                                        'border-[var(--negative)] ring-2 ring-[var(--negative)]/20',
                                                )}
                                            />
                                        </div>
                                        {profileErrors.whatsappPhone ? (
                                            <p className="text-[11.5px] font-medium text-[var(--negative)]">
                                                {profileErrors.whatsappPhone}
                                            </p>
                                        ) : (
                                            <p className="text-[11.5px] text-muted-foreground">
                                                Format Indonesia (08... atau +62...). Nomor ini menerima ringkasan penugasan PE dan peringatan SLA kritis dari sistem.
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--raised)]/40 p-3">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="prof-optin" className="text-[13px] font-medium text-foreground cursor-pointer">
                                                Aktifkan Notifikasi WhatsApp Otomatis
                                            </Label>
                                            <p className="text-[11.5px] text-muted-foreground">
                                                Kirim pesan instan saat ada laporan masuk atau batas waktu SLA mendekati kedaluwarsa.
                                            </p>
                                        </div>
                                        <Switch
                                            id="prof-optin"
                                            checked={optIn}
                                            onCheckedChange={setOptIn}
                                        />
                                    </div>
                                </div>

                                <div className="pt-2 flex justify-end">
                                    <Button
                                        type="submit"
                                        disabled={savingProfile}
                                        className="gap-2 font-medium"
                                    >
                                        <Save className="size-4" />
                                        {savingProfile ? 'Menyimpan Profil…' : 'Simpan Perubahan Profil'}
                                    </Button>
                                </div>
                            </form>
                        </Panel>
                    </div>
                </TabsContent>

                {/* 2. Keamanan & Kata Sandi */}
                <TabsContent value="keamanan" className="space-y-6 pt-4">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <Panel
                            padded
                            title="Ganti Kata Sandi"
                            subtitle="Pastikan kata sandi baru Anda minimal 10 karakter dan sulit ditebak"
                            className="lg:col-span-2"
                        >
                            <form onSubmit={handleChangePassword} className="space-y-4">
                                <div>
                                    <Label htmlFor="pwd-current">Kata Sandi Saat Ini</Label>
                                    <div className="relative mt-1.5">
                                        <Input
                                            id="pwd-current"
                                            type={showPassword ? 'text' : 'password'}
                                            value={currentPassword}
                                            onChange={(e) => {
                                                setCurrentPassword(e.target.value);
                                                if (passwordErrors.currentPassword) setPasswordErrors((prev) => ({ ...prev, currentPassword: '' }));
                                            }}
                                            placeholder="Masukkan kata sandi lama Anda"
                                            aria-invalid={Boolean(passwordErrors.currentPassword)}
                                            required
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showPassword ? (
                                                <EyeOff className="size-4" />
                                            ) : (
                                                <Eye className="size-4" />
                                            )}
                                        </button>
                                    </div>
                                    {passwordErrors.currentPassword && (
                                        <p className="mt-1 text-[12px] text-[var(--negative)]">
                                            {passwordErrors.currentPassword}
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <Label htmlFor="pwd-new">Kata Sandi Baru</Label>
                                        <Input
                                            id="pwd-new"
                                            type={showPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => {
                                                setNewPassword(e.target.value);
                                                if (passwordErrors.newPassword) setPasswordErrors((prev) => ({ ...prev, newPassword: '' }));
                                            }}
                                            placeholder="Minimal 10 karakter"
                                            aria-invalid={Boolean(passwordErrors.newPassword)}
                                            required
                                            className="mt-1.5"
                                        />
                                        {passwordErrors.newPassword && (
                                            <p className="mt-1 text-[12px] text-[var(--negative)]">
                                                {passwordErrors.newPassword}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <Label htmlFor="pwd-confirm">Konfirmasi Kata Sandi Baru</Label>
                                        <Input
                                            id="pwd-confirm"
                                            type={showPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => {
                                                setConfirmPassword(e.target.value);
                                                if (passwordErrors.confirmPassword) setPasswordErrors((prev) => ({ ...prev, confirmPassword: '' }));
                                            }}
                                            placeholder="Ulangi kata sandi baru"
                                            aria-invalid={Boolean(passwordErrors.confirmPassword)}
                                            required
                                            className="mt-1.5"
                                        />
                                        {passwordErrors.confirmPassword && (
                                            <p className="mt-1 text-[12px] text-[var(--negative)]">
                                                {passwordErrors.confirmPassword}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-lg border border-[var(--border)] bg-[var(--raised)]/40 p-3 text-[12px] text-muted-foreground space-y-1">
                                    <p className="font-medium text-foreground">
                                        Ketentuan Kata Sandi yang Baik:
                                    </p>
                                    <ul className="list-inside list-disc space-y-0.5">
                                        <li>Minimal 10 karakter sesuai standar sistem Better-Auth</li>
                                        <li>Kombinasikan huruf besar, huruf kecil, angka, dan simbol khusus</li>
                                        <li>Hindari penggunaan nama lengkap atau tanggal lahir</li>
                                    </ul>
                                </div>

                                <div className="pt-2 flex justify-end">
                                    <Button
                                        type="submit"
                                        disabled={savingPassword}
                                        className="gap-2 font-medium"
                                    >
                                        <KeyRound className="size-4" />
                                        {savingPassword ? 'Memperbarui Kata Sandi…' : 'Perbarui Kata Sandi'}
                                    </Button>
                                </div>
                            </form>
                        </Panel>

                        {/* Security Features Overview */}
                        <div className="space-y-4">
                            <Panel padded title="Standar Enkripsi Medis">
                                <div className="space-y-3 text-[12.5px] text-muted-foreground">
                                    <div className="flex items-start gap-2.5 rounded-lg border border-[var(--pill-positive-border)] bg-[var(--pill-positive-bg)] p-3 text-[var(--positive)]">
                                        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                                        <div>
                                            <p className="font-semibold text-foreground">
                                                AES-256-GCM Terpasang
                                            </p>
                                            <p className="mt-0.5 text-[11.5px] text-muted-foreground leading-relaxed">
                                                Seluruh data NIK, nama pasien, dan rekam medis klinis dienkripsi saat disimpan di basis data.
                                            </p>
                                        </div>
                                    </div>
                                    <p className="leading-relaxed">
                                        Kunci enkripsi dikelola secara independen di lingkungan server tertutup untuk menjamin kerahasiaan pasien sesuai UU Perlindungan Data Pribadi (UU PDP).
                                    </p>
                                </div>
                            </Panel>

                            <Panel padded title="Sesi & Audit Akses">
                                <div className="space-y-2.5 text-[12.5px]">
                                    <div className="flex items-center gap-2 text-foreground font-medium">
                                        <Laptop className="size-4 text-[var(--accent)]" />
                                        <span>Perangkat Saat Ini</span>
                                    </div>
                                    <p className="text-[11.5px] text-muted-foreground">
                                        Akses aktif melalui peramban terautentikasi. Semua riwayat penambahan atau modifikasi data tercatat di Audit Log sistem.
                                    </p>
                                </div>
                            </Panel>
                        </div>
                    </div>
                </TabsContent>

                {/* 3. Notifikasi & Preferensi Tampilan */}
                <TabsContent value="preferensi" className="space-y-6 pt-4">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Theme Preferences */}
                        <Panel
                            padded
                            title="Preferensi Tampilan Antarmuka"
                            subtitle="Pilih tema tampilan yang paling nyaman untuk workstation atau perangkat lapangan Anda"
                        >
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    {
                                        value: 'light',
                                        label: 'Terang (Light)',
                                        icon: Sun,
                                        desc: 'Kontras tinggi untuk siang hari',
                                    },
                                    {
                                        value: 'dark',
                                        label: 'Gelap (Dark)',
                                        icon: Moon,
                                        desc: 'Mengurangi kelelahan mata di ruang redup',
                                    },
                                    {
                                        value: 'system',
                                        label: 'Sistem',
                                        icon: Laptop,
                                        desc: 'Mengikuti pengaturan OS perangkat',
                                    },
                                ].map((item) => {
                                    const active = theme === item.value;
                                    return (
                                        <button
                                            key={item.value}
                                            type="button"
                                            onClick={() => {
                                                setTheme(item.value);
                                                toast.success(`Tema diubah ke ${item.label}`);
                                            }}
                                            className={cn(
                                                'flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border p-4 text-center transition-all select-none',
                                                active
                                                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)] shadow-xs'
                                                    : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--raised)]/50',
                                            )}
                                        >
                                            <item.icon
                                                className={cn(
                                                    'size-5',
                                                    active ? 'text-[var(--accent)]' : 'text-muted-foreground',
                                                )}
                                            />
                                            <span className="text-[13px] font-semibold text-foreground">
                                                {item.label}
                                            </span>
                                            <span className="text-[11px] text-muted-foreground leading-tight">
                                                {item.desc}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </Panel>

                        {/* Notification Subscriptions */}
                        <Panel
                            padded
                            title="Langganan Notifikasi Operasional"
                            subtitle="Kustomisasi jenis peringatan surveilans yang ingin Anda terima"
                        >
                            <div className="space-y-4">
                                <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
                                    <div className="space-y-0.5">
                                        <p className="text-[13px] font-medium text-foreground">
                                            Laporan Kasus Masuk Baru
                                        </p>
                                        <p className="text-[11.5px] text-muted-foreground">
                                            Pemberitahuan instan saat ada faskes yang menginput kasus DBD baru di wilayah kerja Anda.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={alertCase}
                                        onCheckedChange={setAlertCase}
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
                                    <div className="space-y-0.5">
                                        <p className="text-[13px] font-medium text-foreground">
                                            Peringatan Batas SLA Kritis (24j / 72j)
                                        </p>
                                        <p className="text-[11.5px] text-muted-foreground">
                                            Peringatan darurat saat kasus belum direspon mendekati batas waktu SLA operasional.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={alertSla}
                                        onCheckedChange={setAlertSla}
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5">
                                    <div className="space-y-0.5">
                                        <p className="text-[13px] font-medium text-foreground">
                                            Tugas Penyelidikan Epidemiologi (PE)
                                        </p>
                                        <p className="text-[11.5px] text-muted-foreground">
                                            Instruksi investigasi lapangan dan jadwal fogging fokus siklus 1 & 2.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={alertTask}
                                        onCheckedChange={setAlertTask}
                                    />
                                </div>
                            </div>
                        </Panel>
                    </div>
                </TabsContent>

                {/* 4. Parameter Sistem & SLA (Dinkes / Admin) */}
                {canManageSystem && (
                    <TabsContent value="sistem" className="space-y-6 pt-4">
                        {/* SLA Standard Reference Cards */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
                                <div className="flex items-center gap-2 text-[var(--accent)] mb-1">
                                    <Clock className="size-4" />
                                    <span className="text-[12px] font-semibold uppercase tracking-wider">
                                        SLA Respon Puskesmas
                                    </span>
                                </div>
                                <p className="text-xl font-bold text-foreground">
                                    ≤ 24 Jam
                                </p>
                                <p className="text-[11.5px] text-muted-foreground mt-1">
                                    Waktu maksimal respon puskesmas setelah KDRS diterima
                                </p>
                            </div>

                            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
                                <div className="flex items-center gap-2 text-[var(--positive)] mb-1">
                                    <ShieldCheck className="size-4" />
                                    <span className="text-[12px] font-semibold uppercase tracking-wider">
                                        SLA Verifikasi Dinkes
                                    </span>
                                </div>
                                <p className="text-xl font-bold text-foreground">
                                    ≤ 72 Jam
                                </p>
                                <p className="text-[11.5px] text-muted-foreground mt-1">
                                    Verifikasi berkas laporan PE lengkap oleh tim surveilans
                                </p>
                            </div>

                            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
                                <div className="flex items-center gap-2 text-[var(--warning)] mb-1">
                                    <ShieldAlert className="size-4" />
                                    <span className="text-[12px] font-semibold uppercase tracking-wider">
                                        Trombosit Kritis
                                    </span>
                                </div>
                                <p className="text-xl font-bold text-foreground">
                                    &lt; 100.000 /µL
                                </p>
                                <p className="text-[11.5px] text-muted-foreground mt-1">
                                    Ambang batas kriteria trombositopenia DBD
                                </p>
                            </div>

                            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
                                <div className="flex items-center gap-2 text-[var(--info)] mb-1">
                                    <Building2 className="size-4" />
                                    <span className="text-[12px] font-semibold uppercase tracking-wider">
                                        Target Bebas Jentik
                                    </span>
                                </div>
                                <p className="text-xl font-bold text-foreground">
                                    ABJ ≥ 95%
                                </p>
                                <p className="text-[11.5px] text-muted-foreground mt-1">
                                    Target standar Angka Bebas Jentik tingkat kelurahan
                                </p>
                            </div>
                        </div>

                        {/* System Settings Database Table */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground">
                                        Parameter Konfigurasi Basis Data
                                    </h3>
                                    <p className="text-[12.5px] text-muted-foreground">
                                        Menampilkan {systemSettings.length} dari {totalSettings} pengaturan sistem aktif.
                                    </p>
                                </div>
                                {isAdmin && <CreateSettingButton categories={categories} />}
                            </div>

                            {categories.map((category) => {
                                const items = groupedSettings.get(category) ?? [];
                                if (items.length === 0) return null;

                                return (
                                    <Panel
                                        key={category}
                                        title={`Kategori: ${category}`}
                                        subtitle={`${items.length} parameter terkonfigurasi`}
                                    >
                                        <div className="overflow-x-auto">
                                            <table className="ledger min-w-[700px]">
                                                <thead>
                                                    <tr>
                                                        <th scope="col" className="w-[30%]">Kunci Parameter</th>
                                                        <th scope="col" className="w-[30%]">Nilai Saat Ini</th>
                                                        <th scope="col" className="w-[25%]">Deskripsi</th>
                                                        {isAdmin && <th scope="col" className="w-[15%] text-right">Aksi</th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {items.map((setting) => (
                                                        <tr key={setting.id}>
                                                            <td>
                                                                <span className="font-mono text-[12.5px] font-medium text-foreground">
                                                                    {setting.key}
                                                                </span>
                                                                <span className="ml-2 rounded bg-[var(--raised)] px-1.5 py-0.5 text-[10.5px] text-muted-foreground uppercase">
                                                                    {setting.type}
                                                                </span>
                                                            </td>
                                                            <td className="font-mono text-[12.5px] text-foreground">
                                                                {setting.value}
                                                            </td>
                                                            <td className="text-[12px] text-muted-foreground">
                                                                {setting.description ?? '—'}
                                                            </td>
                                                            {isAdmin && (
                                                                <td className="text-right">
                                                                    <SettingRowActions
                                                                        row={setting}
                                                                        categories={categories}
                                                                    />
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </Panel>
                                );
                            })}
                        </div>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
