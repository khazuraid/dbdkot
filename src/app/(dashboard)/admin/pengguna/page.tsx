import { requireRole } from '@/lib/session';
import { listUsers } from '@/lib/domain/queries';
import { formatDate } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/nav';
import type { Role } from '@/lib/roles';
import { PageHeader, Panel, Empty } from '@/components/shell/page';
import { Pager, readPage } from '@/components/shell/pager';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

export default async function PenggunaPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const sp = await searchParams;
    await requireRole('ADMIN');
    const { rows, page, perPage, total } = await listUsers(readPage(sp.page));

    return (
        <div className="px-[var(--pad)] py-8">
            <PageHeader
                title="Pengguna"
                context="Akun dibuat administrator; tidak ada pendaftaran mandiri."
            />
            <Panel title={`${total} akun`}>
                {rows.length === 0 ? (
                    <Empty>Belum ada akun.</Empty>
                ) : (
                    <table className="w-full border-collapse text-[14px]">
                        <thead>
                            <tr className="border-y border-border text-left text-[12px] text-muted-foreground">
                                <th className="py-2 font-normal">Nama</th>
                                <th className="py-2 font-normal">Email</th>
                                <th className="py-2 font-normal">Peran</th>
                                <th className="py-2 font-normal">Institusi</th>
                                <th className="py-2 font-normal">Status</th>
                                <th className="py-2 text-right font-normal">
                                    Dibuat
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {rows.map((u) => (
                                <tr
                                    key={u.id}
                                    className="h-[var(--row-height)]"
                                >
                                    <td className="py-2">{u.name}</td>
                                    <td className="py-2 text-muted-foreground">
                                        {u.email}
                                    </td>
                                    <td className="py-2">
                                        {ROLE_LABEL[u.role as Role] ?? u.role}
                                    </td>
                                    <td className="py-2">
                                        {u.institutionName ?? '—'}
                                    </td>
                                    <td className="py-2">
                                        {u.isActive ? 'Aktif' : 'Nonaktif'}
                                    </td>
                                    <td
                                        data-numeric
                                        className="py-2 text-right text-muted-foreground"
                                    >
                                        {formatDate(u.createdAt)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Panel>
            <Pager
                info={{ page, perPage, total }}
                label="akun"
                buildHref={(n) =>
                    n > 1 ? `/admin/pengguna?page=${n}` : '/admin/pengguna'
                }
            />
        </div>
    );
}
