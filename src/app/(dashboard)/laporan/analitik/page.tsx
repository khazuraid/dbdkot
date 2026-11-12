import { requireActor } from '@/lib/session';
import { dailySeries, listReports, reportCounts } from '@/lib/domain/reports';
import { CASE_TYPE_LABEL } from '@/lib/domain/report-labels';
import { PageBody, PageHeader, Panel } from '@/components/shell/page';
import { Stat, StatRow } from '@/components/shell/stat';
import { DailySeriesChart } from '@/components/reports/daily-series-chart';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

/** Aggregates only: no PII reaches this page, by construction. */
export default async function AnalitikPage() {
    const actor = await requireActor();
    const [counts, series, byCase] = await Promise.all([
        reportCounts(actor),
        dailySeries(actor),
        listReports(actor, { perPage: 100 }),
    ]);

    const caseTotals = new Map<string, number>();
    for (const row of byCase.rows) {
        caseTotals.set(row.caseType, (caseTotals.get(row.caseType) ?? 0) + 1);
    }

    // One scale for every bar, so their lengths can be compared.
    const maxCase = Math.max(...caseTotals.values(), 1);
    const totalCased = [...caseTotals.values()].reduce((a, b) => a + b, 0);

    return (
        <PageBody>
            <PageHeader
                title="Analitik"
                context={`${totalCased} laporan dalam ${series.length} hari terakhir.`}
            />

            <StatRow>
                <Stat label="Total" value={counts.total} />
                <Stat label="Menunggu tindakan" value={counts.needAction} />
                <Stat
                    label="Terverifikasi bulan ini"
                    value={counts.verifiedThisMonth}
                />
                <Stat label="Lewat SLA" value={counts.slaOverdue} />
            </StatRow>

            <Panel title="Kasus per hari">
                <DailySeriesChart data={series} />
            </Panel>

            <Panel title="Jenis kasus">
                {caseTotals.size === 0 ? (
                    <p className="py-3 text-[14px] text-muted-foreground">
                        Belum ada laporan pada periode ini.
                    </p>
                ) : (
                    <ul className="space-y-2.5">
                        {[...caseTotals.entries()]
                            .sort((a, b) => b[1] - a[1])
                            .map(([kind, n]) => (
                                <li
                                    key={kind}
                                    className="grid grid-cols-[minmax(0,9rem)_1fr_2rem] items-center gap-3 text-[14px]"
                                >
                                    <span className="truncate">
                                        {CASE_TYPE_LABEL[
                                            kind as keyof typeof CASE_TYPE_LABEL
                                        ] ?? kind}
                                    </span>
                                    <span className="h-2 rounded-sm bg-[var(--raised)]">
                                        <span
                                            className="block h-full rounded-sm bg-[var(--data)]"
                                            style={{
                                                width: `${(n / maxCase) * 100}%`,
                                            }}
                                        />
                                    </span>
                                    <span className="text-right tabular-nums">
                                        {n}
                                    </span>
                                </li>
                            ))}
                    </ul>
                )}
            </Panel>
        </PageBody>
    );
}
