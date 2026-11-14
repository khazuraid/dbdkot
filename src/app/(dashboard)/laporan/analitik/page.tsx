import { requireActor } from '@/lib/session';
import { caseCounts, dailySeries, reportCounts } from '@/lib/domain/reports';
import { CASE_TYPE_LABEL } from '@/lib/domain/report-labels';
import { formatNumber } from '@/lib/format';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { Stat, StatRow } from '@/components/shell/stat';
import { DailySeriesChart } from '@/components/reports/daily-series-chart';
import { DistributionChart } from '@/components/reports/distribution-chart';
import { FacilityMapPanel } from '@/components/reports/facility-map-panel';
import {
    caseGeoPoints,
    facilityPoints,
    kelurahanZones,
    uncoveredKelurahan,
} from '@/lib/domain/map-data';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

/** Aggregates only: no PII reaches this page, by construction. */
export default async function AnalitikPage() {
    const actor = await requireActor();
    const [counts, series, byCase, points, zones, gapData, geoCases] =
        await Promise.all([
            reportCounts(actor),
            dailySeries(actor),
            caseCounts(actor),
            facilityPoints(actor),
            kelurahanZones(actor),
            uncoveredKelurahan(actor),
            caseGeoPoints(actor),
        ]);

    const gaps = gapData.rows;
    const totalCased = byCase.reduce((sum, item) => sum + item.n, 0);
    const distributionItems = byCase.map(({ caseType, n }) => ({
        key: caseType,
        label:
            CASE_TYPE_LABEL[caseType as keyof typeof CASE_TYPE_LABEL] ??
            caseType,
        count: n,
    }));

    return (
        <PageBody>
            <PageHeader
                title="Analitik"
                context={`${formatNumber(totalCased)} laporan dalam ${series.length} hari terakhir.`}
            />

            <PageContent>
                <StatRow>
                    <Stat label="Total" value={counts.total} />
                    <Stat
                        label="Menunggu tindakan"
                        value={counts.needAction}
                        signal={counts.needAction > 0 ? 'warn' : undefined}
                    />
                    <Stat
                        label="Terverifikasi bulan ini"
                        value={counts.verifiedThisMonth}
                        signal={counts.verifiedThisMonth > 0 ? 'good' : undefined}
                    />
                    <Stat
                        label="Lewat SLA"
                        value={counts.slaOverdue}
                        signal={counts.slaOverdue > 0 ? 'bad' : undefined}
                    />
                </StatRow>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
                    <Panel
                        padded
                        title="Kasus per hari"
                        subtitle="Volume laporan masuk 14 hari terakhir"
                    >
                        <DailySeriesChart data={series} />
                    </Panel>

                    <Panel
                        padded
                        title="Jenis kasus"
                        subtitle="Distribusi berdasarkan klasifikasi diagnosis"
                    >
                        <DistributionChart
                            items={distributionItems}
                            emptyText="Belum ada laporan pada periode ini."
                        />
                    </Panel>
                </div>

                <Panel
                    padded
                    title="Sebaran fasilitas & zonasi"
                    subtitle="Ukuran lingkaran mengikuti jumlah laporan tiap fasilitas; garis putus-putus menandai zonasi kelurahan"
                    aside={
                        <span
                            data-numeric
                            className="text-[12px] text-muted-foreground tabular-nums"
                        >
                            {formatNumber(points.length)} fasilitas ·{' '}
                            {formatNumber(zones.length)} zonasi ·{' '}
                            {formatNumber(geoCases.length)} titik kasus
                        </span>
                    }
                >
                    {points.length === 0 &&
                    zones.length === 0 &&
                    geoCases.length === 0 ? (
                        <p className="py-6 text-center text-[13px] text-muted-foreground">
                            Belum ada koordinat fasilitas atau zonasi kelurahan
                            yang tersimpan. Atur zonasi peta di Admin /
                            Kelurahan.
                        </p>
                    ) : (
                        <FacilityMapPanel
                            points={points}
                            zones={zones}
                            cases={geoCases}
                            height={360}
                        />
                    )}
                </Panel>

                {gaps.length > 0 && (
                    <Panel
                        title="Kelurahan belum terpetakan"
                        subtitle="Laporan tertahan karena kelurahan belum masuk cakupan puskesmas mana pun"
                        aside={
                            <span
                                data-numeric
                                className="text-[12px] font-medium text-[var(--pill-warning-ink)] tabular-nums"
                            >
                                {formatNumber(gapData.total)} kelurahan
                            </span>
                        }
                    >
                        <div className="overflow-x-auto">
                            <table className="ledger">
                                <thead>
                                    <tr>
                                        <th scope="col">Kelurahan</th>
                                        <th scope="col">Kecamatan</th>
                                        <th scope="col" className="text-right">
                                            Laporan tertahan
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gaps.map((g) => (
                                        <tr
                                            key={`${g.kecamatan ?? ''}-${g.kelurahan}`}
                                        >
                                            <td className="font-medium">
                                                {g.kelurahan}
                                            </td>
                                            <td className="text-muted-foreground">
                                                {g.kecamatan ?? '-'}
                                            </td>
                                            <td className="num font-medium">
                                                {formatNumber(g.n)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {gapData.total > gaps.length && (
                            <p className="border-t border-[var(--rule)] px-4 py-2.5 text-[12px] text-muted-foreground">
                                Menampilkan {formatNumber(gaps.length)} dari{' '}
                                {formatNumber(gapData.total)} kelurahan dengan
                                laporan terbanyak.
                            </p>
                        )}
                    </Panel>
                )}
            </PageContent>
        </PageBody>
    );
}
