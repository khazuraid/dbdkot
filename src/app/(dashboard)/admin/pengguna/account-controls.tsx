'use client';

import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ROLES, type Role } from '@/lib/roles';
import { ROLE_LABEL } from '@/lib/nav';
import { Button } from '@/components/ui/button';
import {
    approveAccountAction,
    rejectAccountAction,
    setAccountActiveAction,
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
        if (state.message) toast(state.message);
    }, [state]);
}

export function ApprovalRow({
    userId,
    name,
    email,
    institutions,
}: {
    userId: string;
    name: string;
    email: string;
    institutions: Institution[];
}) {
    const [open, setOpen] = useState(false);
    const [role, setRole] = useState<Role>('PUSKESMAS');
    const [state, action, pending] = useActionState(approveAccountAction, initial);
    const [, reject, rejecting] = useActionState(rejectAccountAction, initial);

    useNotified(state);

    const kind = institutionKind(role);
    const options = kind
        ? institutions.filter((i) => i.type === kind)
        : institutions;

    return (
        <li className="border-b border-border">
            <div className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                    <p className="text-[14px] font-medium">{name}</p>
                    <p className="truncate text-[13px] text-muted-foreground">
                        {email}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        aria-expanded={open}
                    >
                        {open ? 'Tutup' : 'Tinjau'}
                    </Button>
                    <form action={reject}>
                        <input type="hidden" name="userId" value={userId} />
                        <Button
                            type="submit"
                            variant="outline"
                            disabled={rejecting}
                        >
                            Tolak
                        </Button>
                    </form>
                </div>
            </div>

            {open && (
                <form
                    action={action}
                    className="mb-4 grid gap-3 rounded-[var(--radius-card)] border border-border bg-[var(--surface)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                >
                    <input type="hidden" name="userId" value={userId} />
                    <div className="space-y-1.5">
                        <label
                            htmlFor={`role-${userId}`}
                            className="text-[12px] text-muted-foreground"
                        >
                            Peran
                        </label>
                        <select
                            id={`role-${userId}`}
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
                                htmlFor={`inst-${userId}`}
                                className="text-[12px] text-muted-foreground"
                            >
                                Institusi
                            </label>
                            <select
                                id={`inst-${userId}`}
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
                        </div>
                    )}

                    <Button type="submit" disabled={pending}>
                        {pending ? 'Menyimpan…' : 'Setujui'}
                    </Button>

                    {options.length === 0 && kind && (
                        <p className="text-[12px] text-[var(--warning)] sm:col-span-3">
                            Belum ada {kind === 'PUSKESMAS' ? 'puskesmas' : 'rumah sakit'} aktif. Tambahkan di menu Institusi lebih dulu.
                        </p>
                    )}
                    {state.error && (
                        <p
                            role="alert"
                            className="text-[12px] text-[var(--negative)] sm:col-span-3"
                        >
                            {state.error}
                        </p>
                    )}
                </form>
            )}
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
    const [state, action, pending] = useActionState(
        setAccountActiveAction,
        initial,
    );
    useNotified(state);

    if (self) {
        return <span className="text-[13px] text-muted-foreground">Anda</span>;
    }

    // A rejected request is not re-enabled here; it is a new application.
    if (status === 'REJECTED') {
        return <span className="text-[13px] text-muted-foreground">Ditolak</span>;
    }

    return (
        <form action={action}>
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="isActive" value={String(!isActive)} />
            <Button
                type="submit"
                variant="link"
               
                disabled={pending}
            >
                {isActive ? 'Nonaktifkan' : 'Aktifkan'}
            </Button>
        </form>
    );
}
