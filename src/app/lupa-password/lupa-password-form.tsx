'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
    ShieldCheck,
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
import {
    requestResetSchema,
    resetPasswordSchema,
    type ResetPasswordInput,
} from '@/lib/auth-schemas';
import {
    sendResetPasswordOtpAction,
    verifyAndResetPasswordAction,
} from './actions';
import {
    AuthCardFooter,
    AuthErrorAlert,
    AuthSteps,
    OtpCodeInput,
    PasswordRequirements,
} from '@/components/auth/auth-ui';

const STEPS = ['Email Akun', 'Kode OTP & Sandi', 'Selesai'];

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

    // Step 1: Send OTP to email
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
            const res = await sendResetPasswordOtpAction(email);
            if (!res.ok) {
                setError(res.error || 'Gagal mengirim kode verifikasi OTP.');
                return;
            }

            toast.success(`Kode OTP 6-digit dikirim ke ${email}`);
            setStep('RESET');
            setResendTimer(60);
        } catch (err: unknown) {
            console.error('sendResetPasswordOtpAction exception:', err);
            setError('Terjadi kendala jaringan saat menghubungi server.');
        } finally {
            setPending(false);
        }
    };

    // Resend OTP
    const handleResendOtp = async () => {
        if (resendTimer > 0 || pending) return;
        setError(null);
        setPending(true);

        try {
            const res = await sendResetPasswordOtpAction(email);
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

    // Step 2: Verify OTP and update password
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        if (password !== confirm) {
            setFieldErrors({ confirm: 'Konfirmasi kata sandi tidak cocok' });
            return;
        }

        const payload: ResetPasswordInput = {
            email: email.trim(),
            otp: otp.trim(),
            password,
            confirm,
        };

        const parsed = resetPasswordSchema.safeParse(payload);
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
            const res = await verifyAndResetPasswordAction(payload);
            if (!res.ok) {
                setError(res.error || 'Gagal memperbarui kata sandi.');
                if (res.fieldErrors) setFieldErrors(res.fieldErrors);
                return;
            }

            toast.success('Kata sandi berhasil diperbarui.');
            setStep('SUCCESS');
        } catch (err: unknown) {
            console.error('verifyAndResetPasswordAction exception:', err);
            setError('Terjadi kendala jaringan saat mengatur ulang kata sandi.');
        } finally {
            setPending(false);
        }
    };

    const currentStepIndex = step === 'EMAIL' ? 0 : step === 'RESET' ? 1 : 2;

    if (step === 'SUCCESS') {
        return (
            <div className="space-y-5 py-2 text-center">
                <AuthSteps steps={STEPS} currentIndex={2} />

                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-[var(--positive)]/30 bg-[var(--pill-positive-bg)] text-[var(--positive)] shadow-xs">
                    <CheckCircle2 className="size-8" />
                </div>

                <div className="space-y-1.5">
                    <h3 className="text-[19px] font-semibold text-foreground">
                        Kata Sandi Berhasil Diperbarui
                    </h3>
                    <p className="mx-auto max-w-[34ch] text-[13px] leading-relaxed text-muted-foreground">
                        Kata sandi akun Anda telah diperbarui dengan aman. Sesi login lama telah ditutup
                        secara otomatis demi keamanan.
                    </p>
                </div>

                <Button
                    onClick={() => router.push('/masuk')}
                    className="h-10 w-full rounded-xl bg-[var(--accent)] font-semibold text-[var(--accent-ink)] hover:opacity-95"
                >
                    Masuk dengan Sandi Baru
                </Button>
            </div>
        );
    }

    if (step === 'RESET') {
        return (
            <form onSubmit={handleResetPassword} className="space-y-4">
                <AuthSteps steps={STEPS} currentIndex={1} />
                <AuthErrorAlert message={error} />

                <div className="rounded-xl border border-[var(--border)] bg-[var(--raised)]/60 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
                    Kode verifikasi 6 digit dikirim ke{' '}
                    <strong className="font-semibold text-foreground">{email}</strong>
                </div>

                <FieldGroup className="space-y-3.5">
                    <Field className="space-y-1.5">
                        <FieldLabel htmlFor="reset-otp" className="text-[12.5px] font-medium text-foreground">
                            Kode OTP 6 Digit
                        </FieldLabel>
                        <OtpCodeInput
                            id="reset-otp"
                            value={otp}
                            onChange={setOtp}
                            disabled={pending}
                            invalid={Boolean(fieldErrors.otp)}
                        />
                        {fieldErrors.otp && (
                            <FieldError className="text-[11.5px]">{fieldErrors.otp}</FieldError>
                        )}
                        <p className="text-center text-[11.5px] text-muted-foreground">
                            Masa berlaku 10 menit. Sisa percobaan terbatas.
                        </p>
                    </Field>

                    <Field className="space-y-1">
                        <FieldLabel htmlFor="new-password" className="text-[12.5px] font-medium text-foreground">
                            Kata Sandi Baru
                        </FieldLabel>
                        <div className="relative">
                            <Input
                                id="new-password"
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
                        <FieldLabel htmlFor="confirm-password" className="text-[12.5px] font-medium text-foreground">
                            Konfirmasi Kata Sandi Baru
                        </FieldLabel>
                        <div className="relative">
                            <Input
                                id="confirm-password"
                                type={showConfirm ? 'text' : 'password'}
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                placeholder="Ulangi kata sandi baru"
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

                <div className="space-y-2 pt-1">
                    <Button
                        type="submit"
                        disabled={pending || otp.length !== 6}
                        className="h-10 w-full rounded-xl bg-[var(--accent)] font-semibold text-[var(--accent-ink)] hover:opacity-95"
                    >
                        {pending ? (
                            <span className="inline-flex items-center gap-2">
                                <Loader2 className="size-4 animate-spin" />
                                <span>Menyimpan Sandi...</span>
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-2">
                                <span>Simpan Kata Sandi Baru</span>
                                <ArrowRight className="size-4" />
                            </span>
                        )}
                    </Button>

                    <div className="flex items-center justify-between text-[12.5px]">
                        <button
                            type="button"
                            onClick={() => {
                                setStep('EMAIL');
                                setError(null);
                            }}
                            disabled={pending}
                            className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="size-3.5" />
                            <span>Ganti Email</span>
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

            <FieldGroup className="space-y-3.5">
                <Field className="space-y-1.5">
                    <FieldLabel htmlFor="reset-email" className="text-[13px] font-medium text-foreground">
                        Alamat Email Dinas / Instansi
                    </FieldLabel>
                    <div className="relative">
                        <Input
                            id="reset-email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="nama@puskesmas.go.id"
                            autoFocus
                            disabled={pending}
                            aria-invalid={Boolean(fieldErrors.email)}
                            className="h-10 bg-[var(--ground)] pr-10 text-[13.5px]"
                        />
                        <Mail className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground/60" />
                    </div>
                    {fieldErrors.email && (
                        <FieldError className="text-[12px]">{fieldErrors.email}</FieldError>
                    )}
                </Field>
            </FieldGroup>

            <Button
                type="submit"
                disabled={pending}
                className="mt-2 h-10 w-full rounded-xl bg-[var(--accent)] text-[13.5px] font-semibold text-[var(--accent-ink)] hover:opacity-95"
            >
                {pending ? (
                    <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        <span>Mengirim Kode OTP...</span>
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-2">
                        <span>Kirim Kode OTP Verifikasi</span>
                        <ArrowRight className="size-4" />
                    </span>
                )}
            </Button>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--raised)]/50 p-3 text-[12px] leading-relaxed text-muted-foreground">
                <div className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                    <span>
                        Kode OTP 6-digit dikirimkan melalui server SMTP terenkripsi. Demi keamanan,
                        sistem tidak akan mengungkap apakah alamat email terdaftar atau tidak.
                    </span>
                </div>
            </div>

            <AuthCardFooter>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Sudah ingat kata sandi Anda?</span>
                    <Link
                        href="/masuk"
                        className="font-semibold text-[var(--accent)] hover:underline"
                    >
                        Masuk sekarang
                    </Link>
                </div>
            </AuthCardFooter>
        </form>
    );
}
