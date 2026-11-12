import { requireRole } from '@/lib/session';
import { listInstitutions } from '@/lib/domain/queries';
import { PageHeader, Panel, Empty } from '@/components/shell/page';
import { Pager, readPage } from '@/components/shell/pager';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

const TYPE_LABEL: Record<string, string> = {
    RUMAH_SAKIT: 'Rumah sakit',
    PUSKESMAS: 'Puskesmas',
    DINAS_KESEHATAN: 'Dinas kesehatan',
};

export default async function InstitusiPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const sp = await searchParams;
    await requireRole('ADMIN');
    const { rows, page, perPage, total } = await listInstitutions(
        readPage(sp.page),
    );

    return (
        <div className="px-[var(--pad)] py-8">
            <PageHeader
                title="Institusi"
                context="Wilayah kerja puskesmas menentukan tujuan penugasan laporan."
            />
            <Panel title={`${total} institusi`}>
                {rows.length === 0 ? (
                    <Empty>Belum ada institusi.</Empty>
                ) : (
                    <table className="w-full border-collapse text-[14px]">
                        <thead>
                            <tr className="border-y border-border text-left text-[12px] text-muted-foreground">
                                <th className="py-2 font-normal">Nama</th>
                                <th className="py-2 font-normal">Jenis</th>
                                <th className="py-2 font-normal">Kota</th>
                                <th className="py-2 text-right font-normal">
                                    Kelurahan
                                </th>
                                <th className="py-2 font-normal">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {rows.map((i) => (
                                <tr
                                    key={i.id}
                                    className="h-[var(--row-height)]"
                                >
                                    <td className="py-2">{i.name}</td>
                                    <td className="py-2">
                                        {TYPE_LABEL[i.type] ?? i.type}
                                    </td>
                                    <td className="py-2 text-muted-foreground">
                                        {i.city ?? '—'}
                                    </td>
                                    <td
                                        data-numeric
                                        className="py-2 text-right"
                                    >
                                        {i.kelurahanList.length}
                                    </td>
                                    <td className="py-2">
                                        {i.isActive ? 'Aktif' : 'Nonaktif'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Panel>
            <Pager
                info={{ page, perPage, total }}
                label="institusi"
                buildHref={(n) =>
                    n > 1 ? `/admin/institusi?page=${n}` : '/admin/institusi'
                }
            />
        </div>
    );
}
