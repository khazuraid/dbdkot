import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { listReports } from '@/lib/domain/reports';
import { formatNumber } from '@/lib/format';
import { PageBody, PageHeader, Panel } from '@/components/shell/page';
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
        <PageBody>
            <PageHeader
                title="Verifikasi PE"
                context={`${formatNumber(total)} laporan menunggu keputusan.`}
            />
            <Panel
                title="Antrian"
                aside={
                    <Link
                        href="/pe"
                        className="text-[13px] text-muted-foreground underline decoration-[var(--control)] underline-offset-4 hover:text-foreground"
                    >
                        Semua laporan PE
                    </Link>
                }
            >
                <ReportTable
                    rows={rows}
                    empty="Tidak ada yang menunggu verifikasi."
                />
            </Panel>
        </PageBody>
    );
}
