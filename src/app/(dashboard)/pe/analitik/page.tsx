import { requireRole } from '@/lib/session';
import { listReportsPE } from '@/lib/domain/queries';
import { PageHeader, Panel, Empty } from '@/components/shell/page';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

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

    const ranked = [...byOfficer.entries()].sort((a, b) => b[1].n - a[1].n);

    return (
        <div className="px-[var(--pad)] py-8">
            <PageHeader
                title="Analitik PE"
                context={`${rows.length} laporan PE.`}
            />

            <Panel title="Beban per petugas">
                {ranked.length === 0 ? (
                    <Empty>Belum ada laporan PE.</Empty>
                ) : (
                    <table className="w-full border-collapse text-[14px]">
                        <thead>
                            <tr className="border-y border-border text-left text-[12px] text-muted-foreground">
                                <th className="py-2 font-normal">Petugas</th>
                                <th className="py-2 text-right font-normal">
                                    Laporan
                                </th>
                                <th className="py-2 text-right font-normal">
                                    Rata HI
                                </th>
                                <th className="py-2 text-right font-normal">
                                    Rata CI
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {ranked.map(([officer, entry]) => (
                                <tr
                                    key={officer}
                                    className="h-[var(--row-height)]"
                                >
                                    <td className="py-2">{officer}</td>
                                    <td
                                        data-numeric
                                        className="py-2 text-right"
                                    >
                                        {entry.n}
                                    </td>
                                    <td
                                        data-numeric
                                        className="py-2 text-right"
                                    >
                                        {mean(entry.hi)?.toFixed(2) ?? '—'}
                                    </td>
                                    <td
                                        data-numeric
                                        className="py-2 text-right"
                                    >
                                        {mean(entry.ci)?.toFixed(2) ?? '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Panel>
        </div>
    );
}
