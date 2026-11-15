import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { listPendingVerifications } from '@/lib/domain/queries';
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
import { ExternalLink, FileText } from 'lucide-react';

export const instant = false;

type VerificationRow = Awaited<
    ReturnType<typeof listPendingVerifications>
>['rows'][number];

/**
 * Dinkes verification queue: PE finished, waiting on the final decision.
 * Displays full PE field results (ABJ, entomology indicators, fogging recommendation)
 * and provides upload controls for official PE reports and field photos.
 */
export default async function VerifikasiPePage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const sp = await searchParams;
    await requireRole('DINKES', 'ADMIN');
    const page = readPage(sp.page);
    const { rows, perPage, total } = await listPendingVerifications(page, 25);

    return (
        <PageBody>
            <PageHeader
                title="Verifikasi PE"
                context={`${total} laporan selesai PE menunggu keputusan verifikasi Dinkes.`}
            />

            <PageContent>
                <Panel
                    title="Antrian Verifikasi"
                    aside={
                        <Link
                            href="/pe"
                            className="text-[12.5px] text-muted-foreground underline decoration-[var(--control)] underline-offset-4 hover:text-foreground"
                        >
                            Semua laporan PE
                        </Link>
                    }
                >
                    <DataTable<VerificationRow>
                        rows={rows}
                        empty="Tidak ada laporan PE yang menunggu verifikasi saat ini."
                        caption="Antrian verifikasi laporan hasil PE"
                        minWidth={1050}
                        columns={[
                            {
                                key: 'number',
                                header: 'No. laporan',
                                cell: (r) => (
                                    <div className="space-y-0.5">
                                        <Link
                                            href={`/laporan/${r.id}`}
                                            className="font-mono text-[13px] font-medium text-[var(--accent)] tabular-nums underline-offset-4 hover:underline"
                                        >
                                            {r.reportNumber}
                                        </Link>
                                        <p className="text-[11px] text-muted-foreground">
                                            {formatDate(r.createdAt)}
                                        </p>
                                    </div>
                                ),
                            },
                            {
                                key: 'case',
                                header: 'Diagnosis / Wilayah',
                                cell: (r) => (
                                    <div className="space-y-0.5">
                                        <p className="font-medium text-foreground">
                                            {CASE_TYPE_LABEL[r.caseType] ?? r.caseType}
                                        </p>
                                        <p className="text-[11.5px] text-muted-foreground">
                                            {r.kelurahan ?? <Dash />}
                                        </p>
                                    </div>
                                ),
                            },
                            {
                                key: 'officer',
                                header: 'Petugas & Tgl PE',
                                cell: (r) => (
                                    <div className="space-y-0.5">
                                        <p className="font-medium text-foreground">
                                            {r.officerName || '-'}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {r.peDate ? formatDate(r.peDate) : '-'}
                                        </p>
                                    </div>
                                ),
                            },
                            {
                                key: 'ento',
                                header: 'Hasil ABJ & Jentik',
                                cell: (r) => {
                                    const abjNum = r.abj ? Number(r.abj) : null;
                                    const isAbjSafe = abjNum !== null && abjNum >= 95;
                                    return (
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                                                        isAbjSafe
                                                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                            : 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-300'
                                                    }`}
                                                >
                                                    ABJ: {r.abj ? `${r.abj}%` : '-'}
                                                </span>
                                            </div>
                                            <p className="text-[10.5px] text-muted-foreground">
                                                HI: {r.houseIndex ? `${r.houseIndex}%` : '-'} | CI: {r.containerIndex ? `${r.containerIndex}%` : '-'}
                                            </p>
                                        </div>
                                    );
                                },
                            },
                            {
                                key: 'fogging',
                                header: 'Rekomendasi Fogging',
                                cell: (r) => (
                                    <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                            r.foggingRecommended
                                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                                                : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                                        }`}
                                    >
                                        {r.foggingRecommended ? 'Perlu Fogging' : 'Tidak Perlu'}
                                    </span>
                                ),
                            },
                            {
                                key: 'full_pe',
                                header: 'Hasil PE Full',
                                cell: (r) =>
                                    r.peId ? (
                                        <Link
                                            href={`/pe/${r.peId}`}
                                            target="_blank"
                                            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline"
                                        >
                                            <FileText className="h-3.5 w-3.5" />
                                            Detail PE
                                            <ExternalLink className="h-3 w-3" />
                                        </Link>
                                    ) : (
                                        <Dash />
                                    ),
                            },
                            {
                                key: 'act',
                                header: 'Keputusan',
                                cell: (r) => (
                                    <VerifyControl
                                        reportId={r.id}
                                        reportNumber={r.reportNumber}
                                        peSummary={{
                                            peId: r.peId,
                                            officerName: r.officerName,
                                            peDate: r.peDate,
                                            abj: r.abj,
                                            houseIndex: r.houseIndex,
                                            containerIndex: r.containerIndex,
                                            transmissionRisk: r.transmissionRisk,
                                            foggingRecommended: r.foggingRecommended,
                                            conclusion: r.conclusion,
                                        }}
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
