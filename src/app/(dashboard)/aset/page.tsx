import { requireActor } from '@/lib/session';
import { listAssets } from '@/lib/domain/admin';
import { Pager, readPage } from '@/components/shell/pager';
import { PageBody, PageHeader, Panel } from '@/components/shell/page';
import { DataTable, Dash } from '@/components/shell/data-table';
import { StatusText } from '@/components/shell/status-text';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

type AssetRow = Awaited<ReturnType<typeof listAssets>>['rows'][number];

export default async function AsetPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const sp = await searchParams;
    const actor = await requireActor();
    const { rows, page, perPage, total } = await listAssets(
        actor,
        readPage(sp.page),
    );
    const low = rows.filter(
        (a) => Number(a.currentStock) < Number(a.minimumStock),
    ).length;

    return (
        <PageBody>
            <PageHeader
                title="Aset"
                context={
                    <>
                        Stok insektisida, larvasida, dan alat pemeriksaan.
                        {low > 0 && (
                            <span className="text-[var(--warning)]">
                                {' '}
                                {low} di bawah minimum di halaman ini.
                            </span>
                        )}
                    </>
                }
            />
            <Panel title={`${total} jenis aset`}>
                <DataTable<AssetRow>
                    rows={rows}
                    empty="Belum ada aset terdaftar untuk institusi Anda."
                    caption="Daftar aset dan stok"
                    columns={[
                        {
                            key: 'code',
                            header: 'Kode',
                            cell: (a) => (
                                <span className="tabular-nums text-muted-foreground">
                                    {a.code}
                                </span>
                            ),
                        },
                        { key: 'name', header: 'Nama', cell: (a) => a.name },
                        {
                            key: 'category',
                            header: 'Kategori',
                            cell: (a) => a.category,
                        },
                        {
                            key: 'institution',
                            header: 'Institusi',
                            cell: (a) => a.institutionName ?? <Dash />,
                        },
                        {
                            key: 'stock',
                            header: 'Stok',
                            align: 'right',
                            cell: (a) => (
                                <StatusText
                                    tone={
                                        Number(a.currentStock) <
                                        Number(a.minimumStock)
                                            ? 'warn'
                                            : 'neutral'
                                    }
                                >
                                    {a.currentStock} {a.unit}
                                </StatusText>
                            ),
                        },
                        {
                            key: 'min',
                            header: 'Minimum',
                            align: 'right',
                            cell: (a) => (
                                <span className="text-muted-foreground">
                                    {a.minimumStock} {a.unit}
                                </span>
                            ),
                        },
                    ]}
                />
            </Panel>
            <Pager
                info={{ page, perPage, total }}
                label="aset"
                buildHref={(n) => (n > 1 ? `/aset?page=${n}` : '/aset')}
            />
        </PageBody>
    );
}
