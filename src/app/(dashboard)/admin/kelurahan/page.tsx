import { requireRole } from '@/lib/session';
import { listKelurahan } from '@/lib/domain/admin';
import { PageBody, PageHeader, Panel } from '@/components/shell/page';
import { DataTable } from '@/components/shell/data-table';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

type KelurahanRow = Awaited<ReturnType<typeof listKelurahan>>[number];

export default async function KelurahanPage() {
    await requireRole('ADMIN', 'DINKES');
    const rows = await listKelurahan();
    const cities = new Set(rows.map((k) => k.kota)).size;

    return (
        <PageBody>
            <PageHeader
                title="Kelurahan"
                context={`${rows.length} wilayah di ${cities} kota, dipakai saat melapor dan menugaskan.`}
            />
            <Panel title={`${rows.length} kelurahan`}>
                <DataTable<KelurahanRow>
                    rows={rows}
                    empty="Belum ada kelurahan yang terdaftar."
                    caption="Daftar kelurahan"
                    columns={[
                        { key: 'name', header: 'Kelurahan', cell: (k) => k.name },
                        { key: 'kec', header: 'Kecamatan', cell: (k) => k.kecamatan },
                        {
                            key: 'kota',
                            header: 'Kota',
                            cell: (k) => (
                                <span className="text-muted-foreground">
                                    {k.kota}
                                </span>
                            ),
                        },
                        {
                            key: 'prov',
                            header: 'Provinsi',
                            cell: (k) => (
                                <span className="text-muted-foreground">
                                    {k.provinsi}
                                </span>
                            ),
                        },
                    ]}
                />
            </Panel>
        </PageBody>
    );
}
