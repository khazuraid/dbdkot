import { requireRole } from '@/lib/session';
import { listReports } from '@/lib/domain/reports';
import { formatDate } from '@/lib/format';
import { PageBody, PageHeader, Panel } from '@/components/shell/page';
import { DataTable, Dash } from '@/components/shell/data-table';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

type ReportRow = Awaited<ReturnType<typeof listReports>>['rows'][number];

/**
 * Only exists in the live repo (dbdfix), not in the audited one. Rather than
 * porting a page whose module I cannot read, the queue of reports whose
 * assignment failed is what the operator actually needs here.
 */
export default async function KoreksiWilayahPage() {
    const actor = await requireRole('ADMIN', 'DINKES');
    const { rows } = await listReports(actor, {
        status: 'SUBMITTED',
        perPage: 100,
    });

    return (
        <PageBody>
            <PageHeader
                title="Koreksi wilayah"
                context="Laporan yang belum menemukan puskesmas karena kelurahannya tidak cocok."
            />
            <Panel title={`${rows.length} laporan tanpa puskesmas`}>
                <DataTable<ReportRow>
                    rows={rows}
                    empty="Tidak ada laporan yang gagal ditugaskan. Semua kelurahan cocok dengan wilayah puskesmas."
                    caption="Laporan yang perlu koreksi wilayah"
                    columns={[
                        {
                            key: 'number',
                            header: 'No. laporan',
                            cell: (r) => (
                                <span className="tabular-nums">
                                    {r.reportNumber}
                                </span>
                            ),
                        },
                        {
                            key: 'kel',
                            header: 'Kelurahan',
                            cell: (r) => r.kelurahan ?? <Dash />,
                        },
                        {
                            key: 'kec',
                            header: 'Kecamatan',
                            cell: (r) => r.kecamatan ?? <Dash />,
                        },
                        {
                            key: 'created',
                            header: 'Masuk',
                            align: 'right',
                            cell: (r) => (
                                <span className="whitespace-nowrap text-muted-foreground">
                                    {formatDate(r.createdAt)}
                                </span>
                            ),
                        },
                    ]}
                />
            </Panel>
        </PageBody>
    );
}
