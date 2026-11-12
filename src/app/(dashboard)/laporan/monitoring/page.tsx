import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { listReports } from '@/lib/domain/reports';
import { formatNumber } from '@/lib/format';
import { PageBody, PageHeader, Panel } from '@/components/shell/page';
import { ReportTable } from '@/components/reports/report-table';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

/** Dinkes monitoring: the whole pipeline, every state, newest first. */
export default async function MonitoringPage() {
    const actor = await requireRole('DINKES', 'ADMIN');
    const { rows, total } = await listReports(actor, { perPage: 100 });

    return (
        <PageBody>
            <PageHeader
                title="Monitoring"
                context={`${formatNumber(total)} laporan lintas fasilitas.`}
            />
            <Panel
                title="Alur laporan"
                aside={
                    <Link
                        href="/laporan/analitik"
                        className="text-[13px] text-muted-foreground underline decoration-[var(--control)] underline-offset-4 hover:text-foreground"
                    >
                        Analitik
                    </Link>
                }
            >
                <ReportTable rows={rows} empty="Belum ada laporan." />
            </Panel>
        </PageBody>
    );
}
