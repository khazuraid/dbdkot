'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    Eye,
    EyeOff,
    Loader2,
    Mail,
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
    requestResetSchema,
    resetPasswordSchema,
    sendResetPasswordOtpAction,
    verifyAndResetPasswordAction,
} from './actions';

export function LupaPasswordForm() {
    const router = useRouter();
    const [step, setStep] = useState<'EMAIL' | 'RESET' | 'SUCCESS'>('EMAIL');

    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [resendTimer, setResendTimer] = useState(0);

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

        const parsed = requestResetSchema.safeParse({ email });
        if (!parsed.success) {
            setFieldErrors({ email: parsed.error.issues[0]?.message || 'Email tidak valid' });
            return;
        }

        setPending(true);
        try {
            const res = await sendResetPasswordOtpAction(parsed.data.email);
            if (!res.ok) {
                setError(res.error);
                return;
            }
            setStep('RESET');
            setResendTimer(60);
            toast.success(`Kode OTP pemulihan telah dikirim ke ${parsed.data.email}`);
        } catch {
            setError('Gagal menghubungi server. Silakan coba lagi.');
        } finally {
            setPending(false);
        }
    };

    const handleResendOtp = async () => {
        if (resendTimer > 0 || pending) return;
        setPending(true);
        setError(null);
        try {
            const res = await sendResetPasswordOtpAction(email);
            if (!res.ok) {
                setError(res.error);
                return;
            }
            setResendTimer(60);
            toast.success('Kode OTP baru telah dikirimkan ke email Anda.');
        } catch {
            setError('Gagal mengirim ulang OTP.');
        } finally {
            setPending(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        const payload = {
            email: email.trim(),
            otp: otp.trim(),
            password,
            confirm,
        };

        const parsed = resetPasswordSchema.safeParse(payload);
        if (!parsed.success) {
            const errs: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
                if (issue.path[0]) errs[String(issue.path[0])] = issue.message;
            }
            setFieldErrors(errs);
            return;
        }

        setPending(true);
        try {
            const res = await verifyAndResetPasswordAction(payload);
            if (!res.ok) {
                setError(res.error);
                if (res.fieldErrors) setFieldErrors(res.fieldErrors);
                return;
            }
            setStep('SUCCESS');
            toast.success('Kata sandi berhasil diperbarui!');
        } catch {
            setError('Gagal memperbarui kata sandi. Silakan coba lagi.');
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
                        Kata Sandi Berhasil Diperbarui
                    </h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                        Kata sandi untuk akun <strong>{email}</strong> telah direset.
                        Silakan masuk menggunakan kata sandi baru Anda.
                    </p>
                </div>
                <div className="pt-2">
                    <Button
                        type="button"
                        onClick={() => router.push('/masuk')}
                        className="w-full justify-between h-10 px-4"
                    >
                        <span>Masuk Sekarang</span>
                        <ArrowRight className="size-4" strokeWidth={1.5} />
                    </Button>
                </div>
            </div>
        );
    }

    if (step === 'RESET') {
        return (
            <form onSubmit={handleResetPassword} noValidate className="space-y-4">
                <div className="rounded-[var(--radius-card)] border border-[var(--pill-info-border)] bg-[var(--pill-info-bg)] p-3.5 text-[12.5px] text-[var(--pill-info-ink)] flex items-start gap-2.5">
                    <Mail className="size-4 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium">Kode OTP Terkirim</p>
                        <p className="text-muted-foreground mt-0.5">
                            Masukkan 6 digit kode OTP yang dikirimkan ke{' '}
                            <strong>{email}</strong> beserta kata sandi baru Anda.
                        </p>
                    </div>
                </div>

                <FieldGroup className="gap-3.5">
                    <Field data-invalid={Boolean(fieldErrors.otp)}>
                        <FieldLabel htmlFor="otp" className="text-[13px]">
                            6 Digit Kode OTP <span className="text-[var(--negative)]">*</span>
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
                            className="h-11 text-center font-mono text-xl tracking-[6px] font-bold"
                            required
                        />
                        {fieldErrors.otp && <FieldError>{fieldErrors.otp}</FieldError>}
                    </Field>

                    <Field data-invalid={Boolean(fieldErrors.password)}>
                        <FieldLabel htmlFor="password" className="text-[13px]">
                            Kata Sandi Baru <span className="text-[var(--negative)]">*</span>
                        </FieldLabel>
                        <div className="relative">
                            <Input
                                id="password"
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
                            Minimal 7 karakter dan mengandung minimal 1 simbol khusus (@, #, $, !, %, *)
                        </FieldDescription>
                        {fieldErrors.password && (
                            <FieldError>{fieldErrors.password}</FieldError>
                        )}
                    </Field>

                    <Field data-invalid={Boolean(fieldErrors.confirm)}>
                        <FieldLabel htmlFor="confirm" className="text-[13px]">
                            Konfirmasi Kata Sandi Baru <span className="text-[var(--negative)]">*</span>
                        </FieldLabel>
                        <div className="relative">
                            <Input
                                id="confirm"
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
                    className="h-10 w-full justify-between px-3.5 font-medium"
                >
                    <span>{pending ? 'Menyimpan…' : 'Simpan Kata Sandi Baru'}</span>
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
                            setStep('EMAIL');
                            setError(null);
                        }}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="size-3.5" />
                        <span>Ganti email</span>
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
            <FieldGroup>
                <Field data-invalid={Boolean(fieldErrors.email || error)}>
                    <FieldLabel htmlFor="email" className="text-[13px]">
                        Email Akun Terdaftar <span className="text-[var(--negative)]">*</span>
                    </FieldLabel>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@instansi.go.id"
                        autoComplete="email"
                        autoFocus
                        required
                        className="h-10"
                    />
                    <FieldDescription className="text-[11.5px]">
                        Kami akan mengirimkan kode OTP 6 digit ke alamat email Anda.
                    </FieldDescription>
                    {fieldErrors.email && <FieldError>{fieldErrors.email}</FieldError>}
                </Field>
            </FieldGroup>

            {error && <FieldError>{error}</FieldError>}

            <Button
                type="submit"
                disabled={pending}
                className="h-10 w-full justify-between px-3.5 font-medium"
            >
                <span>{pending ? 'Mengirim OTP…' : 'Kirim Kode OTP'}</span>
                {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                ) : (
                    <ArrowRight className="size-4" strokeWidth={1.5} />
                )}
            </Button>
        </form>
    );
}
