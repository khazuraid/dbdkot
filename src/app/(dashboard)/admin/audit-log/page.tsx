import { requireRole } from '@/lib/session';
import { listAuditLogs } from '@/lib/domain/queries';
import { formatDate, formatTime } from '@/lib/format';
import { PageBody, PageHeader, Panel } from '@/components/shell/page';
import { DataTable, Dash } from '@/components/shell/data-table';
import { Pager, readPage } from '@/components/shell/pager';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

type AuditRow = Awaited<ReturnType<typeof listAuditLogs>>['rows'][number];

/** UUIDs are unreadable; the first block is enough to match against a record. */
function shortId(id: string) {
    return id.slice(0, 8);
}

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
        <PageBody>
            <PageHeader
                title="Audit log"
                context="Setiap mutasi dan setiap pembacaan data pribadi dicatat di sini."
            />
            <Panel title={`${total} entri terbaru`}>
                <DataTable<AuditRow>
                    rows={rows}
                    empty="Belum ada entri audit."
                    caption="Catatan audit sistem"
                    columns={[
                        {
                            key: 'time',
                            header: 'Waktu',
                            align: 'right',
                            cell: (a) => (
                                <span className="whitespace-nowrap text-muted-foreground">
                                    {formatDate(a.createdAt)}
                                    {' · '}
                                    {formatTime(a.createdAt)}
                                </span>
                            ),
                        },
                        {
                            key: 'user',
                            header: 'Pengguna',
                            cell: (a) => a.userName ?? a.userEmail ?? <Dash />,
                        },
                        {
                            key: 'action',
                            header: 'Aksi',
                            cell: (a) => a.action,
                        },
                        {
                            key: 'entity',
                            header: 'Entitas',
                            cell: (a) => (
                                <span className="text-muted-foreground">
                                    {a.entityType}
                                </span>
                            ),
                        },
                        {
                            key: 'id',
                            header: 'ID',
                            align: 'right',
                            cell: (a) => (
                                <span
                                    className="tabular-nums text-[12px] text-muted-foreground"
                                    title={a.entityId}
                                >
                                    {shortId(a.entityId)}
                                </span>
                            ),
                        },
                    ]}
                />
            </Panel>
            <Pager
                info={{ page, perPage, total }}
                label="entri"
                buildHref={(n) =>
                    n > 1 ? `/admin/audit-log?page=${n}` : '/admin/audit-log'
                }
            />
        </PageBody>
    );
}
