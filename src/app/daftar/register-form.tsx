'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';

/**
 * Requesting an account is only a request: the server leaves it PENDING and
 * carries no session, so this form never navigates anywhere on success. It
 * says what happened and how long it tends to take, which is the only useful
 * thing to tell someone who cannot yet do anything.
 */
export function RegisterForm() {
    const router = useRouter();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const password = String(data.get('password') ?? '');
        const confirm = String(data.get('confirm') ?? '');

        if (password !== confirm) {
            setError('Password dan konfirmasi tidak sama.');
            return;
        }

        setPending(true);
        setError(null);

        const response = await fetch('/api/auth/sign-up/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: data.get('name'),
                email: data.get('email'),
                password,
            }),
        });

        setPending(false);

        if (!response.ok) {
            const body = await response.json().catch(() => null);
            setError(
                body?.message ??
                    'Pendaftaran gagal. Periksa data lalu coba lagi.',
            );
            return;
        }

        setDone(true);
        toast('Pendaftaran diterima. Akun menunggu persetujuan.');
    }

    if (done) {
        return (
            <div className="rounded-[var(--radius-card)] border border-border bg-[var(--surface)] p-4">
                <p className="text-[14px] font-medium">
                    Pendaftaran diterima
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                    Administrator Dinas Kesehatan akan meninjau akun Anda.
                    Anda belum bisa masuk sampai akun disetujui.
                </p>
                <Button
                    type="button"
                    onClick={() => router.push('/masuk')}
                    className="mt-4 h-10 justify-between px-3.5"
                >
                    <span>Kembali ke halaman masuk</span>
                    <ArrowRight className="size-4" strokeWidth={1.5} />
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={onSubmit} noValidate>
            <FieldGroup className="gap-4">
                <Field data-invalid={error ? true : undefined}>
                    <FieldLabel htmlFor="name" className="text-[13px]">
                        Nama lengkap
                    </FieldLabel>
                    <Input
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        required
                        aria-invalid={error ? true : undefined}
                        className="h-10"
                    />
                </Field>
                <Field data-invalid={error ? true : undefined}>
                    <FieldLabel htmlFor="email" className="text-[13px]">
                        Email
                    </FieldLabel>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
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
                        autoComplete="new-password"
                        minLength={10}
                        required
                        aria-invalid={error ? true : undefined}
                        className="h-10"
                    />
                    <FieldDescription className="text-[12px]">
                        Minimal 10 karakter.
                    </FieldDescription>
                </Field>
                <Field data-invalid={error ? true : undefined}>
                    <FieldLabel htmlFor="confirm" className="text-[13px]">
                        Ulangi password
                    </FieldLabel>
                    <Input
                        id="confirm"
                        name="confirm"
                        type="password"
                        autoComplete="new-password"
                        minLength={10}
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
                            <span>Mengirim</span>
                            <Loader2 className="size-4 animate-spin" />
                        </>
                    ) : (
                        <>
                            <span>Ajukan akun</span>
                            <ArrowRight className="size-4" strokeWidth={1.5} />
                        </>
                    )}
                </Button>
            </FieldGroup>
        </form>
    );
}
