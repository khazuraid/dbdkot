'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ROLES, type Role } from '@/lib/roles';
import { ROLE_LABEL } from '@/lib/nav';
import { createAccountAction, type ActionState } from '../actions';

const initial: ActionState = { ok: false };

type Institution = { id: string; name: string; type: string };

function institutionKind(role: Role) {
    if (role === 'PUSKESMAS') return 'PUSKESMAS';
    if (role === 'RUMAH_SAKIT') return 'RUMAH_SAKIT';
    return null;
}

/**
 * An account made here is approved from the start — this is the form an
 * administrator uses instead of waiting for a stranger to apply. Only the
 * password is generated here; nothing is prefilled with a guessable default.
 */
export function CreateAccountForm({
    institutions,
}: {
    institutions: Institution[];
}) {
    const router = useRouter();
    const [role, setRole] = useState<Role>('PUSKESMAS');
    const [state, action, pending] = useActionState(createAccountAction, initial);

    useEffect(() => {
        if (state.ok) {
            toast(state.message ?? 'Akun dibuat.');
            router.push('/admin/pengguna');
        }
    }, [state, router]);

    const kind = institutionKind(role);
    const options = kind ? institutions.filter((i) => i.type === kind) : [];

    return (
        <form action={action} className="mt-8 max-w-[560px] space-y-4">
            <Field
                id="name"
                label="Nama lengkap"
                autoComplete="off"
                required
                minLength={3}
            />
            <Field
                id="email"
                label="Email"
                type="email"
                autoComplete="off"
                required
                hint="Dipakai untuk masuk; harus unik."
            />

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <label htmlFor="role" className="text-[13px] font-medium">
                        Peran
                    </label>
                    <select
                        id="role"
                        name="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value as Role)}
                        className="h-9 w-full rounded-[var(--radius-control)] border border-input bg-card px-2 text-[14px]"
                    >
                        {ROLES.map((r) => (
                            <option key={r} value={r}>
                                {ROLE_LABEL[r]}
                            </option>
                        ))}
                    </select>
                </div>

                {kind && (
                    <div className="space-y-1.5">
                        <label
                            htmlFor="institutionId"
                            className="text-[13px] font-medium"
                        >
                            Institusi
                        </label>
                        <select
                            id="institutionId"
                            name="institutionId"
                            required
                            defaultValue=""
                            className="h-9 w-full rounded-[var(--radius-control)] border border-input bg-card px-2 text-[14px]"
                        >
                            <option value="" disabled>
                                Pilih {kind === 'PUSKESMAS' ? 'puskesmas' : 'rumah sakit'}
                            </option>
                            {options.map((i) => (
                                <option key={i.id} value={i.id}>
                                    {i.name}
                                </option>
                            ))}
                        </select>
                        {options.length === 0 && (
                            <p className="text-[12px] text-[var(--warning)]">
                                Belum ada institusi jenis ini. Tambahkan lebih
                                dulu di menu Institusi.
                            </p>
                        )}
                    </div>
                )}
            </div>

            <Field
                id="password"
                label="Password awal"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                hint="Minimal 10 karakter. Sampaikan ke pengguna lewat saluran aman."
            />

            {state.error && (
                <p role="alert" className="text-[13px] text-[var(--negative)]">
                    {state.error}
                </p>
            )}

            <button
                type="submit"
                disabled={pending}
                className="h-9 rounded-[var(--radius-control)] bg-primary px-3 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
                {pending ? 'Membuat…' : 'Buat akun'}
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
