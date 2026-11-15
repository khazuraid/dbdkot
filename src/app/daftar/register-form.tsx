'use client';

import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { cn } from '@/lib/utils';
import {
    registerSchema,
    sendRegisterOtpAction,
    verifyAndRegisterAction,
    type RegisterInput,
} from './actions';

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
        desc: 'Fasilitas pelayanan primer di tingkat kecamatan/kelurahan',
        icon: Stethoscope,
    },
    {
        id: 'RUMAH_SAKIT' as const,
        title: 'Rumah Sakit',
        desc: 'Fasilitas rujukan & laporan kasus DBD',
        icon: Hospital,
    },
    {
        id: 'DINKES' as const,
        title: 'Dinas Kesehatan',
        desc: 'Pengelola surveilans kota & koordinator PE',
        icon: Building2,
    },
];

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
    const [resendTimer, setResendTimer] = useState<number>(0);

    // Filter institutions by active role
    const filteredInstitutions = institutions.filter((i) => i.type === role);

    const handleRoleChange = (nextRole: 'PUSKESMAS' | 'RUMAH_SAKIT' | 'DINKES') => {
        setRole(nextRole);
        if (nextRole === 'DINKES') {
            setInstitutionId('');
        } else {
            const first = institutions.find((i) => i.type === nextRole);
            setInstitutionId(first?.id || '');
        }
    };

    // Countdown timer for resending OTP
    useEffect(() => {
        if (resendTimer <= 0) return;
        const interval = setInterval(() => {
            setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, [resendTimer]);

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        const payload: RegisterInput = {
            name: name.trim(),
            email: email.trim(),
            role,
            institutionId: role === 'DINKES' ? null : institutionId,
            password,
            confirm,
        };

        const parsed = registerSchema.safeParse(payload);
        if (!parsed.success) {
            const errs: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
                if (issue.path[0]) errs[String(issue.path[0])] = issue.message;
            }
            setFieldErrors(errs);
            if (errs.confirm && !errs.password) setError(errs.confirm);
            else if (errs.institutionId) setError(errs.institutionId);
            return;
        }

        setPending(true);
        try {
            const res = await sendRegisterOtpAction(payload);
            if (!res.ok) {
                setError(res.error);
                if (res.fieldErrors) setFieldErrors(res.fieldErrors);
                return;
            }

            setStep('OTP');
            setResendTimer(60);
            toast.success(`Kode OTP telah dikirimkan ke email ${email}`);
        } catch {
            setError('Terjadi kendala saat menghubungi server. Silakan coba beberapa saat lagi.');
        } finally {
            setPending(false);
        }
    };

    const handleResendOtp = async () => {
        if (resendTimer > 0 || pending) return;
        setPending(true);
        setError(null);
        try {
            const payload: RegisterInput = {
                name: name.trim(),
                email: email.trim(),
                role,
                institutionId: role === 'DINKES' ? null : institutionId,
                password,
                confirm,
            };
            const res = await sendRegisterOtpAction(payload);
            if (!res.ok) {
                setError(res.error);
                return;
            }
            setResendTimer(60);
            toast.success('Kode OTP baru telah dikirim ke email Anda.');
        } catch {
            setError('Gagal mengirim ulang kode OTP.');
        } finally {
            setPending(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp || otp.trim().length !== 6) {
            setError('Masukkan 6 digit kode OTP yang diterima melalui email.');
            return;
        }

        setError(null);
        setPending(true);
        try {
            const payload = {
                name: name.trim(),
                email: email.trim(),
                role,
                institutionId: role === 'DINKES' ? null : institutionId,
                password,
                confirm,
                otp: otp.trim(),
            };

            const res = await verifyAndRegisterAction(payload);
            if (!res.ok) {
                setError(res.error);
                return;
            }

            setStep('SUCCESS');
            toast.success('Pendaftaran akun berhasil diverifikasi!');
        } catch {
            setError('Gagal memverifikasi OTP. Coba lagi.');
        } finally {
            setPending(false);
        }
    };

    if (step === 'SUCCESS') {
        return (
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 text-center space-y-4">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--pill-positive-bg)] text-[var(--positive)]">
                    <CheckCircle2 className="size-6" />
                </div>
                <div className="space-y-1.5">
                    <h3 className="text-base font-semibold text-foreground">
                        Pendaftaran Berhasil Diterima
                    </h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                        Email Anda (<strong>{email}</strong>) telah diverifikasi.
                        Administrator Dinas Kesehatan akan meninjau dan mengaktifkan akun Anda
                        sebelum dapat digunakan untuk masuk ke sistem.
                    </p>
                </div>
                <div className="pt-2">
                    <Button
                        type="button"
                        onClick={() => router.push('/masuk')}
                        className="w-full justify-between h-10 px-4"
                    >
                        <span>Kembali ke Halaman Masuk</span>
                        <ArrowRight className="size-4" strokeWidth={1.5} />
                    </Button>
                </div>
            </div>
        );
    }

    if (step === 'OTP') {
        return (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="rounded-[var(--radius-card)] border border-[var(--pill-info-border)] bg-[var(--pill-info-bg)] p-3.5 text-[12.5px] text-[var(--pill-info-ink)] flex items-start gap-2.5">
                    <Mail className="size-4 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium">Kode Verifikasi Dikirim</p>
                        <p className="text-muted-foreground mt-0.5">
                            Silakan periksa kotak masuk atau folder spam email <strong>{email}</strong>.
                        </p>
                    </div>
                </div>

                <Field data-invalid={Boolean(error)}>
                    <FieldLabel htmlFor="otp" className="text-[13px]">
                        6 Digit Kode OTP
                    </FieldLabel>
                    <Input
                        id="otp"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        autoFocus
                        className="h-12 text-center font-mono text-2xl tracking-[8px] font-bold"
                        required
                    />
                    <FieldDescription className="text-center text-[11.5px]">
                        Kode berlaku selama 10 menit
                    </FieldDescription>
                </Field>

                {error && <FieldError>{error}</FieldError>}

                <Button
                    type="submit"
                    disabled={pending || otp.length !== 6}
                    className="h-10 w-full justify-between px-3.5 font-medium"
                >
                    <span>{pending ? 'Memverifikasi…' : 'Verifikasi & Selesaikan Pendaftaran'}</span>
                    {pending ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <ArrowRight className="size-4" strokeWidth={1.5} />
                    )}
                </Button>

                <div className="flex items-center justify-between pt-2 text-[12.5px]">
                    <button
                        type="button"
                        onClick={() => {
                            setStep('FORM');
                            setError(null);
                        }}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="size-3.5" />
                        <span>Ubah data</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={resendTimer > 0 || pending}
                        className={cn(
                            'font-medium transition-colors',
                            resendTimer > 0
                                ? 'text-muted-foreground cursor-not-allowed'
                                : 'text-[var(--accent)] hover:underline',
                        )}
                    >
                        {resendTimer > 0
                            ? `Kirim ulang (${resendTimer}s)`
                            : 'Kirim ulang OTP'}
                    </button>
                </div>
            </form>
        );
    }

    return (
        <form onSubmit={handleSendOtp} noValidate className="space-y-4">
            <FieldGroup className="gap-3.5">
                {/* 1. Pemilihan Peran (Hanya Dinkes, RS, Puskesmas) */}
                <Field data-invalid={Boolean(fieldErrors.role)}>
                    <FieldLabel className="text-[13px]">
                        Pilih Peran Instansi <span className="text-[var(--negative)]">*</span>
                    </FieldLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {ROLE_OPTIONS.map((opt) => {
                            const Icon = opt.icon;
                            const active = role === opt.id;
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => handleRoleChange(opt.id)}
                                    className={cn(
                                        'flex flex-col items-start p-3 rounded-[var(--radius-control)] border text-left transition-all',
                                        active
                                            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-foreground shadow-xs'
                                            : 'border-[var(--border)] bg-[var(--surface)] text-muted-foreground hover:bg-[var(--raised)] hover:text-foreground',
                                    )}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Icon className={cn('size-4', active ? 'text-[var(--accent)]' : 'text-muted-foreground')} />
                                        <span className="text-[13px] font-semibold text-foreground">
                                            {opt.title}
                                        </span>
                                    </div>
                                    <span className="text-[11px] leading-tight text-muted-foreground line-clamp-2">
                                        {opt.desc}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </Field>

                {/* 2. Pemilihan Instansi Faskes (Puskesmas atau RS) */}
                {role !== 'DINKES' && (
                    <Field data-invalid={Boolean(fieldErrors.institutionId)}>
                        <FieldLabel htmlFor="institutionId" className="text-[13px]">
                            {role === 'PUSKESMAS' ? 'Nama Puskesmas' : 'Nama Rumah Sakit'} <span className="text-[var(--negative)]">*</span>
                        </FieldLabel>
                        <select
                            id="institutionId"
                            name="institutionId"
                            value={institutionId}
                            onChange={(e) => setInstitutionId(e.target.value)}
                            className="h-10 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-foreground outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                            required
                        >
                            <option value="" disabled>
                                Pilih {role === 'PUSKESMAS' ? 'Puskesmas' : 'Rumah Sakit'} Anda…
                            </option>
                            {filteredInstitutions.map((inst) => (
                                <option key={inst.id} value={inst.id}>
                                    {inst.name} {inst.city ? `(${inst.city})` : ''}
                                </option>
                            ))}
                        </select>
                        {fieldErrors.institutionId && (
                            <FieldError>{fieldErrors.institutionId}</FieldError>
                        )}
                    </Field>
                )}

                {/* 3. Nama Lengkap */}
                <Field data-invalid={Boolean(fieldErrors.name)}>
                    <FieldLabel htmlFor="name" className="text-[13px]">
                        Nama Lengkap <span className="text-[var(--negative)]">*</span>
                    </FieldLabel>
                    <Input
                        id="name"
                        name="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="dr. Ahmad Santoso"
                        autoComplete="name"
                        required
                        className="h-10"
                    />
                    {fieldErrors.name && <FieldError>{fieldErrors.name}</FieldError>}
                </Field>

                {/* 4. Alamat Email */}
                <Field data-invalid={Boolean(fieldErrors.email)}>
                    <FieldLabel htmlFor="email" className="text-[13px]">
                        Alamat Email Dinas / Faskes <span className="text-[var(--negative)]">*</span>
                    </FieldLabel>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@instansi.go.id"
                        autoComplete="email"
                        required
                        className="h-10"
                    />
                    <FieldDescription className="text-[11.5px]">
                        Kode OTP verifikasi akan dikirimkan ke email ini
                    </FieldDescription>
                    {fieldErrors.email && <FieldError>{fieldErrors.email}</FieldError>}
                </Field>

                {/* 5. Password dengan Validasi 7 Karakter + Simbol & Eye Toggle */}
                <Field data-invalid={Boolean(fieldErrors.password)}>
                    <FieldLabel htmlFor="password" className="text-[13px]">
                        Kata Sandi <span className="text-[var(--negative)]">*</span>
                    </FieldLabel>
                    <div className="relative">
                        <Input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimal 7 karakter & ada simbol"
                            autoComplete="new-password"
                            required
                            className="h-10 pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((p) => !p)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
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
                    <FieldDescription className="text-[11.5px]">
                        Ketentuan: Minimal 7 karakter dan mengandung minimal 1 simbol khusus (@, #, $, !, %, *)
                    </FieldDescription>
                    {fieldErrors.password && (
                        <FieldError>{fieldErrors.password}</FieldError>
                    )}
                </Field>

                {/* 6. Konfirmasi Password */}
                <Field data-invalid={Boolean(fieldErrors.confirm || error)}>
                    <FieldLabel htmlFor="confirm" className="text-[13px]">
                        Konfirmasi Kata Sandi <span className="text-[var(--negative)]">*</span>
                    </FieldLabel>
                    <div className="relative">
                        <Input
                            id="confirm"
                            name="confirm"
                            type={showConfirm ? 'text' : 'password'}
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            autoComplete="new-password"
                            required
                            className="h-10 pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm((p) => !p)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                            aria-label={showConfirm ? 'Sembunyikan password' : 'Lihat password'}
                        >
                            {showConfirm ? (
                                <EyeOff className="size-4" strokeWidth={1.5} />
                            ) : (
                                <Eye className="size-4" strokeWidth={1.5} />
                            )}
                        </button>
                    </div>
                    {fieldErrors.confirm && (
                        <FieldError>{fieldErrors.confirm}</FieldError>
                    )}
                </Field>
            </FieldGroup>

            {error && <FieldError>{error}</FieldError>}

            <Button
                type="submit"
                disabled={pending}
                className="h-10 w-full justify-between px-3.5 font-medium mt-2"
            >
                <span>{pending ? 'Mengirim kode OTP…' : 'Lanjut: Verifikasi Kode OTP'}</span>
                {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                ) : (
                    <ArrowRight className="size-4" strokeWidth={1.5} />
                )}
            </Button>
        </form>
    );
}
