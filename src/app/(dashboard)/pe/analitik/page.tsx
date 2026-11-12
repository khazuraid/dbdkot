import { requireRole } from '@/lib/session';
import { listReportsPE } from '@/lib/domain/queries';
import { PageBody, PageHeader, Panel } from '@/components/shell/page';
import { DataTable, Dash } from '@/components/shell/data-table';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

type OfficerRow = {
    id: string;
    officer: string;
    reports: number;
    meanHi: string | null;
    meanCi: string | null;
};

/** Aggregate indices only. The per-household breakdown lives in the PE detail. */
export default async function AnalitikPePage() {
    const actor = await requireRole('DINKES', 'ADMIN');
    // Aggregates need the whole window, not one page; 100 is the hard cap.
    const { rows } = await listReportsPE(actor, 1, 100);

    const byOfficer = new Map<
        string,
        { n: number; hi: number[]; ci: number[] }
    >();
    for (const r of rows) {
        const entry = byOfficer.get(r.officerName) ?? { n: 0, hi: [], ci: [] };
        entry.n += 1;
        if (r.houseIndex) entry.hi.push(Number(r.houseIndex));
        if (r.containerIndex) entry.ci.push(Number(r.containerIndex));
        byOfficer.set(r.officerName, entry);
    }

    const mean = (xs: number[]) =>
        xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

    const ranked: OfficerRow[] = [...byOfficer.entries()]
        .sort((a, b) => b[1].n - a[1].n)
        .map(([officer, entry]) => ({
            id: officer,
            officer,
            reports: entry.n,
            meanHi: mean(entry.hi)?.toFixed(2) ?? null,
            meanCi: mean(entry.ci)?.toFixed(2) ?? null,
        }));

    const totalHi = rows.filter((r) => r.houseIndex).length;

    return (
        <PageBody>
            <PageHeader
                title="Analitik PE"
                context={`${rows.length} laporan PE, ${totalHi} dengan angka HI.`}
            />

            <Panel title="Beban per petugas">
                <DataTable<OfficerRow>
                    rows={ranked}
                    empty="Belum ada laporan PE pada periode ini."
                    caption="Beban laporan per petugas"
                    columns={[
                        {
                            key: 'officer',
                            header: 'Petugas',
                            cell: (o) => o.officer,
                        },
                        {
                            key: 'n',
                            header: 'Laporan',
                            align: 'right',
                            cell: (o) => o.reports,
                        },
                        {
                            key: 'hi',
                            header: 'Rata HI',
                            align: 'right',
                            cell: (o) => o.meanHi ?? <Dash />,
                        },
                        {
                            key: 'ci',
                            header: 'Rata CI',
                            align: 'right',
                            cell: (o) => o.meanCi ?? <Dash />,
                        },
                    ]}
                />
            </Panel>
        </PageBody>
    );
}
