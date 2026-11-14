import Link from 'next/link';
import { FileDown } from 'lucide-react';
import { requireActor } from '@/lib/session';
import { listReportsPE } from '@/lib/domain/queries';
import { formatDate } from '@/lib/format';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { DataTable, Dash } from '@/components/shell/data-table';
import { Pager, readPage } from '@/components/shell/pager-view';
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

            <PageContent>
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
                                        className="font-mono text-[13px] font-medium text-[var(--accent)] underline-offset-4 hover:underline"
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
                                                  : r.status === 'SUBMITTED'
                                                    ? 'warn'
                                                    : 'neutral'
                                        }
                                    >
                                        {PE_STATUS_LABEL[r.status] ?? r.status}
                                    </StatusText>
                                ),
                            },
                            {
                                key: 'export',
                                header: 'Export Berkas',
                                align: 'right',
                                cell: (r) => (
                                    <div className="inline-flex items-center justify-end gap-2">
                                        <a
                                            href={`/api/pdf/pe-lengkap/${r.reportRSId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11.5px] font-medium text-foreground transition-colors hover:bg-[var(--raised)]"
                                        >
                                            <FileDown className="size-3 text-[var(--accent)]" aria-hidden />
                                            PDF Lengkap
                                        </a>
                                        <a
                                            href={`/api/export/pe/${r.reportRSId}/excel`}
                                            download
                                            className="inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11.5px] font-medium text-foreground transition-colors hover:bg-[var(--raised)]"
                                        >
                                            <FileDown className="size-3" aria-hidden />
                                            Excel
                                        </a>
                                    </div>
                                ),
                            },
                        ]}
                    />
                    <Pager
                        info={{ page, perPage, total }}
                        label="laporan"
                        buildHref={(n) => (n > 1 ? `/pe?page=${n}` : '/pe')}
                    />
                </Panel>
            </PageContent>
        </PageBody>
    );
}
