'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
    ArrowLeft,
    ArrowRight,
    Building2,
    CheckCircle2,
    Eye,
    EyeOff,
    Hospital,
    Loader2,
    Mail,
    Stethoscope,
    User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { registerSchema, type RegisterInput } from '@/lib/auth-schemas';
import {
    sendRegisterOtpAction,
    verifyAndRegisterAction,
} from './actions';
import {
    AuthCardFooter,
    AuthErrorAlert,
    AuthSteps,
    OtpCodeInput,
    PasswordRequirements,
} from '@/components/auth/auth-ui';

type InstitutionItem = {
    id: string;
    name: string;
    type: string;
    city?: string | null;
};

type Props = {
    institutions?: InstitutionItem[];
};

const ROLE_OPTIONS = [
    {
        id: 'PUSKESMAS' as const,
        title: 'Puskesmas',
        desc: 'Fasilitas primer & penyelidikan lapangan',
        icon: Stethoscope,
    },
    {
        id: 'RUMAH_SAKIT' as const,
        title: 'Rumah Sakit',
        desc: 'Fasilitas rujukan & laporan bangsal DBD',
        icon: Hospital,
    },
    {
        id: 'DINKES' as const,
        title: 'Dinkes',
        desc: 'Pengelola surveilans kota & koordinator PE',
        icon: Building2,
    },
];

const STEPS = ['Profil Instansi', 'Verifikasi OTP', 'Selesai'];

