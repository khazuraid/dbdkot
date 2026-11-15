import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock, FileDown } from 'lucide-react';
import { requireActor } from '@/lib/session';
import { listReportsPE } from '@/lib/domain/queries';
import { formatDate } from '@/lib/format';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { Stat, StatRow } from '@/components/shell/stat';
import { DataTable, Dash } from '@/components/shell/data-table';
import { Pager, readPage } from '@/components/shell/pager-view';
import { StatusText } from '@/components/shell/status-text';
import { PeActionToolbar } from './pe-actions';

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

    const verifiedCount = rows.filter((r) => r.status === 'VERIFIED').length;
    const pendingCount = rows.filter((r) => r.status === 'SUBMITTED').length;
    const rejectedCount = rows.filter((r) => r.status === 'REJECTED').length;

    return (
        <PageBody>
            <PageHeader
                title="Penyelidikan epidemiologi"
                context="Laporan PE di wilayah kerja Anda."
            />

            <PageContent>
                <StatRow className="grid-cols-2 lg:grid-cols-4">
                    <Stat
                        label="Total Laporan PE"
                        value={total}
                        signal="neutral"
                        hint="Data tersimpan di sistem"
                        icon={ClipboardCheck}
                    />
                    <Stat
                        label="Terverifikasi Dinkes"
                        value={verifiedCount}
                        signal="good"
                        hint="Investigasi tuntas"
                        icon={CheckCircle2}
                    />
                    <Stat
                        label="Menunggu Verifikasi"
                        value={pendingCount}
                        signal={pendingCount > 0 ? 'warn' : 'good'}
                        hint={pendingCount > 0 ? 'Perlu tindakan verifikator' : 'Nol antrian verifikasi'}
                        icon={Clock}
                    />
                    <Stat
                        label="Perlu Revisi / Ditolak"
                        value={rejectedCount}
                        signal={rejectedCount > 0 ? 'bad' : 'neutral'}
                        hint={rejectedCount > 0 ? 'Perbaiki temuan lapangan' : 'Nol laporan ditolak'}
                        icon={AlertTriangle}
                    />
                </StatRow>

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
                                cell: (r) => (
                                    <div>
                                        <div className="font-medium text-foreground">{r.officerName}</div>
                                        {r.kelurahan && (
                                            <div className="text-[11px] text-muted-foreground">Kel. {r.kelurahan}</div>
                                        )}
                                    </div>
                                ),
                            },
                            {
                                key: 'abj',
                                header: 'ABJ',
                                align: 'right',
                                cell: (r) => {
                                    if (!r.abj) return <Dash />;
                                    const val = Number(r.abj);
                                    return (
                                        <span
                                            className={`font-mono text-[12.5px] font-semibold tabular-nums ${
                                                val >= 95 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                            }`}
                                        >
                                            {val.toFixed(1)}%
                                        </span>
                                    );
                                },
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
                                key: 'risk',
                                header: 'Hasil / Fogging',
                                cell: (r) => (
                                    <span
                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                            r.foggingRecommended
                                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                        }`}
                                    >
                                        {r.foggingRecommended ? 'Positif Fogging' : 'Bebas Jentik / Aman'}
                                    </span>
                                ),
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
                            {
                                key: 'actions',
                                header: 'Aksi',
                                align: 'right',
                                cell: (r) => (
                                    <div className="flex items-center justify-end">
                                        <PeActionToolbar
                                            peId={r.id}
                                            reportNumber={r.reportNumber}
                                            showDetail={true}
                                        />
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
