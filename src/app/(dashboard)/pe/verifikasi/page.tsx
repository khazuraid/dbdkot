import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { listReports } from '@/lib/domain/reports';
import { formatNumber } from '@/lib/format';
import { PageHeader, Panel } from '@/components/shell/page';
import { ReportTable } from '@/components/reports/report-table';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

/** Dinkes verification queue: PE finished, waiting on the final decision. */
export default async function VerifikasiPePage() {
    const actor = await requireRole('DINKES', 'ADMIN');
    const { rows, total } = await listReports(actor, {
        status: 'PE_COMPLETED',
        perPage: 100,
    });

    return (
        <div className="px-[var(--pad)] py-8">
            <PageHeader
                title="Verifikasi PE"
                context={`${formatNumber(total)} laporan menunggu keputusan.`}
            />
            <Panel
                title="Antrian"
                aside={
                    <Link href="/pe" className="text-[13px] underline">
                        Semua laporan PE
                    </Link>
                }
            >
                <ReportTable
                    rows={rows}
                    empty="Tidak ada yang menunggu verifikasi."
                />
            </Panel>
        </div>
    );
}
