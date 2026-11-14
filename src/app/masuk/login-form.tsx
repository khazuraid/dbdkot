'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';

const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .min(1, 'Email wajib diisi')
        .email('Format email tidak valid (contoh: nama@dinkes.go.id)'),
    password: z.string().min(1, 'Password wajib diisi'),
});

/**
 * The sign-in form. It calls better-auth's client rather than posting the HTML
 * form to `/api/auth/sign-in/email`: that endpoint answers in JSON and sets the
 * session cookie itself, so a plain form POST made the browser download the
 * response instead of signing in.
 *
 * The refusal for a pending or disabled account comes back as `FORBIDDEN`
 * from `databaseHooks.session.create.before`. A raw API response would have
 * shown a JSON blob; here it becomes the sentence that tells the person what
 * to do. Password and unknown-address failures deliberately read the same.
 */
export function LoginForm() {
    const router = useRouter();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setFieldErrors({});

        const data = new FormData(event.currentTarget);
        const email = String(data.get('email') ?? '').trim();
        const password = String(data.get('password') ?? '');

        const parsed = loginSchema.safeParse({ email, password });
        if (!parsed.success) {
            const errs: { email?: string; password?: string } = {};
            for (const issue of parsed.error.issues) {
                if (issue.path[0] === 'email') errs.email = issue.message;
                if (issue.path[0] === 'password') errs.password = issue.message;
            }
            setFieldErrors(errs);
            return;
        }

        setPending(true);

        const { error: failure } = await authClient.signIn.email({
            email: parsed.data.email,
            password: parsed.data.password,
        });

        if (failure) {
            setPending(false);
            setError(
                failure.code === 'FORBIDDEN'
                    ? (failure.message ??
                          'Akun belum disetujui administrator atau sedang dinonaktifkan.')
                    : 'Email atau password salah.',
            );
            return;
        }

        // Keep the button disabled: the session exists, the redirect is next.
        router.replace('/dasbor');
        router.refresh();
    }

    return (
        <form onSubmit={onSubmit} noValidate>
            <FieldGroup className="gap-4">
                <Field data-invalid={Boolean(fieldErrors.email || error)}>
                    <FieldLabel htmlFor="email" className="text-[13px]">
                        Email
                    </FieldLabel>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="username"
                        required
                        autoFocus
                        placeholder="nama@instansi.go.id"
                        aria-invalid={Boolean(fieldErrors.email || error)}
                        className="h-10"
                    />
                    {fieldErrors.email && (
                        <FieldError>{fieldErrors.email}</FieldError>
                    )}
                </Field>

                <Field data-invalid={Boolean(fieldErrors.password || error)}>
                    <FieldLabel htmlFor="password" className="text-[13px]">
                        Password
                    </FieldLabel>
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        aria-invalid={Boolean(fieldErrors.password || error)}
                        className="h-10"
                    />
                    {fieldErrors.password && (
                        <FieldError>{fieldErrors.password}</FieldError>
                    )}
                </Field>

                {error && <FieldError>{error}</FieldError>}

                <Button
                    type="submit"
                    disabled={pending}
                    className="h-10 w-full justify-between px-3.5"
                >
                    {pending ? (
                        <>
                            <span>Memeriksa</span>
                            <Loader2 className="size-4 animate-spin" />
                        </>
                    ) : (
                        <>
                            <span>Masuk</span>
                            <ArrowRight className="size-4" strokeWidth={1.5} />
                        </>
                    )}
                </Button>
            </FieldGroup>
        </form>
    );
}
