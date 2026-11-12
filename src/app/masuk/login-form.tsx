'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';

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

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const email = String(data.get('email') ?? '').trim();
        const password = String(data.get('password') ?? '');

        setPending(true);
        setError(null);

        const { error: failure } = await authClient.signIn.email({
            email,
            password,
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
                <Field data-invalid={error ? true : undefined}>
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
                        aria-invalid={error ? true : undefined}
                        className="h-10"
                    />
                </Field>

                <Field data-invalid={error ? true : undefined}>
                    <FieldLabel htmlFor="password" className="text-[13px]">
                        Password
                    </FieldLabel>
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        aria-invalid={error ? true : undefined}
                        className="h-10"
                    />
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
