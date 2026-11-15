'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, Mail } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { loginSchema } from '@/lib/auth-schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { AuthCardFooter, AuthErrorAlert } from '@/components/auth/auth-ui';

export function LoginForm({ initialError }: { initialError?: string }) {
    const router = useRouter();
    const [pending, setPending] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(() => {
        if (initialError === 'disabled') {
            return 'Akun ini telah dinonaktifkan oleh Administrator. Hubungi Dinas Kesehatan Kota Cirebon.';
        }
        return null;
    });
    const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setFieldErrors({});

        const data = new FormData(event.currentTarget);
        const email = String(data.get('email') || '').trim();
        const password = String(data.get('password') || '');

        const parsed = loginSchema.safeParse({ email, password });
        if (!parsed.success) {
            const nextErrors: { email?: string; password?: string } = {};
            for (const issue of parsed.error.issues) {
                const key = issue.path[0] as 'email' | 'password';
                if (!nextErrors[key]) nextErrors[key] = issue.message;
            }
            setFieldErrors(nextErrors);
            return;
        }

        setPending(true);
        try {
            const res = await authClient.signIn.email({
                email: parsed.data.email,
                password: parsed.data.password,
            });

            if (res.error) {
                const status = res.error.status;
                const code = (res.error as { code?: string }).code;

                if (status === 403 || code === 'FORBIDDEN') {
                    setError(
                        'Akun belum dapat digunakan (menunggu verifikasi admin atau dinonaktifkan). Hubungi Dinas Kesehatan Kota Cirebon.',
                    );
                } else if (status === 429 || code === 'TOO_MANY_REQUESTS') {
                    setError(
                        res.error.message ||
                            'Terlalu banyak percobaan masuk yang gagal. Silakan tunggu 15 menit atau atur ulang kata sandi.',
                    );
                } else {
                    setError(
                        res.error.message ||
                            'Kombinasi email atau kata sandi tidak cocok. Silakan periksa kembali.',
                    );
                }
                setPending(false);
                return;
            }

            router.push('/dasbor');
            router.refresh();
        } catch (err: unknown) {
            console.error('Sign-in unexpected exception:', err);
            setError('Terjadi kendala jaringan saat menghubungi server autentikasi.');
            setPending(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <AuthErrorAlert message={error} />

            <FieldGroup className="space-y-3.5">
                <Field className="space-y-1.5">
                    <FieldLabel htmlFor="email" className="text-[13px] font-medium text-foreground">
                        Alamat Email Dinas / Instansi
                    </FieldLabel>
                    <div className="relative">
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="username"
                            autoFocus
                            placeholder="nama@puskesmas.go.id"
                            disabled={pending}
                            aria-invalid={Boolean(fieldErrors.email)}
                            className="h-10 bg-[var(--ground)] pr-10 text-[13.5px]"
                        />
                        <Mail className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground/60" />
                    </div>
                    {fieldErrors.email && <FieldError className="text-[12px]">{fieldErrors.email}</FieldError>}
                </Field>

                <Field className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <FieldLabel
                            htmlFor="password"
                            className="text-[13px] font-medium text-foreground"
                        >
                            Kata Sandi
                        </FieldLabel>
                        <Link
                            href="/lupa-password"
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline"
                        >
                            <KeyRound className="size-3" />
                            <span>Lupa sandi?</span>
                        </Link>
                    </div>
                    <div className="relative">
                        <Input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            placeholder="••••••••"
                            disabled={pending}
                            aria-invalid={Boolean(fieldErrors.password)}
                            className="h-10 bg-[var(--ground)] pr-10 text-[13.5px]"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            disabled={pending}
                            aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-hidden"
                        >
                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                    </div>
                    {fieldErrors.password && (
                        <FieldError className="text-[12px]">{fieldErrors.password}</FieldError>
                    )}
                </Field>
            </FieldGroup>

            <Button
                type="submit"
                disabled={pending}
                className="mt-2 h-10 w-full rounded-xl bg-[var(--accent)] text-[13.5px] font-semibold text-[var(--accent-ink)] transition-opacity hover:opacity-95"
            >
                {pending ? (
                    <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        <span>Memverifikasi...</span>
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-2">
                        <span>Masuk ke Ruang Kerja</span>
                        <ArrowRight className="size-4" />
                    </span>
                )}
            </Button>

            <AuthCardFooter>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Instansi belum terdaftar di WALI-EPI?</span>
                    <Link
                        href="/daftar"
                        className="font-semibold text-[var(--accent)] hover:underline"
                    >
                        Ajukan akun baru
                    </Link>
                </div>
            </AuthCardFooter>
        </form>
    );
}
