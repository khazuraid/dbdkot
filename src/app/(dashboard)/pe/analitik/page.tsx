import { Users, ClipboardCheck, BarChart2 } from 'lucide-react';
import { requireRole } from '@/lib/session';
import { peOfficerStats } from '@/lib/domain/queries';
import { formatNumber } from '@/lib/format';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { Stat, StatRow } from '@/components/shell/stat';
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
    const stats = await peOfficerStats(actor);

    const ranked: OfficerRow[] = stats.map((s) => ({
        id: s.officer,
        officer: s.officer,
        reports: s.reports,
        meanHi: s.meanHi,
        meanCi: s.meanCi,
    }));

    const totalReports = stats.reduce((a, s) => a + s.reports, 0);
    const avgPerOfficer =
        stats.length > 0 ? (totalReports / stats.length).toFixed(1) : '0';

    return (
        <PageBody>
            <PageHeader
                title="Analitik Penyelidikan Epidemiologi (PE)"
                context={`Rekapitulasi kinerja ${stats.length} petugas surveilans lapangan dan indeks jentik (HI/CI).`}
            />

            <PageContent className="space-y-6">
                <StatRow className="grid-cols-2 md:grid-cols-3 gap-3.5">
                    <Stat
                        label="Total Berkas PE Selesai"
                        value={formatNumber(totalReports)}
                        hint="Penyelidikan tuntas diverifikasi"
                        icon={ClipboardCheck}
                        signal="good"
                    />
                    <Stat
                        label="Petugas Lapangan Aktif"
                        value={formatNumber(stats.length)}
                        hint="Puskesmas & Dinkes"
                        icon={Users}
                    />
                    <Stat
                        label="Rata-rata Beban Tugas"
                        value={avgPerOfficer}
                        unit="berkas/petugas"
                        hint="Distribusi penugasan"
                        icon={BarChart2}
                    />
                </StatRow>

                <Panel
                    title="Beban & Kinerja per Petugas Lapangan"
                    subtitle="Daftar rekapitulasi jumlah laporan PE, rata-rata House Index (HI), dan Container Index (CI)"
                >
                    <DataTable<OfficerRow>
                        rows={ranked}
                        empty="Belum ada laporan PE pada periode ini."
                        caption="Beban laporan per petugas"
                        columns={[
                            {
                                key: 'officer',
                                header: 'Nama Petugas',
                                cell: (o) => (
                                    <span className="font-medium text-foreground">
                                        {o.officer}
                                    </span>
                                ),
                            },
                            {
                                key: 'n',
                                header: 'Laporan Dituntaskan',
                                align: 'right',
                                cell: (o) => (
                                    <span className="font-semibold text-foreground">
                                        {formatNumber(o.reports)}
                                    </span>
                                ),
                            },
                            {
                                key: 'hi',
                                header: 'Rata-rata HI (%)',
                                align: 'right',
                                cell: (o) =>
                                    o.meanHi ? (
                                        <span className="font-mono text-[13px]">
                                            {o.meanHi}%
                                        </span>
                                    ) : (
                                        <Dash />
                                    ),
                            },
                            {
                                key: 'ci',
                                header: 'Rata-rata CI (%)',
                                align: 'right',
                                cell: (o) =>
                                    o.meanCi ? (
                                        <span className="font-mono text-[13px]">
                                            {o.meanCi}%
                                        </span>
                                    ) : (
                                        <Dash />
                                    ),
                            },
                        ]}
                    />
                </Panel>
            </PageContent>
        </PageBody>
    );
}
