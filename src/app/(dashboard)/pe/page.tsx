import Link from 'next/link';
import { requireActor } from '@/lib/session';
import { listReportsPE } from '@/lib/domain/queries';
import { formatDate } from '@/lib/format';
import { PageHeader, Panel, Empty } from '@/components/shell/page';
import { Pager, readPage } from '@/components/shell/pager';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

const PE_STATUS_LABEL: Record<string, string> = {
    DRAFT: 'Draf',
    SUBMITTED: 'Terkirim',
    VERIFIED: 'Terverifikasi',
    REJECTED: 'Ditolak',
};

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
        <div className="px-[var(--pad)] py-8">
            <PageHeader
                title="Penyelidikan epidemiologi"
                context="Laporan PE di wilayah kerja Anda."
            />
            <Panel title={`${total} laporan PE`}>
                {rows.length === 0 ? (
                    <Empty>Belum ada laporan PE.</Empty>
                ) : (
                    <table className="w-full border-collapse text-[14px]">
                        <thead>
                            <tr className="border-y border-border text-left text-[12px] text-muted-foreground">
                                <th className="py-2 font-normal">
                                    No. laporan RS
                                </th>
                                <th className="py-2 font-normal">Tanggal PE</th>
                                <th className="py-2 font-normal">Petugas</th>
                                <th className="py-2 text-right font-normal">
                                    HI
                                </th>
                                <th className="py-2 text-right font-normal">
                                    CI
                                </th>
                                <th className="py-2 font-normal">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {rows.map((r) => (
                                <tr
                                    key={r.id}
                                    className="h-[var(--row-height)]"
                                >
                                    <td className="py-2">
                                        <Link
                                            href={`/laporan/${r.reportRSId}`}
                                            className="underline"
                                        >
                                            {r.reportNumber}
                                        </Link>
                                    </td>
                                    <td data-numeric className="py-2">
                                        {formatDate(r.peDate)}
                                    </td>
                                    <td className="py-2">{r.officerName}</td>
                                    <td
                                        data-numeric
                                        className="py-2 text-right"
                                    >
                                        {r.houseIndex ?? '—'}
                                    </td>
                                    <td
                                        data-numeric
                                        className="py-2 text-right"
                                    >
                                        {r.containerIndex ?? '—'}
                                    </td>
                                    <td className="py-2">
                                        {PE_STATUS_LABEL[r.status]}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Panel>
            <Pager
                info={{ page, perPage, total }}
                label="laporan"
                buildHref={(n) => (n > 1 ? `/pe?page=${n}` : '/pe')}
            />
        </div>
    );
}
