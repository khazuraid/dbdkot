import { requireActor } from '@/lib/session';
import { listAssets } from '@/lib/domain/admin';
import { Pager, readPage } from '@/components/shell/pager';
import { PageHeader, Panel, Empty } from '@/components/shell/page';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

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

    return (
        <div className="px-[var(--pad)] py-8">
            <PageHeader
                title="Aset"
                context="Stok insektisida, larvasida, dan alat pemeriksaan."
            />
            <Panel title={`${total} jenis aset`}>
                {rows.length === 0 ? (
                    <Empty>Belum ada aset terdaftar.</Empty>
                ) : (
                    <table className="w-full border-collapse text-[14px]">
                        <thead>
                            <tr className="border-y border-border text-left text-[12px] text-muted-foreground">
                                <th className="py-2 font-normal">Kode</th>
                                <th className="py-2 font-normal">Nama</th>
                                <th className="py-2 font-normal">Kategori</th>
                                <th className="py-2 font-normal">Institusi</th>
                                <th className="py-2 text-right font-normal">
                                    Stok
                                </th>
                                <th className="py-2 text-right font-normal">
                                    Minimum
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {rows.map((a) => {
                                // Low stock is the only thing that needs a colour.
                                const low = a.currentStock < a.minimumStock;

                                return (
                                    <tr
                                        key={a.id}
                                        className="h-[var(--row-height)]"
                                    >
                                        <td
                                            data-numeric
                                            className="py-2 font-mono text-[13px]"
                                        >
                                            {a.code}
                                        </td>
                                        <td className="py-2">{a.name}</td>
                                        <td className="py-2">{a.category}</td>
                                        <td className="py-2 text-muted-foreground">
                                            {a.institutionName ?? '—'}
                                        </td>
                                        <td
                                            data-numeric
                                            className={
                                                low
                                                    ? 'py-2 text-right text-[var(--negative)]'
                                                    : 'py-2 text-right'
                                            }
                                        >
                                            {a.currentStock} {a.unit}
                                        </td>
                                        <td
                                            data-numeric
                                            className="py-2 text-right text-muted-foreground"
                                        >
                                            {a.minimumStock}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </Panel>
            <Pager
                info={{ page, perPage, total }}
                label="aset"
                buildHref={(n) => (n > 1 ? `/aset?page=${n}` : '/aset')}
            />
        </div>
    );
}
