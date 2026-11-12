import { requireRole } from '@/lib/session';
import { listInstitutions } from '@/lib/domain/queries';
import { PageBody, PageHeader, Panel } from '@/components/shell/page';
import { DataTable, Dash } from '@/components/shell/data-table';
import { Pager, readPage } from '@/components/shell/pager';
import { StatusText } from '@/components/shell/status-text';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

const TYPE_LABEL: Record<string, string> = {
    RUMAH_SAKIT: 'Rumah sakit',
    PUSKESMAS: 'Puskesmas',
    DINAS_KESEHATAN: 'Dinas kesehatan',
};

type InstitutionRow = Awaited<ReturnType<typeof listInstitutions>>['rows'][number];

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
        <PageBody>
            <PageHeader
                title="Institusi"
                context="Wilayah kerja puskesmas menentukan tujuan penugasan laporan."
            />
            <Panel title={`${total} institusi`}>
                <DataTable<InstitutionRow>
                    rows={rows}
                    empty="Belum ada institusi. Impor data fasilitas lebih dulu."
                    caption="Daftar institusi"
                    columns={[
                        { key: 'name', header: 'Nama', cell: (i) => i.name },
                        {
                            key: 'type',
                            header: 'Jenis',
                            cell: (i) => (
                                <span className="text-muted-foreground">
                                    {TYPE_LABEL[i.type] ?? i.type}
                                </span>
                            ),
                        },
                        {
                            key: 'city',
                            header: 'Kota',
                            cell: (i) => i.city ?? <Dash />,
                        },
                        {
                            key: 'kelurahan',
                            header: 'Kelurahan',
                            align: 'right',
                            cell: (i) =>
                                i.kelurahanList.length === 0 ? (
                                    <Dash />
                                ) : (
                                    i.kelurahanList.length
                                ),
                        },
                        {
                            key: 'status',
                            header: 'Status',
                            cell: (i) => (
                                <StatusText tone={i.isActive ? 'good' : 'neutral'}>
                                    {i.isActive ? 'Aktif' : 'Nonaktif'}
                                </StatusText>
                            ),
                        },
                    ]}
                />
            </Panel>
            <Pager
                info={{ page, perPage, total }}
                label="institusi"
                buildHref={(n) =>
                    n > 1 ? `/admin/institusi?page=${n}` : '/admin/institusi'
                }
            />
        </PageBody>
    );
}
