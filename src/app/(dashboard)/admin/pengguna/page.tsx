import Link from 'next/link';
import { requireRole } from '@/lib/session';
import {
    accountStatusLabel,
    statusTone,
} from '@/lib/domain/account-labels';
import { institutionOptions, listManagedAccounts } from '@/lib/domain/accounts';
import { formatDate } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/nav';
import type { Role } from '@/lib/roles';
import { PageBody, PageHeader, Panel } from '@/components/shell/page';
import { DataTable, Dash } from '@/components/shell/data-table';
import { Pager, readPage } from '@/components/shell/pager';
import { StatusText } from '@/components/shell/status-text';
import { ApprovalRow, AccountToggle } from './account-controls';

type AccountRow = Awaited<
    ReturnType<typeof listManagedAccounts>
>['rows'][number];

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

export default async function PenggunaPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const sp = await searchParams;
    const actor = await requireRole('ADMIN');
    const [{ rows, page, perPage, total, pending }, institutions] =
        await Promise.all([
            listManagedAccounts(readPage(sp.page), 25),
            institutionOptions(),
        ]);

    const queue = rows.filter((u) => u.status === 'PENDING');

    return (
        <PageBody>
            <PageHeader
                title="Pengguna"
                context="Setujui pendaftaran baru, tetapkan peran, dan nonaktifkan akun."
                action={{ href: '/admin/pengguna/baru', label: 'Tambah akun' }}
            />

            {pending > 0 && (
                <Panel
                    title={`${pending} pendaftaran menunggu persetujuan`}
                    aside={
                        <span className="text-[12px] text-[var(--warning)]">
                            Belum bisa masuk
                        </span>
                    }
                >
                    <ul className="border-t border-border">
                        {queue.map((u) => (
                            <ApprovalRow
                                key={u.id}
                                userId={u.id}
                                name={u.name}
                                email={u.email}
                                institutions={institutions}
                            />
                        ))}
                    </ul>
                    {pending > queue.length && (
                        <p className="pt-3 text-[12px] text-muted-foreground">
                            {pending - queue.length} lainnya di halaman
                            berikutnya.
                        </p>
                    )}
                </Panel>
            )}

            <Panel title={`${total} akun`}>
                <DataTable<AccountRow>
                    rows={rows}
                    empty="Belum ada akun. Buat akun pertama lewat Tambah akun."
                    caption="Daftar akun"
                    columns={[
                        { key: 'name', header: 'Nama', cell: (u) => u.name },
                        {
                            key: 'email',
                            header: 'Email',
                            cell: (u) => (
                                <span className="text-muted-foreground">
                                    {u.email}
                                </span>
                            ),
                        },
                        {
                            key: 'role',
                            header: 'Peran',
                            cell: (u) => ROLE_LABEL[u.role as Role] ?? u.role,
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
                                <AccountToggle
                                    userId={u.id}
                                    isActive={u.isActive}
                                    status={u.status}
                                    self={u.id === actor.userId}
                                />
                            ),
                        },
                    ]}
                />
            </Panel>

            <Pager
                info={{ page, perPage, total }}
                label="akun"
                buildHref={(n) =>
                    n > 1 ? `/admin/pengguna?page=${n}` : '/admin/pengguna'
                }
            />

            <p className="mt-6 text-[12px] text-muted-foreground">
                Akun yang dinonaktifkan tidak bisa membuat sesi baru.{' '}
                <Link href="/admin/audit-log" className="underline">
                    Lihat audit log
                </Link>
            </p>
        </PageBody>
    );
}
