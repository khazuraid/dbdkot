'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    Building2,
    Check,
    CheckCircle2,
    ChevronDown,
    Clock,
    Eye,
    EyeOff,
    Info,
    KeyRound,
    PencilIcon,
    Power,
    PowerOff,
    RefreshCw,
    SlidersHorizontal,
    Trash2,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ROLES, type Role } from '@/lib/roles';
import { ROLE_LABEL } from '@/lib/nav';
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
import {
    approveAccountAction,
    deleteAccountAction,
    rejectAccountAction,
    setAccountActiveAction,
    updateAccountAction,
    type ActionState,
} from './actions';

const initial: ActionState = { ok: false };

type Institution = { id: string; name: string; type: string };

/**
 * Institution is not a free choice: a PUSKESMAS or RUMAH_SAKIT account without
 * one would read every tenant, so the options are filtered to the type the
 * chosen role implies and the server re-checks. ADMIN and DINKES have no
 * institution, so the field disappears rather than sitting disabled.
 */
function institutionKind(role: Role) {
    if (role === 'PUSKESMAS') return 'PUSKESMAS';
    if (role === 'RUMAH_SAKIT') return 'RUMAH_SAKIT';
    return null;
}

function useNotified(state: ActionState) {
    useEffect(() => {
        if (state.message) toast.success(state.message);
        else if (state.error) toast.error(state.error);
    }, [state]);
}

const SELECT_CONTROL =
    'h-[var(--control-height)] w-full appearance-none rounded-[var(--radius-control)] border border-[var(--control)] bg-[var(--surface)] px-3 pr-9 text-[13.5px] text-foreground outline-none transition-colors focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/25 disabled:pointer-events-none disabled:bg-[var(--raised)] disabled:opacity-60';

