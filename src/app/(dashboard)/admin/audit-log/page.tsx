import { requireRole } from '@/lib/session';
import { listAuditLogs } from '@/lib/domain/queries';
import { formatDate } from '@/lib/format';
import { PageHeader, Panel, Empty } from '@/components/shell/page';
import { Pager, readPage } from '@/components/shell/pager';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

export default async function AuditLogPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const sp = await searchParams;
    await requireRole('ADMIN');
    const { rows, page, perPage, total } = await listAuditLogs(
        readPage(sp.page),
    );

    return (
        <div className="px-[var(--pad)] py-8">
            <PageHeader
                title="Audit log"
                context="Setiap mutasi dan setiap pembacaan data pribadi dicatat di sini."
            />
            <Panel title={`${total} entri terbaru`}>
                {rows.length === 0 ? (
                    <Empty>Belum ada entri audit.</Empty>
                ) : (
                    <table className="w-full border-collapse text-[14px]">
                        <thead>
                            <tr className="border-y border-border text-left text-[12px] text-muted-foreground">
                                <th className="py-2 font-normal">Waktu</th>
                                <th className="py-2 font-normal">Pengguna</th>
                                <th className="py-2 font-normal">Aksi</th>
                                <th className="py-2 font-normal">Entitas</th>
                                <th className="py-2 font-normal">ID</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {rows.map((a) => (
                                <tr
                                    key={a.id}
                                    className="h-[var(--row-height)]"
                                >
                                    <td data-numeric className="py-2">
                                        {formatDate(a.createdAt)}
                                    </td>
                                    <td className="py-2">
                                        {a.userName ?? a.userEmail ?? '—'}
                                    </td>
                                    <td className="py-2">{a.action}</td>
                                    <td className="py-2">{a.entityType}</td>
                                    <td className="py-2 font-mono text-[12px] text-muted-foreground">
                                        {a.entityId}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Panel>
            <Pager
                info={{ page, perPage, total }}
                label="entri"
                buildHref={(n) =>
                    n > 1 ? `/admin/audit-log?page=${n}` : '/admin/audit-log'
                }
            />
        </div>
    );
}
