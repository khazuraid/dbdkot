'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

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
            <div className="mt-8 rounded-[var(--radius-card)] border border-border bg-[var(--surface)] p-4">
                <p className="text-[14px] font-medium">
                    Pendaftaran diterima
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                    Administrator Dinas Kesehatan akan meninjau akun Anda.
                    Anda belum bisa masuk sampai akun disetujui.
                </p>
                <button
                    type="button"
                    onClick={() => router.push('/masuk')}
                    className="mt-4 h-9 rounded-[var(--radius-control)] bg-primary px-3 text-[14px] font-medium text-primary-foreground"
                >
                    Kembali ke halaman masuk
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            <Field
                id="name"
                label="Nama lengkap"
                type="text"
                autoComplete="name"
                required
            />
            <Field
                id="email"
                label="Email"
                type="email"
                autoComplete="email"
                required
            />
            <Field
                id="password"
                label="Password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                hint="Minimal 10 karakter."
                required
            />
            <Field
                id="confirm"
                label="Ulangi password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
            />

            {error && (
                <p role="alert" className="text-[13px] text-[var(--negative)]">
                    {error}
                </p>
            )}

            <button
                type="submit"
                disabled={pending}
                className="h-9 w-full rounded-[var(--radius-control)] bg-primary text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
                {pending ? 'Mengirim…' : 'Ajukan akun'}
            </button>
        </form>
    );
}

function Field({
    id,
    label,
    hint,
    ...props
}: {
    id: string;
    label: string;
    hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="text-[13px] font-medium">
                {label}
            </label>
            <input
                id={id}
                name={id}
                className="h-9 w-full rounded-[var(--radius-control)] border border-input bg-card px-3 text-[14px] outline-none focus-visible:border-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--text)]/15"
                {...props}
            />
            {hint && (
                <p className="text-[12px] text-muted-foreground">{hint}</p>
            )}
        </div>
    );
}
