import { requireActor } from '@/lib/session';
import { dailySeries, listReports, reportCounts } from '@/lib/domain/reports';
import { formatNumber } from '@/lib/format';
import { PageHeader, Panel } from '@/components/shell/page';
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

    const maxCase = Math.max(...caseTotals.values(), 1);

    return (
        <div className="px-[var(--pad)] py-8">
            <PageHeader
                title="Analitik"
                context="Kasus DBD 14 hari terakhir."
            />

            <Panel title="Ringkasan">
                <dl className="grid grid-cols-2 gap-y-6 border-y border-border py-6 lg:grid-cols-4">
                    <Stat label="Total" value={counts.total} />
                    <Stat label="Menunggu tindakan" value={counts.needAction} />
                    <Stat
                        label="Terverifikasi bulan ini"
                        value={counts.verifiedThisMonth}
                    />
                    <Stat label="Lewat SLA" value={counts.slaOverdue} />
                </dl>
            </Panel>

            <Panel title="Kasus per hari">
                <DailySeriesChart data={series} />
            </Panel>

            <Panel title="Jenis kasus">
                <ul className="space-y-2">
                    {[...caseTotals.entries()].map(([kind, n]) => (
                        <li
                            key={kind}
                            className="flex items-center gap-3 text-[14px]"
                        >
                            <span className="w-28 shrink-0">{kind}</span>
                            <span className="h-2 flex-1 bg-[var(--raised)]">
                                <span
                                    className="block h-full bg-[var(--data)]"
                                    style={{ width: `${(n / maxCase) * 100}%` }}
                                />
                            </span>
                            <span data-numeric className="w-10 text-right">
                                {n}
                            </span>
                        </li>
                    ))}
                </ul>
            </Panel>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div>
            <dt className="text-[12px] text-muted-foreground">{label}</dt>
            <dd
                data-numeric
                className="mt-1 text-[30px] leading-none font-medium"
            >
                {formatNumber(value)}
            </dd>
        </div>
    );
}
