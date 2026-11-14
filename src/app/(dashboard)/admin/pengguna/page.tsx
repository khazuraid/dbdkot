import Link from 'next/link';
import {
    Clock,
    Search,
    UserCheck,
    UserMinus,
    Users,
} from 'lucide-react';
import { requireRole } from '@/lib/session';
import { accountStatusLabel, statusTone } from '@/lib/domain/account-labels';
import {
    institutionOptions,
    listManagedAccounts,
    type AccountListFilter,
} from '@/lib/domain/accounts';
import { formatDate, formatNumber } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/nav';
import type { Role } from '@/lib/roles';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { DataTable, Dash } from '@/components/shell/data-table';
import { Pager, readPage } from '@/components/shell/pager-view';
import { Stat } from '@/components/shell/stat';
import { StatusText } from '@/components/shell/status-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from '@/components/ui/input-group';
import { cn } from '@/lib/utils';
import {
    AccountToggle,
    ApprovalRow,
    EditAccountButton,
} from './account-controls';
import { CreateAccountDialog } from './baru/create-account-form';

type AccountRow = Awaited<
    ReturnType<typeof listManagedAccounts>
>['rows'][number];

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

const STATUS_FILTERS: { value: AccountListFilter; label: string }[] = [
    { value: 'ALL', label: 'Semua' },
    { value: 'ACTIVE', label: 'Aktif' },
    { value: 'INACTIVE', label: 'Nonaktif' },
    { value: 'PENDING', label: 'Menunggu' },
    { value: 'REJECTED', label: 'Ditolak' },
];

