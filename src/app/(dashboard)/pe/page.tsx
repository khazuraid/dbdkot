import Link from 'next/link';
import { requireActor } from '@/lib/session';
import { listReportsPE } from '@/lib/domain/queries';
import { formatDate } from '@/lib/format';
import { PageBody, PageHeader, Panel } from '@/components/shell/page';
import { DataTable, Dash } from '@/components/shell/data-table';
import { Pager, readPage } from '@/components/shell/pager';
import { StatusText } from '@/components/shell/status-text';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

const PE_STATUS_LABEL: Record<string, string> = {
    DRAFT: 'Draf',
    SUBMITTED: 'Terkirim',
    VERIFIED: 'Terverifikasi',
    REJECTED: 'Ditolak',
};

type PeRow = Awaited<ReturnType<typeof listReportsPE>>['rows'][number];

/** Index figures are ratios, so they are shown to two decimals and no unit. */
function index(value: string | null) {
    if (value === null) return <Dash />;
    return Number(value).toFixed(2);
}

export default async function PePage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const sp = await searchParams;
    const actor = await requireActor();
    const { rows, page, perPage, total } = await listReportsPE(
        actor,
        readPage(sp.page),
    );

    return (
        <PageBody>
            <PageHeader
                title="Penyelidikan epidemiologi"
                context="Laporan PE di wilayah kerja Anda."
            />
            <Panel title={`${total} laporan PE`}>
                <DataTable<PeRow>
                    rows={rows}
                    empty="Belum ada laporan PE di wilayah Anda."
                    caption="Daftar laporan penyelidikan epidemiologi"
                    columns={[
                        {
                            key: 'report',
                            header: 'No. laporan RS',
                            cell: (r) => (
                                <Link
                                    href={`/laporan/${r.reportRSId}`}
                                    className="underline decoration-[var(--control)] underline-offset-4 hover:decoration-[var(--text)]"
                                >
                                    {r.reportNumber}
                                </Link>
                            ),
                        },
                        {
                            key: 'date',
                            header: 'Tanggal PE',
                            align: 'right',
                            cell: (r) => (
                                <span className="whitespace-nowrap text-muted-foreground">
                                    {formatDate(r.peDate)}
                                </span>
                            ),
                        },
                        {
                            key: 'officer',
                            header: 'Petugas',
                            cell: (r) => r.officerName,
                        },
                        {
                            key: 'hi',
                            header: 'HI',
                            align: 'right',
                            cell: (r) => index(r.houseIndex),
                        },
                        {
                            key: 'ci',
                            header: 'CI',
                            align: 'right',
                            cell: (r) => index(r.containerIndex),
                        },
                        {
                            key: 'status',
                            header: 'Status',
                            cell: (r) => (
                                <StatusText
                                    tone={
                                        r.status === 'VERIFIED'
                                            ? 'good'
                                            : r.status === 'REJECTED'
                                              ? 'bad'
                                              : 'neutral'
                                    }
                                >
                                    {PE_STATUS_LABEL[r.status] ?? r.status}
                                </StatusText>
                            ),
                        },
                    ]}
                />
            </Panel>
            <Pager
                info={{ page, perPage, total }}
                label="laporan"
                buildHref={(n) => (n > 1 ? `/pe?page=${n}` : '/pe')}
            />
        </PageBody>
    );
}
