import { requireRole } from '@/lib/session';
import { listReports } from '@/lib/domain/reports';
import { formatDate } from '@/lib/format';
import { PageHeader, Panel, Empty } from '@/components/shell/page';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

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
        <div className="px-[var(--pad)] py-8">
            <PageHeader
                title="Koreksi wilayah"
                context="Laporan yang belum menemukan puskesmas karena kelurahannya tidak cocok."
            />
            <Panel title={`${rows.length} laporan tanpa puskesmas`}>
                {rows.length === 0 ? (
                    <Empty>Tidak ada laporan yang gagal ditugaskan.</Empty>
                ) : (
                    <table className="w-full border-collapse text-[14px]">
                        <thead>
                            <tr className="border-y border-border text-left text-[12px] text-muted-foreground">
                                <th className="py-2 font-normal">
                                    No. laporan
                                </th>
                                <th className="py-2 font-normal">Kelurahan</th>
                                <th className="py-2 font-normal">Kecamatan</th>
                                <th className="py-2 font-normal">Masuk</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {rows.map((r) => (
                                <tr
                                    key={r.id}
                                    className="h-[var(--row-height)]"
                                >
                                    <td className="py-2">{r.reportNumber}</td>
                                    <td className="py-2">
                                        {r.kelurahan ?? '—'}
                                    </td>
                                    <td className="py-2">
                                        {r.kecamatan ?? '—'}
                                    </td>
                                    <td
                                        data-numeric
                                        className="py-2 text-muted-foreground"
                                    >
                                        {formatDate(r.createdAt)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Panel>
        </div>
    );
}