function initialsOf(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function roleBadgeClass(role: string) {
    if (role === 'ADMIN') {
        return 'border-[var(--border)] bg-[var(--accent-soft)] text-[var(--accent)]';
    }
    if (role === 'DINKES') {
        return 'border-[var(--pill-info-border)] bg-[var(--pill-info-bg)] text-[var(--pill-info-ink)]';
    }
    return 'border-[var(--pill-neutral-border)] bg-[var(--pill-neutral-bg)] text-[var(--pill-neutral-ink)]';
}

export default async function PenggunaPage({
    searchParams,
}: {
    searchParams: Promise<{
        page?: string;
        q?: string;
        status?: string;
        tambah?: string;
    }>;
}) {
    const sp = await searchParams;
    const actor = await requireRole('ADMIN');
    const q = sp.q?.trim() ?? '';
    const filter: AccountListFilter =
        sp.status === 'ACTIVE' ||
        sp.status === 'INACTIVE' ||
        sp.status === 'PENDING' ||
        sp.status === 'REJECTED'
            ? sp.status
            : 'ALL';

    const currentPage = readPage(sp.page);

    const [
        { rows, page, perPage, total, pending, summary, waiting },
        institutions,
    ] = await Promise.all([
        listManagedAccounts({
            page: currentPage,
            perPage: 25,
            q,
            filter,
        }),
        institutionOptions(),
    ]);

    const buildHref = (overrides: {
        page?: number;
        q?: string;
        status?: AccountListFilter;
        tambah?: boolean;
    }) => {
        const nextQ = overrides.q !== undefined ? overrides.q : q;
        const nextStatus =
            overrides.status !== undefined ? overrides.status : filter;
        const nextPage =
            overrides.page !== undefined
                ? overrides.page
                : overrides.status !== undefined || overrides.q !== undefined
                  ? 1
                  : currentPage;
        const params = new URLSearchParams();
        if (nextQ) params.set('q', nextQ);
        if (nextStatus !== 'ALL') params.set('status', nextStatus);
        if (nextPage > 1) params.set('page', String(nextPage));
        if (overrides.tambah) params.set('tambah', '1');
        const qs = params.toString();
        return qs ? `/admin/pengguna?${qs}` : '/admin/pengguna';
    };

    return (
        <PageBody>
            <PageHeader
                title="Pengguna"
                context="Setujui pendaftaran baru, tetapkan peran, dan kelola status akses akun."
                action={{
                    href: buildHref({ tambah: true }),
                    label: 'Tambah akun',
                }}
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <form
                        action="/admin/pengguna"
                        className="flex flex-wrap items-center gap-2"
                    >
                        {filter !== 'ALL' && (
                            <input type="hidden" name="status" value={filter} />
                        )}
                        <InputGroup className="h-9 w-full sm:w-[260px]">
                            <InputGroupAddon>
                                <Search className="size-4" aria-hidden />
                            </InputGroupAddon>
                            <InputGroupInput
                                type="search"
                                name="q"
                                defaultValue={q}
                                placeholder="Cari nama atau email…"
                                aria-label="Cari akun pengguna"
                            />
                        </InputGroup>
                        <Button type="submit" variant="outline" size="sm">
                            Cari
                        </Button>
                        {(q || filter !== 'ALL') && (
                            <Button asChild variant="ghost" size="sm">
                                <Link href="/admin/pengguna">Reset</Link>
                            </Button>
                        )}
                    </form>

                    <div
                        role="group"
                        aria-label="Filter status akun"
                        className="flex flex-wrap items-center gap-1.5"
                    >
                        {STATUS_FILTERS.map((opt) => {
                            const active = filter === opt.value;
                            return (
                                <Link
                                    key={opt.value}
                                    href={buildHref({ status: opt.value })}
                                    className={cn(
                                        'inline-flex h-8 items-center rounded-[var(--radius-pill)] border px-3 text-[12.5px] font-medium transition-colors',
                                        active
                                            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                                            : 'border-[var(--border)] bg-[var(--surface)] text-muted-foreground hover:bg-[var(--raised)] hover:text-foreground',
                                    )}
                                >
                                    {opt.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </PageHeader>

            <PageContent className="space-y-5">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat
                        label="Total akun"
                        value={summary.total}
                        icon={Users}
                    />
                    <Stat
                        label="Akun aktif"
                        value={summary.active}
                        signal="good"
                        icon={UserCheck}
                    />
                    <Stat
                        label="Menunggu persetujuan"
                        value={summary.pending}
                        signal={summary.pending > 0 ? 'warn' : 'good'}
                        hint={
                            summary.pending > 0
                                ? 'Perlu peninjauan peran & institusi'
                                : 'Tidak ada antrean pendaftaran'
                        }
                        icon={Clock}
                    />
                    <Stat
                        label="Akun nonaktif"
                        value={summary.inactive}
                        signal="neutral"
                        icon={UserMinus}
                    />
                </dl>

                {pending > 0 && (
                    <Panel
                        title={`${formatNumber(pending)} pendaftaran menunggu persetujuan`}
                        className="border-l-[3px] border-l-[var(--warning)]"
                        aside={
                            <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--pill-warning-ink)]">
                                Perlu ditinjau
                            </span>
                        }
                    >
                        <ul className="divide-y divide-[var(--rule)]">
                            {waiting.map((u) => (
                                <ApprovalRow
                                    key={u.id}
                                    userId={u.id}
                                    name={u.name}
                                    email={u.email}
                                    institutions={institutions}
                                />
                            ))}
                        </ul>
                        {pending > waiting.length && (
                            <p className="pt-3 text-[12px] text-muted-foreground">
                                Menampilkan {waiting.length} dari {pending}{' '}
                                pendaftaran, terlama lebih dahulu.
                            </p>
                        )}
                    </Panel>
                )}

                <Panel
                    title={`${formatNumber(total)} akun${filter !== 'ALL' ? ` · ${STATUS_FILTERS.find((f) => f.value === filter)?.label}` : ''}${q ? ` · “${q}”` : ''}`}
                    aside={
                        <Link
                            href="/admin/audit-log"
                            className="text-[12px] font-medium text-[var(--accent)] hover:underline"
                        >
                            Lihat audit log
                        </Link>
                    }
                >
                    <DataTable<AccountRow>
                        rows={rows}
                        empty="Tidak ada akun yang cocok dengan filter saat ini."
                        caption="Daftar akun"
                        columns={[
                            {
                                key: 'name',
                                header: 'Pengguna',
                                cell: (u) => (
                                    <div className="flex items-center gap-2.5">
                                        <span
                                            aria-hidden
                                            className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--raised)] text-[11px] font-semibold text-muted-foreground"
                                        >
                                            {initialsOf(u.name)}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate font-medium text-foreground">
                                                {u.name}
                                            </p>
                                            <p className="truncate text-[12px] text-muted-foreground">
                                                {u.email}
                                            </p>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: 'role',
                                header: 'Peran',
                                cell: (u) => (
                                    <Badge
                                        variant="outline"
                                        className={roleBadgeClass(u.role)}
                                    >
                                        {ROLE_LABEL[u.role as Role] ?? u.role}
                                    </Badge>
                                ),
                            },
                            {
                                key: 'inst',
                                header: 'Institusi',
                                cell: (u) => u.institutionName ?? <Dash />,
                            },
                            {
                                key: 'status',
                                header: 'Status',
                                cell: (u) => (
                                    <StatusText tone={statusTone(u)}>
                                        {accountStatusLabel(u)}
                                    </StatusText>
                                ),
                            },
                            {
                                key: 'created',
                                header: 'Dibuat',
                                align: 'right',
                                cell: (u) => (
                                    <span className="whitespace-nowrap text-muted-foreground">
                                        {formatDate(u.createdAt)}
                                    </span>
                                ),
                            },
                            {
                                key: 'action',
                                header: 'Tindakan',
                                align: 'right',
                                cell: (u) => (
                                    <div className="inline-flex flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap">
                                        <EditAccountButton
                                            account={{
                                                id: u.id,
                                                name: u.name,
                                                email: u.email,
                                                role: u.role as Role,
                                                status: u.status,
                                                institutionId: u.institutionId,
                                            }}
                                            institutions={institutions}
                                            self={u.id === actor.userId}
                                        />
                                        <AccountToggle
                                            userId={u.id}
                                            isActive={u.isActive}
                                            status={u.status}
                                            self={u.id === actor.userId}
                                        />
                                    </div>
                                ),
                            },
                        ]}
                    />
                    <Pager
                        info={{ page, perPage, total }}
                        label="akun"
                        buildHref={(n) => buildHref({ page: n })}
                    />
                </Panel>

                <p className="text-[12px] text-muted-foreground">
                    Akun yang dinonaktifkan tidak bisa membuat sesi baru.
                </p>
            </PageContent>

            <CreateAccountDialog
                open={sp.tambah === '1'}
                closeHref={buildHref({ tambah: false })}
                institutions={institutions}
            />
        </PageBody>
    );
}
