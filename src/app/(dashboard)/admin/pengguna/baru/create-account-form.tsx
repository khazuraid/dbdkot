'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, RefreshCw, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { ROLES, type Role } from '@/lib/roles';
import { ROLE_LABEL } from '@/lib/nav';
import { Panel } from '@/components/shell/page';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createAccountAction, type ActionState } from '../actions';

const initial: ActionState = { ok: false };

const SELECT_CONTROL =
    'h-9 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[13.5px] text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/15';

type Institution = { id: string; name: string; type: string };

function institutionKind(role: Role) {
    if (role === 'PUSKESMAS') return 'PUSKESMAS';
    if (role === 'RUMAH_SAKIT') return 'RUMAH_SAKIT';
    return null;
}

function generatePassword(length = 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function useCreateAccountForm(onSuccess: () => void) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<Role>('PUSKESMAS');
    const [institutionId, setInstitutionId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [state, action, pending] = useActionState(
        createAccountAction,
        initial,
    );

    useEffect(() => {
        if (state.ok) {
            toast.success(state.message ?? 'Akun dibuat.');
            onSuccess();
        }
    }, [state, onSuccess]);

    return {
        name,
        setName,
        email,
        setEmail,
        role,
        setRole: (next: Role) => {
            setRole(next);
            setInstitutionId('');
        },
        institutionId,
        setInstitutionId,
        password,
        setPassword,
        showPassword,
        setShowPassword,
        state,
        action,
        pending,
    };
}

function CreateAccountFields({
    institutions,
    form,
    idPrefix = '',
}: {
    institutions: Institution[];
    form: ReturnType<typeof useCreateAccountForm>;
    idPrefix?: string;
}) {
    const kind = institutionKind(form.role);
    const options = kind ? institutions.filter((i) => i.type === kind) : [];
    const fieldId = (field: string) => `${idPrefix}${field}`;

    return (
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <Field
                    id={fieldId('name')}
                    name="name"
                    label="Nama lengkap"
                    placeholder="dr. Siti Rahayu"
                    value={form.name}
                    onChange={(e) => form.setName(e.target.value)}
                    autoComplete="off"
                    required
                    minLength={3}
                />
                <Field
                    id={fieldId('email')}
                    name="email"
                    label="Email"
                    type="email"
                    placeholder="nama@instansi.go.id"
                    value={form.email}
                    onChange={(e) => form.setEmail(e.target.value)}
                    autoComplete="off"
                    required
                    hint="Dipakai untuk masuk; harus unik."
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label
                        htmlFor={fieldId('role')}
                        className="text-[13px] font-medium"
                    >
                        Peran
                    </Label>
                    <select
                        id={fieldId('role')}
                        name="role"
                        value={form.role}
                        onChange={(e) => form.setRole(e.target.value as Role)}
                        className={SELECT_CONTROL}
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
                        <Label
                            htmlFor={fieldId('institutionId')}
                            className="text-[13px] font-medium"
                        >
                            Institusi
                        </Label>
                        <select
                            id={fieldId('institutionId')}
                            name="institutionId"
                            required
                            value={form.institutionId}
                            onChange={(e) =>
                                form.setInstitutionId(e.target.value)
                            }
                            className={SELECT_CONTROL}
                        >
                            <option value="" disabled>
                                Pilih{' '}
                                {kind === 'PUSKESMAS'
                                    ? 'puskesmas'
                                    : 'rumah sakit'}
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

            <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                    <Label
                        htmlFor={fieldId('password')}
                        className="text-[13px] font-medium"
                    >
                        Password awal
                    </Label>
                    <button
                        type="button"
                        onClick={() => {
                            form.setPassword(generatePassword());
                            form.setShowPassword(true);
                        }}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline"
                    >
                        <RefreshCw className="size-3" aria-hidden /> Acak
                        password
                    </button>
                </div>
                <div className="relative">
                    <Input
                        id={fieldId('password')}
                        name="password"
                        type={form.showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => form.setPassword(e.target.value)}
                        autoComplete="new-password"
                        minLength={10}
                        required
                        className="pr-10 font-mono"
                    />
                    <button
                        type="button"
                        onClick={() => form.setShowPassword((v) => !v)}
                        aria-label={
                            form.showPassword
                                ? 'Sembunyikan password'
                                : 'Tampilkan password'
                        }
                        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                        {form.showPassword ? (
                            <EyeOff className="size-4" aria-hidden />
                        ) : (
                            <Eye className="size-4" aria-hidden />
                        )}
                    </button>
                </div>
                <p className="text-[12px] text-faint">
                    Minimal 10 karakter. Sampaikan ke pengguna lewat saluran
                    aman.
                </p>
            </div>

            {form.state.error && (
                <p
                    role="alert"
                    className="rounded-[var(--radius-control)] border border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] px-3 py-2 text-[12.5px] text-[var(--pill-negative-ink)]"
                >
                    {form.state.error}
                </p>
            )}
        </div>
    );
}

/**
 * Full-width page variant at /admin/pengguna/baru.
 */
export function CreateAccountForm({
    institutions,
}: {
    institutions: Institution[];
}) {
    const router = useRouter();
    const form = useCreateAccountForm(() => router.push('/admin/pengguna'));

    return (
        <Panel
            title="Informasi akun"
            subtitle="Akun dibuat langsung aktif dengan akses sesuai peran yang dipilih."
            padded
        >
            <form action={form.action} className="space-y-5">
                <CreateAccountFields
                    institutions={institutions}
                    form={form}
                />

                <div className="flex flex-wrap items-center gap-2 border-t border-[var(--rule)] pt-4">
                    <Button type="submit" disabled={form.pending}>
                        {form.pending ? 'Membuat…' : 'Buat akun'}
                    </Button>
                    <Button asChild variant="ghost">
                        <Link href="/admin/pengguna">Batal</Link>
                    </Button>
                </div>
            </form>
        </Panel>
    );
}

/**
 * Pop-up dialog variant rendered directly on /admin/pengguna?tambah=1.
 */
export function CreateAccountDialog({
    open,
    closeHref,
    institutions,
}: {
    open: boolean;
    closeHref: string;
    institutions: Institution[];
}) {
    const router = useRouter();
    const close = () => router.push(closeHref, { scroll: false });

    return (
        <Dialog open={open} onOpenChange={(next) => !next && close()}>
            {open && (
                <CreateAccountDialogBody
                    close={close}
                    onCreated={() => {
                        router.push(closeHref, { scroll: false });
                        router.refresh();
                    }}
                    institutions={institutions}
                />
            )}
        </Dialog>
    );
}

function CreateAccountDialogBody({
    close,
    onCreated,
    institutions,
}: {
    close: () => void;
    onCreated: () => void;
    institutions: Institution[];
}) {
    const form = useCreateAccountForm(onCreated);

    return (
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[600px]">
            <DialogHeader className="border-b border-[var(--rule)] px-5 pt-5 pb-3.5">
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
                        <UserPlus className="size-3" aria-hidden /> Akun baru
                    </span>
                </div>
                <DialogTitle className="mt-1 text-[17px]">
                    Tambah akun pengguna
                </DialogTitle>
                <DialogDescription className="text-[12.5px]">
                    Akun dibuat langsung aktif dengan akses sesuai peran yang
                    dipilih.
                </DialogDescription>
            </DialogHeader>

            <form action={form.action}>
                <div className="max-h-[min(66dvh,540px)] overflow-y-auto px-5 py-4">
                    <CreateAccountFields
                        institutions={institutions}
                        form={form}
                        idPrefix="dlg-"
                    />
                </div>

                <DialogFooter className="mx-0 mb-0 rounded-none">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={close}
                        disabled={form.pending}
                    >
                        Batal
                    </Button>
                    <Button type="submit" disabled={form.pending}>
                        {form.pending ? 'Membuat…' : 'Buat akun'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
}

function Field({
    id,
    name,
    label,
    hint,
    ...props
}: {
    id: string;
    name: string;
    label: string;
    hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id} className="text-[13px] font-medium">
                {label}
            </Label>
            <Input id={id} name={name} {...props} />
            {hint && <p className="text-[12px] text-faint">{hint}</p>}
        </div>
    );
}