export function RegisterForm({ institutions = [] }: Props) {
    const router = useRouter();

    const [step, setStep] = useState<'FORM' | 'OTP' | 'SUCCESS'>('FORM');
    const [role, setRole] = useState<'PUSKESMAS' | 'RUMAH_SAKIT' | 'DINKES'>('PUSKESMAS');
    const [institutionId, setInstitutionId] = useState<string>(
        () => institutions.find((i) => i.type === 'PUSKESMAS')?.id || '',
    );

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [otp, setOtp] = useState('');

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [resendTimer, setResendTimer] = useState(0);

    // Filter institutions matching the active role
    const filteredInstitutions = institutions.filter((i) => i.type === role);

    // Resend OTP countdown
    useEffect(() => {
        if (resendTimer <= 0) return;
        const interval = setInterval(() => {
            setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, [resendTimer]);

    const handleRoleChange = (newRole: 'PUSKESMAS' | 'RUMAH_SAKIT' | 'DINKES') => {
        setRole(newRole);
        if (newRole === 'DINKES') {
            setInstitutionId('');
        } else {
            const first = institutions.find((i) => i.type === newRole);
            setInstitutionId(first ? first.id : '');
        }
        setFieldErrors((prev) => ({ ...prev, role: '', institutionId: '' }));
    };

    // Step 1: Send registration OTP
    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        if (password !== confirm) {
            setFieldErrors({ confirm: 'Konfirmasi kata sandi tidak cocok' });
            return;
        }

        const payload: RegisterInput = {
            name: name.trim(),
            email: email.trim(),
            password,
            confirm,
            role,
            institutionId: role === 'DINKES' ? undefined : institutionId,
        };

        const parsed = registerSchema.safeParse(payload);
        if (!parsed.success) {
            const errs: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
                const k = String(issue.path[0]);
                if (k && !errs[k]) errs[k] = issue.message;
            }
            setFieldErrors(errs);
            return;
        }

        setPending(true);
        try {
            const res = await sendRegisterOtpAction(parsed.data);
            if (!res.ok) {
                setError(res.error || 'Gagal mengirim kode verifikasi OTP.');
                if (res.fieldErrors) setFieldErrors(res.fieldErrors);
                setPending(false);
                return;
            }

            toast.success(`Kode OTP 6-digit telah dikirim ke ${email}`);
            setStep('OTP');
            setResendTimer(60);
        } catch (err: unknown) {
            console.error('sendRegisterOtpAction exception:', err);
            setError('Terjadi kendala jaringan saat mengirim kode OTP.');
        } finally {
            setPending(false);
        }
    };

    // Resend OTP
    const handleResendOtp = async () => {
        if (resendTimer > 0 || pending) return;
        setError(null);
        setPending(true);

        const payload: RegisterInput = {
            name: name.trim(),
            email: email.trim(),
            password,
            confirm,
            role,
            institutionId: role === 'DINKES' ? undefined : institutionId,
        };

        try {
            const res = await sendRegisterOtpAction(payload);
            if (!res.ok) {
                setError(res.error || 'Gagal mengirim ulang OTP.');
                return;
            }
            toast.success('Kode OTP baru telah dikirimkan ke email Anda.');
            setResendTimer(60);
        } catch {
            setError('Kendala jaringan saat meminta ulang kode OTP.');
        } finally {
            setPending(false);
        }
    };

    // Step 2: Verify OTP and create user
    const handleVerifyAndRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!otp || otp.length !== 6) {
            setError('Masukkan 6 digit kode OTP yang dikirimkan.');
            return;
        }

        setPending(true);
        try {
            const payload = {
                name: name.trim(),
                email: email.trim(),
                password,
                confirm,
                role,
                institutionId: role === 'DINKES' ? undefined : institutionId,
                otp: otp.trim(),
            };

            const res = await verifyAndRegisterAction(payload);
            if (!res.ok) {
                setError(res.error || 'Verifikasi OTP gagal.');
                setPending(false);
                return;
            }

            toast.success('Pendaftaran akun berhasil!');
            setStep('SUCCESS');
        } catch (err: unknown) {
            console.error('verifyAndRegisterAction exception:', err);
            setError('Terjadi kesalahan saat memverifikasi kode OTP.');
        } finally {
            setPending(false);
        }
    };

    const currentStepIndex = step === 'FORM' ? 0 : step === 'OTP' ? 1 : 2;

    if (step === 'SUCCESS') {
        return (
            <div className="space-y-5 py-2 text-center">
                <AuthSteps steps={STEPS} currentIndex={2} />

                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-[var(--positive)]/30 bg-[var(--pill-positive-bg)] text-[var(--positive)] shadow-xs">
                    <CheckCircle2 className="size-8" />
                </div>

                <div className="space-y-2">
                    <h3 className="text-[19px] font-semibold tracking-tight text-foreground">
                        Pengajuan Akun Terkirim
                    </h3>
                    <p className="mx-auto max-w-[36ch] text-[13px] leading-relaxed text-muted-foreground">
                        Email <strong className="font-medium text-foreground">{email}</strong> telah
                        terverifikasi. Akun Anda sedang ditinjau administrator Dinas Kesehatan Kota Cirebon.
                    </p>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--raised)]/60 p-3.5 text-left text-[12.5px] leading-relaxed text-muted-foreground">
                    <p className="font-semibold text-foreground">Langkah Selanjutnya:</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                        <li>Administrator memeriksa kesesuaian data instansi.</li>
                        <li>Notifikasi pengaktifan akun akan dikirimkan via email.</li>
                        <li>Setelah disetujui, Anda dapat langsung masuk ke ruang kerja.</li>
                    </ul>
                </div>

                <Button
                    onClick={() => router.push('/masuk')}
                    className="h-10 w-full rounded-xl bg-[var(--accent)] font-semibold text-[var(--accent-ink)] hover:opacity-95"
                >
                    Kembali ke Halaman Masuk
                </Button>
            </div>
        );
    }

    if (step === 'OTP') {
        return (
            <form onSubmit={handleVerifyAndRegister} className="space-y-5">
                <AuthSteps steps={STEPS} currentIndex={1} />
                <AuthErrorAlert message={error} />

                <div className="space-y-1.5 text-center">
                    <div className="mx-auto flex size-10 items-center justify-center rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)]">
                        <Mail className="size-5" />
                    </div>
                    <h3 className="text-[17px] font-semibold text-foreground">
                        Masukkan 6-Digit Kode OTP
                    </h3>
                    <p className="text-[12.5px] text-muted-foreground">
                        Kode verifikasi telah dikirim ke{' '}
                        <strong className="font-medium text-foreground">{email}</strong>
                    </p>
                </div>

                <Field className="space-y-2">
                    <FieldLabel htmlFor="register-otp" className="sr-only">
                        Kode OTP 6 Digit
                    </FieldLabel>
                    <OtpCodeInput
                        id="register-otp"
                        value={otp}
                        onChange={setOtp}
                        disabled={pending}
                    />
                    <p className="text-center text-[11.5px] text-muted-foreground">
                        Masa berlaku kode 10 menit. Maksimal 5 kali percobaan.
                    </p>
                </Field>

                <div className="space-y-2">
                    <Button
                        type="submit"
                        disabled={pending || otp.length !== 6}
                        className="h-10 w-full rounded-xl bg-[var(--accent)] font-semibold text-[var(--accent-ink)] hover:opacity-95"
                    >
                        {pending ? (
                            <span className="inline-flex items-center gap-2">
                                <Loader2 className="size-4 animate-spin" />
                                <span>Memverifikasi OTP...</span>
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-2">
                                <span>Verifikasi & Ajukan Akun</span>
                                <ArrowRight className="size-4" />
                            </span>
                        )}
                    </Button>

                    <div className="flex items-center justify-between pt-1 text-[12.5px]">
                        <button
                            type="button"
                            onClick={() => {
                                setStep('FORM');
                                setError(null);
                            }}
                            disabled={pending}
                            className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="size-3.5" />
                            <span>Ubah Data</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleResendOtp}
                            disabled={resendTimer > 0 || pending}
                            className={cn(
                                'font-medium transition-colors',
                                resendTimer > 0 || pending
                                    ? 'cursor-not-allowed text-muted-foreground/60'
                                    : 'text-[var(--accent)] hover:underline',
                            )}
                        >
                            {resendTimer > 0 ? `Kirim ulang (${resendTimer}s)` : 'Kirim Ulang OTP'}
                        </button>
                    </div>
                </div>
            </form>
        );
    }

    return (
        <form onSubmit={handleSendOtp} className="space-y-4">
            <AuthSteps steps={STEPS} currentIndex={currentStepIndex} />
            <AuthErrorAlert message={error} />

            {/* Peran Instansi */}
            <div className="space-y-1.5">
                <label className="text-[12.5px] font-medium text-foreground">
                    Peran Fasilitas Kesehatan
                </label>
                <div className="grid grid-cols-3 gap-2">
                    {ROLE_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const active = role === opt.id;
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleRoleChange(opt.id)}
                                className={cn(
                                    'group relative flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-all',
                                    active
                                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]/60 text-[var(--accent)] shadow-2xs'
                                        : 'border-[var(--border)] bg-[var(--raised)]/40 text-muted-foreground hover:border-[var(--accent)]/40 hover:text-foreground',
                                )}
                            >
                                <Icon
                                    className={cn(
                                        'size-4.5 transition-transform group-hover:scale-105',
                                        active ? 'text-[var(--accent)]' : 'text-muted-foreground',
                                    )}
                                />
                                <span className="text-[12px] font-semibold leading-tight text-foreground">
                                    {opt.title}
                                </span>
                            </button>
                        );
                    })}
                </div>
                {fieldErrors.role && <FieldError className="text-[11.5px]">{fieldErrors.role}</FieldError>}
            </div>

            {/* Pemilihan Instansi (Puskesmas / RS) */}
            {role !== 'DINKES' && (
                <Field className="space-y-1.5">
                    <FieldLabel htmlFor="institution-select" className="text-[12.5px] font-medium text-foreground">
                        Nama {role === 'PUSKESMAS' ? 'Puskesmas' : 'Rumah Sakit'}
                    </FieldLabel>
                    <select
                        id="institution-select"
                        value={institutionId}
                        onChange={(e) => setInstitutionId(e.target.value)}
                        disabled={pending}
                        aria-invalid={Boolean(fieldErrors.institutionId)}
                        className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--ground)] px-3 text-[13px] text-foreground transition-colors focus:border-[var(--accent)] focus:outline-hidden"
                    >
                        {filteredInstitutions.length === 0 ? (
                            <option value="">Tidak ada instansi terdaftar</option>
                        ) : (
                            filteredInstitutions.map((inst) => (
                                <option key={inst.id} value={inst.id}>
                                    {inst.name} {inst.city ? `(${inst.city})` : ''}
                                </option>
                            ))
                        )}
                    </select>
                    {fieldErrors.institutionId && (
                        <FieldError className="text-[11.5px]">{fieldErrors.institutionId}</FieldError>
                    )}
                </Field>
            )}

            {/* Nama Pemohon & Email */}
            <FieldGroup className="space-y-3">
                <Field className="space-y-1">
                    <FieldLabel htmlFor="name" className="text-[12.5px] font-medium text-foreground">
                        Nama Lengkap Petugas
                    </FieldLabel>
                    <div className="relative">
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="dr. Ahmad Fauzi / Siti Rahma, S.Kep"
                            disabled={pending}
                            aria-invalid={Boolean(fieldErrors.name)}
                            className="h-10 bg-[var(--ground)] pr-10 text-[13px]"
                        />
                        <User className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground/60" />
                    </div>
                    {fieldErrors.name && <FieldError className="text-[11.5px]">{fieldErrors.name}</FieldError>}
                </Field>

                <Field className="space-y-1">
                    <FieldLabel htmlFor="email" className="text-[12.5px] font-medium text-foreground">
                        Alamat Email Dinas / Instansi
                    </FieldLabel>
                    <div className="relative">
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="nama@puskesmas.go.id"
                            disabled={pending}
                            aria-invalid={Boolean(fieldErrors.email)}
                            className="h-10 bg-[var(--ground)] pr-10 text-[13px]"
                        />
                        <Mail className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground/60" />
                    </div>
                    {fieldErrors.email && <FieldError className="text-[11.5px]">{fieldErrors.email}</FieldError>}
                </Field>

                {/* Password & Confirm */}
                <Field className="space-y-1">
                    <FieldLabel htmlFor="password" className="text-[12.5px] font-medium text-foreground">
                        Kata Sandi Baru
                    </FieldLabel>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimal 7 karakter + simbol"
                            disabled={pending}
                            aria-invalid={Boolean(fieldErrors.password)}
                            className="h-10 bg-[var(--ground)] pr-10 text-[13px]"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((p) => !p)}
                            disabled={pending}
                            aria-label={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-hidden"
                        >
                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                    </div>
                    <PasswordRequirements password={password} />
                    {fieldErrors.password && (
                        <FieldError className="text-[11.5px]">{fieldErrors.password}</FieldError>
                    )}
                </Field>

                <Field className="space-y-1">
                    <FieldLabel htmlFor="confirm" className="text-[12.5px] font-medium text-foreground">
                        Konfirmasi Kata Sandi
                    </FieldLabel>
                    <div className="relative">
                        <Input
                            id="confirm"
                            type={showConfirm ? 'text' : 'password'}
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            placeholder="Ulangi kata sandi"
                            disabled={pending}
                            aria-invalid={Boolean(fieldErrors.confirm)}
                            className="h-10 bg-[var(--ground)] pr-10 text-[13px]"
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm((p) => !p)}
                            disabled={pending}
                            aria-label={showConfirm ? 'Sembunyikan sandi' : 'Lihat sandi'}
                            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-hidden"
                        >
                            {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                    </div>
                    {fieldErrors.confirm && (
                        <FieldError className="text-[11.5px]">{fieldErrors.confirm}</FieldError>
                    )}
                </Field>
            </FieldGroup>

            <Button
                type="submit"
                disabled={pending}
                className="mt-2 h-10 w-full rounded-xl bg-[var(--accent)] font-semibold text-[var(--accent-ink)] hover:opacity-95"
            >
                {pending ? (
                    <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        <span>Mengirim Kode OTP...</span>
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-2">
                        <span>Lanjut ke Verifikasi OTP</span>
                        <ArrowRight className="size-4" />
                    </span>
                )}
            </Button>

            <AuthCardFooter>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Sudah memiliki akun terdaftar?</span>
                    <Link
                        href="/masuk"
                        className="font-semibold text-[var(--accent)] hover:underline"
                    >
                        Masuk ruang kerja
                    </Link>
                </div>
            </AuthCardFooter>
        </form>
    );
}
