import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { listAssetsPaged } from '@/lib/domain/master';
import { formatNumber } from '@/lib/format';
import {
    Empty,
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { StatusText } from '@/components/shell/status-text';
import { Button } from '@/components/ui/button';

export const instant = false;

export default async function LogistikPage() {
    const actor = await requireRole('ADMIN', 'DINKES', 'PUSKESMAS');
    const { rows } = await listAssetsPaged(actor, { q: '', page: 1 });

    const lowStock = rows.filter((r) => r.currentStock <= r.minimumStock);

    return (
        <PageBody>
            <PageHeader
                title="Logistik Pengendalian Vektor"
                context="Pantauan stok Abate, Insektisida, dan Mesin Fogger (berkurang otomatis saat Siklus Fogging dicatat)."
                aside={
                    (actor.role === 'ADMIN' || actor.role === 'PUSKESMAS') && (
                        <Button asChild variant="outline" size="sm">
                            <Link href="/aset">Kelola Master Aset</Link>
                        </Button>
                    )
                }
            />

            <PageContent>
                {lowStock.length > 0 && (
                    <Panel padded title="Peringatan stok minimum">
                        <p className="text-[13px] text-[var(--warning)]">
                            {lowStock.length} item berada di bawah atau tepat
                            pada batas stok minimum. Segera lakukan pengadaan.
                        </p>
                    </Panel>
                )}

                <Panel title={`Inventaris Aktif (${rows.length} item)`}>
                    {rows.length === 0 ? (
                        <Empty action={{ href: '/aset', label: 'Tambah aset logistik' }}>
                            Belum ada data logistik Abate, Insektisida, atau
                            Mesin Fogger.
                        </Empty>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="ledger w-full">
                                <thead>
                                    <tr>
                                        <th>Kode / Nama Barang</th>
                                        <th>Institusi</th>
                                        <th className="text-right">Stok</th>
                                        <th className="text-right">Min. Stok</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((item) => {
                                        const low =
                                            item.currentStock <=
                                            item.minimumStock;
                                        return (
                                            <tr key={item.id}>
                                                <td>
                                                    <p className="font-medium">
                                                        {item.name}
                                                    </p>
                                                    <p className="font-mono text-[11.5px] text-muted-foreground">
                                                        {item.code} · {item.category}
                                                    </p>
                                                </td>
                                                <td className="text-muted-foreground">
                                                    {item.institutionName ?? '-'}
                                                </td>
                                                <td className="num font-mono">
                                                    {formatNumber(
                                                        item.currentStock,
                                                    )}{' '}
                                                    {item.unit}
                                                </td>
                                                <td className="num font-mono text-muted-foreground">
                                                    {formatNumber(
                                                        item.minimumStock,
                                                    )}{' '}
                                                    {item.unit}
                                                </td>
                                                <td>
                                                    <StatusText
                                                        tone={
                                                            low ? 'bad' : 'good'
                                                        }
                                                    >
                                                        {low
                                                            ? 'Stok Menipis'
                                                            : 'Aman'}
                                                    </StatusText>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>
            </PageContent>
        </PageBody>
    );
}