function initialsOf(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function ApprovalRow({
    userId,
    name,
    email,
    role,
    emailVerified,
    institutionId,
    institutionName,
    createdAt,
    institutions,
}: {
    userId: string;
    name: string;
    email: string;
    role: Role;
    emailVerified?: boolean;
    institutionId?: string | null;
    institutionName?: string | null;
    createdAt?: Date | null;
    institutions: Institution[];
}) {
    const router = useRouter();
    const [editRole, setEditRole] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role>(role || 'PUSKESMAS');
    const [selectedInstitutionId, setSelectedInstitutionId] = useState(
        institutionId ?? '',
    );
    const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);

    const [state, action, pending] = useActionState(
        approveAccountAction,
        initial,
    );
    const [rejectState, reject, rejecting] = useActionState(
        rejectAccountAction,
        initial,
    );

    useNotified(state);
    useNotified(rejectState);

    useEffect(() => {
        if (state.ok || rejectState.ok) {
            router.refresh();
        }
    }, [state.ok, rejectState.ok, router]);

    const kind = institutionKind(selectedRole);
    const options = kind
        ? institutions.filter((i) => i.type === kind)
        : institutions;

    return (
        <li className="px-4 py-3.5 transition-colors hover:bg-[var(--raised)]/45">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <span
                        aria-hidden
                        className="grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] text-[12px] font-semibold text-[var(--pill-warning-ink)]"
                    >
                        {initialsOf(name)}
                    </span>
                    <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-[13.5px] font-semibold text-foreground">
                                {name}
                            </p>
                            {emailVerified ? (
                                <span className="inline-flex items-center gap-1 rounded-md border border-[var(--pill-positive-border)] bg-[var(--pill-positive-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--pill-positive-ink)]">
                                    <CheckCircle2 className="size-3 shrink-0" aria-hidden />
                                    Email Terverif (OTP)
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 rounded-md border border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--pill-warning-ink)]">
                                    <Clock className="size-3 shrink-0" aria-hidden />
                                    Belum Verif OTP
                                </span>
                            )}
                        </div>
                        <p
                            className="truncate font-mono text-[12px] text-muted-foreground"
                            title={email}
                        >
                            {email}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11.5px]">
                            <span className="inline-flex items-center rounded-md border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-2 py-0.5 font-medium text-[var(--accent)]">
                                {ROLE_LABEL[role] ?? role}
                            </span>
                            {institutionName && (
                                <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--ground)] px-2 py-0.5 text-muted-foreground">
                                    <Building2 className="size-3 shrink-0" aria-hidden />
                                    <span className="truncate max-w-[240px]">{institutionName}</span>
                                </span>
                            )}
                            {createdAt && (
                                <span className="text-muted-foreground/80 tabular-nums">
                                    • Daftar{' '}
                                    {new Date(createdAt).toLocaleDateString('id-ID', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                    })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditRole((v) => !v)}
                        aria-expanded={editRole}
                        className="h-8 gap-1.5 px-2.5 text-[12px] text-muted-foreground hover:text-foreground"
                        title="Sesuaikan peran atau institusi bila perlu"
                    >
                        <SlidersHorizontal className="size-3.5" aria-hidden />
                        <span className="hidden sm:inline">
                            {editRole ? 'Tutup' : 'Sesuaikan'}
                        </span>
                    </Button>

                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={rejecting || pending}
                        onClick={() => setRejectConfirmOpen(true)}
                        className="h-8 gap-1.5 border-[var(--border)] text-[12.5px] text-muted-foreground hover:border-[var(--pill-negative-border)] hover:bg-[var(--pill-negative-bg)] hover:text-[var(--negative)]"
                    >
                        <X className="size-3.5" aria-hidden />
                        <span>Tolak</span>
                    </Button>

                    <form action={action}>
                        <input type="hidden" name="userId" value={userId} />
                        {editRole && (
                            <>
                                <input type="hidden" name="role" value={selectedRole} />
                                {kind && (
                                    <input
                                        type="hidden"
                                        name="institutionId"
                                        value={selectedInstitutionId}
                                    />
                                )}
                            </>
                        )}
                        <Button
                            type="submit"
                            size="sm"
                            disabled={pending || rejecting}
                            className="h-8 gap-1.5 bg-[var(--accent)] px-3.5 text-[12.5px] font-semibold text-[var(--accent-ink)] hover:opacity-95"
                        >
                            {pending ? (
                                <RefreshCw className="size-3.5 animate-spin" aria-hidden />
                            ) : (
                                <Check className="size-3.5" aria-hidden />
                            )}
                            <span>{pending ? 'Menyetujui…' : 'Setujui'}</span>
                        </Button>
                    </form>
                </div>
            </div>

            {editRole && (
                <div className="mt-3 grid gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/55 p-3.5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label
                            htmlFor={`role-${userId}`}
                            className="text-[12px] font-medium text-muted-foreground"
                        >
                            Ubah Peran (Opsional)
                        </Label>
                        <div className="relative">
                            <select
                                id={`role-${userId}`}
                                value={selectedRole}
                                onChange={(e) => {
                                    const next = e.target.value as Role;
                                    setSelectedRole(next);
                                    const nextKind = institutionKind(next);
                                    const first = nextKind
                                        ? institutions.find((i) => i.type === nextKind)
                                        : null;
                                    setSelectedInstitutionId(first ? first.id : '');
                                }}
                                className={SELECT_CONTROL}
                            >
                                {ROLES.map((r) => (
                                    <option key={r} value={r}>
                                        {ROLE_LABEL[r]}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown
                                aria-hidden
                                className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                            />
                        </div>
                    </div>

                    {kind && (
                        <div className="space-y-1.5">
                            <Label
                                htmlFor={`inst-${userId}`}
                                className="text-[12px] font-medium text-muted-foreground"
                            >
                                Ubah Institusi / Faskes (Opsional)
                            </Label>
                            <div className="relative">
                                <select
                                    id={`inst-${userId}`}
                                    value={selectedInstitutionId}
                                    onChange={(e) =>
                                        setSelectedInstitutionId(e.target.value)
                                    }
                                    className={SELECT_CONTROL}
                                >
                                    <option value="">
                                        Gunakan faskes terdaftar
                                    </option>
                                    {options.map((i) => (
                                        <option key={i.id} value={i.id}>
                                            {i.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown
                                    aria-hidden
                                    className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                />
                            </div>
                        </div>
                    )}

                    {options.length === 0 && kind && (
                        <p className="text-[12px] text-[var(--warning)] sm:col-span-2">
                            Belum ada {kind === 'PUSKESMAS' ? 'puskesmas' : 'rumah sakit'} aktif.
                        </p>
                    )}
                </div>
            )}

            {(state.error || rejectState.error) && (
                <p role="alert" className="mt-2 text-[12px] text-[var(--negative)]">
                    {state.error || rejectState.error}
                </p>
            )}

            <Dialog
                open={rejectConfirmOpen && !rejectState.ok}
                onOpenChange={setRejectConfirmOpen}
            >
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>Tolak Pendaftaran Akun?</DialogTitle>
                        <DialogDescription>
                            Pendaftaran atas nama{' '}
                            <strong className="font-semibold text-foreground">{name}</strong> (
                            <span className="font-mono">{email}</span>) akan ditolak dan
                            tidak dapat masuk ke sistem.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setRejectConfirmOpen(false)}
                            disabled={rejecting}
                        >
                            Batal
                        </Button>
                        <form action={reject}>
                            <input type="hidden" name="userId" value={userId} />
                            <Button
                                type="submit"
                                variant="destructive"
                                disabled={rejecting}
                            >
                                {rejecting ? 'Menolak…' : 'Ya, Tolak Pendaftaran'}
                            </Button>
                        </form>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </li>
    );
}

export function AccountToggle({
    userId,
    isActive,
    status,
    self,
}: {
    userId: string;
    isActive: boolean;
    status: string;
    self: boolean;
}) {
    const router = useRouter();
    const [state, action, pending] = useActionState(
        setAccountActiveAction,
        initial,
    );
    useNotified(state);

    useEffect(() => {
        if (state.ok) router.refresh();
    }, [state.ok, router]);

    if (self) {
        return (
            <span className="inline-flex h-7 items-center rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--raised)] px-2.5 text-[11.5px] font-medium text-muted-foreground">
                Anda
            </span>
        );
    }

    if (status === 'PENDING') {
        return (
            <span className="inline-flex h-7 items-center text-[12px] text-[var(--warning)]">
                Tinjau di atas
            </span>
        );
    }

    // A rejected request is not re-enabled here; it is a new application.
    if (status === 'REJECTED') {
        return (
            <span className="inline-flex h-7 items-center text-[12px] text-muted-foreground">
                Ditolak
            </span>
        );
    }

    return (
        <form action={action} className="inline-flex justify-end">
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="isActive" value={String(!isActive)} />
            <Button
                type="submit"
                size="xs"
                variant={isActive ? 'outline' : 'default'}
                disabled={pending}
                className={
                    isActive
                        ? 'gap-1 hover:border-[var(--pill-negative-border)] hover:bg-[var(--pill-negative-bg)] hover:text-[var(--negative)]'
                        : 'gap-1'
                }
                title={
                    isActive
                        ? 'Nonaktifkan akses login pengguna ini'
                        : 'Aktifkan kembali akses login pengguna ini'
                }
            >
                {isActive ? (
                    <>
                        <PowerOff className="size-3" aria-hidden />
                        {pending ? 'Memproses…' : 'Nonaktifkan'}
                    </>
                ) : (
                    <>
                        <Power className="size-3" aria-hidden />
                        {pending ? 'Memproses…' : 'Aktifkan'}
                    </>
                )}
            </Button>
        </form>
    );
}

export function DeleteAccountButton({
    userId,
    userName,
    userEmail,
    self,
}: {
    userId: string;
    userName: string;
    userEmail: string;
    self: boolean;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    if (self) return null;

    async function handleDelete(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
            const formData = new FormData(e.currentTarget);
            const res = await deleteAccountAction(initial, formData);
            if (!res.ok) {
                const msg = res.error ?? 'Gagal menghapus pengguna.';
                setError(msg);
                toast.error(msg);
                return;
            }
            toast.success(res.message ?? 'Pengguna berhasil dihapus permanen.');
            setOpen(false);
            router.refresh();
        } catch {
            const msg = 'Terjadi kesalahan saat menghapus pengguna.';
            setError(msg);
            toast.error(msg);
        } finally {
            setPending(false);
        }
    }

    return (
        <>
            <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => {
                    setError(null);
                    setOpen(true);
                }}
                className="gap-1 hover:border-[var(--pill-negative-border)] hover:bg-[var(--pill-negative-bg)] hover:text-[var(--negative)]"
                title={`Hapus permanen akun ${userName}`}
                aria-label={`Hapus pengguna ${userName}`}
            >
                <Trash2 className="size-3" aria-hidden />
                Hapus
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[440px]">
                    <form onSubmit={handleDelete}>
                        <input type="hidden" name="userId" value={userId} />
                        <DialogHeader className="border-b border-[var(--rule)] px-5 py-4">
                            <DialogTitle className="flex items-center gap-2 text-[16px] text-[var(--negative)]">
                                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                                Hapus Pengguna Permanen
                            </DialogTitle>
                            <DialogDescription className="text-[13px] pt-1">
                                Anda yakin ingin menghapus akun berikut secara permanen?
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 px-5 py-4 text-[13px]">
                            <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/60 p-3 space-y-0.5">
                                <p className="font-medium text-foreground">{userName}</p>
                                <p className="font-mono text-[12px] text-muted-foreground">{userEmail}</p>
                            </div>
                            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                                Tindakan ini tidak dapat dibatalkan. Jika pengguna sudah memiliki riwayat laporan atau aktivitas sistem, penghapusan akan ditolak otomatis dan Anda disarankan menggunakan tombol <strong>Nonaktifkan</strong>.
                            </p>
                            {error && (
                                <p
                                    role="alert"
                                    className="rounded-[var(--radius-control)] border border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] px-3 py-2 text-[12.5px] text-[var(--pill-negative-ink)]"
                                >
                                    {error}
                                </p>
                            )}
                        </div>

                        <DialogFooter className="mx-0 mb-0 rounded-b-[var(--radius-card)] border-t border-[var(--rule)] bg-[var(--raised)]/65 px-5 py-3.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                disabled={pending}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                variant="destructive"
                                disabled={pending}
                            >
                                {pending ? 'Menghapus…' : 'Ya, Hapus Permanen'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

function generatePassword(length = 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export type EditableAccount = {
    id: string;
    name: string;
    email: string;
    role: Role;
    status: string;
    institutionId: string | null;
};

export function EditAccountButton({
    account,
    institutions,
    self,
}: {
    account: EditableAccount;
    institutions: Institution[];
    self: boolean;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);

    const handleSaved = useCallback(() => {
        setOpen(false);
        router.refresh();
    }, [router]);

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setOpen(true)}
                title={`Ubah ${account.name}`}
                aria-label={`Ubah ${account.name}`}
                className="text-foreground hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
            >
                <PencilIcon className="size-3" aria-hidden />
                <span>Ubah</span>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                {open && (
                    <EditAccountDialogBody
                        key={`${account.id}-${account.name}-${account.email}-${account.role}-${account.institutionId ?? ''}`}
                        account={account}
                        institutions={institutions}
                        self={self}
                        onClose={() => setOpen(false)}
                        onSaved={handleSaved}
                    />
                )}
            </Dialog>
        </>
    );
}

function EditAccountDialogBody({
    account,
    institutions,
    self,
    onClose,
    onSaved,
}: {
    account: EditableAccount;
    institutions: Institution[];
    self: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [name, setName] = useState(account.name);
    const [email, setEmail] = useState(account.email);
    const [role, setRole] = useState<Role>(account.role);
    const [institutionId, setInstitutionId] = useState(
        account.institutionId ?? '',
    );
    const [password, setPassword] = useState('');
    const [resetPassword, setResetPassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [state, action, pending] = useActionState(
        updateAccountAction,
        initial,
    );

    useEffect(() => {
        if (state.ok) {
            toast.success(state.message ?? 'Perubahan akun disimpan.');
            onSaved();
        } else if (state.error) {
            toast.error(state.error);
        }
    }, [state, onSaved]);

    const canEditRole = account.status === 'APPROVED' && !self;
    const kind = institutionKind(role);
    const options = kind ? institutions.filter((i) => i.type === kind) : [];
    const fieldId = (field: string) => `edit-${account.id}-${field}`;

    return (
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[580px]">
            <DialogHeader className="border-b border-[var(--rule)] bg-[var(--raised)]/45 px-5 py-4 pr-12">
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--pill-info-border)] bg-[var(--pill-info-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--pill-info-ink)]">
                        <PencilIcon className="size-3" aria-hidden /> Sunting akun
                    </span>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                    <span
                        aria-hidden
                        className="grid size-9 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--accent-soft)] text-[12px] font-semibold text-[var(--accent)]"
                    >
                        {initialsOf(account.name)}
                    </span>
                    <div className="min-w-0">
                        <DialogTitle className="truncate text-[16px] font-semibold tracking-[-0.01em]">
                            {account.name}
                        </DialogTitle>
                        <DialogDescription className="truncate text-[12.5px]">
                            {account.email} · {ROLE_LABEL[account.role]}
                        </DialogDescription>
                    </div>
                </div>
            </DialogHeader>

            <form action={action}>
                <input type="hidden" name="userId" value={account.id} />

                <div className="max-h-[min(66dvh,540px)] space-y-4 overflow-y-auto px-5 py-4">
                    <div className="grid gap-3.5 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label
                                htmlFor={fieldId('name')}
                                className="flex items-center gap-1 text-[12.5px] font-medium text-foreground"
                            >
                                Nama lengkap
                                <span
                                    aria-hidden
                                    className="text-[var(--negative)]"
                                >
                                    *
                                </span>
                            </Label>
                            <Input
                                id={fieldId('name')}
                                name="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                minLength={3}
                                required
                                autoComplete="off"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label
                                htmlFor={fieldId('email')}
                                className="flex items-center gap-1 text-[12.5px] font-medium text-foreground"
                            >
                                Email
                                <span
                                    aria-hidden
                                    className="text-[var(--negative)]"
                                >
                                    *
                                </span>
                            </Label>
                            <Input
                                id={fieldId('email')}
                                name="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="off"
                            />
                        </div>
                    </div>

                    {canEditRole ? (
                        <div className="grid gap-3.5 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label
                                    htmlFor={fieldId('role')}
                                    className="flex items-center gap-1 text-[12.5px] font-medium text-foreground"
                                >
                                    Peran
                                    <span
                                        aria-hidden
                                        className="text-[var(--negative)]"
                                    >
                                        *
                                    </span>
                                </Label>
                                <div className="relative">
                                    <select
                                        id={fieldId('role')}
                                        name="role"
                                        value={role}
                                        onChange={(e) => {
                                            setRole(e.target.value as Role);
                                            setInstitutionId('');
                                        }}
                                        className={SELECT_CONTROL}
                                    >
                                        {ROLES.map((r) => (
                                            <option key={r} value={r}>
                                                {ROLE_LABEL[r]}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown
                                        aria-hidden
                                        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                    />
                                </div>
                            </div>

                            {kind !== null && (
                                <div className="space-y-1.5">
                                    <Label
                                        htmlFor={fieldId('institution')}
                                        className="flex items-center gap-1 text-[12.5px] font-medium text-foreground"
                                    >
                                        Institusi
                                        <span
                                            aria-hidden
                                            className="text-[var(--negative)]"
                                        >
                                            *
                                        </span>
                                    </Label>
                                    <div className="relative">
                                        <select
                                            id={fieldId('institution')}
                                            name="institutionId"
                                            value={institutionId}
                                            onChange={(e) =>
                                                setInstitutionId(e.target.value)
                                            }
                                            required
                                            className={SELECT_CONTROL}
                                        >
                                            <option value="">
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
                                        <ChevronDown
                                            aria-hidden
                                            className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                        />
                                    </div>
                                    {options.length === 0 && (
                                        <p className="text-[12px] text-[var(--warning)]">
                                            Belum ada institusi jenis ini di menu
                                            Institusi.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-start gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/50 px-3 py-2.5 text-[12.5px] text-muted-foreground">
                            <Info
                                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                                aria-hidden
                            />
                            <span>
                                {self
                                    ? `Peran (${ROLE_LABEL[account.role]}) tidak dapat diubah dari akun sendiri.`
                                    : 'Peran dan institusi ditetapkan saat pendaftaran disetujui.'}
                            </span>
                        </div>
                    )}

                    <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/35 p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-start gap-2.5">
                                <span
                                    aria-hidden
                                    className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] text-muted-foreground"
                                >
                                    <KeyRound className="size-3.5" />
                                </span>
                                <div>
                                    <p className="text-[12.5px] font-medium text-foreground">
                                        Atur ulang password
                                    </p>
                                    <p className="text-[11.5px] text-muted-foreground">
                                        {resetPassword
                                            ? 'Masukkan password baru minimal 10 karakter.'
                                            : 'Password saat ini tetap berlaku jika tidak diubah.'}
                                    </p>
                                </div>
                            </div>
                            <Button
                                type="button"
                                size="xs"
                                variant={resetPassword ? 'ghost' : 'outline'}
                                onClick={() => {
                                    if (resetPassword) {
                                        setResetPassword(false);
                                        setPassword('');
                                        setShowPassword(false);
                                    } else {
                                        setResetPassword(true);
                                    }
                                }}
                            >
                                {resetPassword ? 'Batal ubah' : 'Ubah password'}
                            </Button>
                        </div>

                        {resetPassword && (
                            <div className="mt-3 space-y-1.5 border-t border-[var(--rule)] pt-3">
                                <div className="flex items-center justify-between gap-2">
                                    <Label
                                        htmlFor={fieldId('password')}
                                        className="flex items-center gap-1 text-[12.5px] font-medium text-foreground"
                                    >
                                        Password baru
                                        <span
                                            aria-hidden
                                            className="text-[var(--negative)]"
                                        >
                                            *
                                        </span>
                                    </Label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPassword(generatePassword());
                                            setShowPassword(true);
                                        }}
                                        className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline"
                                    >
                                        <RefreshCw
                                            className="size-3"
                                            aria-hidden
                                        />{' '}
                                        Acak password
                                    </button>
                                </div>
                                <div className="relative">
                                    <Input
                                        id={fieldId('password')}
                                        name="password"
                                        type={
                                            showPassword ? 'text' : 'password'
                                        }
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        placeholder="Minimal 10 karakter"
                                        autoComplete="new-password"
                                        minLength={10}
                                        required
                                        className="pr-10 font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword((v) => !v)
                                        }
                                        aria-label={
                                            showPassword
                                                ? 'Sembunyikan password'
                                                : 'Tampilkan password'
                                        }
                                        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                                    >
                                        {showPassword ? (
                                            <EyeOff
                                                className="size-4"
                                                aria-hidden
                                            />
                                        ) : (
                                            <Eye
                                                className="size-4"
                                                aria-hidden
                                            />
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {state.error && (
                        <p
                            role="alert"
                            className="rounded-[var(--radius-control)] border border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] px-3 py-2 text-[12.5px] text-[var(--pill-negative-ink)]"
                        >
                            {state.error}
                        </p>
                    )}
                </div>

                <DialogFooter className="mx-0 mb-0 rounded-b-[var(--radius-card)] border-t border-[var(--rule)] bg-[var(--raised)]/65 px-5 py-3.5">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={pending}
                    >
                        Batal
                    </Button>
                    <Button type="submit" disabled={pending}>
                        {pending ? 'Menyimpan…' : 'Simpan perubahan'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
}
