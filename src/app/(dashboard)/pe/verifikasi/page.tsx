import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { listReports } from '@/lib/domain/reports';
import { CASE_TYPE_LABEL } from '@/lib/domain/report-labels';
import { formatDate } from '@/lib/format';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { DataTable, Dash } from '@/components/shell/data-table';
import { Pager, readPage } from '@/components/shell/pager-view';
import { VerifyControl } from './verify-control';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

type ReportRow = Awaited<ReturnType<typeof listReports>>['rows'][number];

/**
 * Dinkes verification queue: PE finished, waiting on the final decision. The
 * decision is taken here rather than by opening each report — an operator
 * clearing a backlog should not lose the queue position for every case.
 */
export default async function VerifikasiPePage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const sp = await searchParams;
    const actor = await requireRole('DINKES', 'ADMIN');
    const page = readPage(sp.page);
    const { rows, perPage, total } = await listReports(actor, {
        status: 'PE_COMPLETED',
        page,
        perPage: 25,
    });

    return (
        <PageBody>
            <PageHeader
                title="Verifikasi PE"
                context={`${total} laporan menunggu keputusan.`}
            />

            <PageContent>
                <Panel
                    title="Antrian"
                    aside={
                        <Link
                            href="/pe"
                            className="text-[12.5px] text-muted-foreground underline decoration-[var(--control)] underline-offset-4 hover:text-foreground"
                        >
                            Semua laporan PE
                        </Link>
                    }
                >
                    <DataTable<ReportRow>
                        rows={rows}
                        empty="Tidak ada yang menunggu verifikasi."
                        caption="Antrian verifikasi PE"
                        minWidth={900}
                        columns={[
                            {
                                key: 'number',
                                header: 'No. laporan',
                                cell: (r) => (
                                    <Link
                                        href={`/laporan/${r.id}`}
                                        className="font-mono text-[13px] font-medium text-[var(--accent)] tabular-nums underline-offset-4 hover:underline"
                                    >
                                        {r.reportNumber}
                                    </Link>
                                ),
                            },
                            {
                                key: 'case',
                                header: 'Diagnosis',
                                cell: (r) =>
                                    CASE_TYPE_LABEL[r.caseType] ?? r.caseType,
                            },
                            {
                                key: 'kel',
                                header: 'Kelurahan',
                                cell: (r) => r.kelurahan ?? <Dash />,
                            },
                            {
                                key: 'created',
                                header: 'Masuk',
                                cell: (r) => (
                                    <span className="whitespace-nowrap text-muted-foreground">
                                        {formatDate(r.createdAt)}
                                    </span>
                                ),
                            },
                            {
                                key: 'act',
                                header: 'Keputusan',
                                cell: (r) => (
                                    <VerifyControl
                                        reportId={r.id}
                                        reportNumber={r.reportNumber}
                                    />
                                ),
                            },
                        ]}
                    />
                    <Pager
                        info={{ page, perPage, total }}
                        buildHref={(p) => `/pe/verifikasi?page=${p}`}
                        label="laporan"
                    />
                </Panel>
            </PageContent>
        </PageBody>
    );
}
