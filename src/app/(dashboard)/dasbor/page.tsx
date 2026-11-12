import Link from 'next/link';
import { requireActor } from '@/lib/session';
import { dailySeries, reportCounts } from '@/lib/domain/reports';
import { formatNumber } from '@/lib/format';
import { PageBody, PageHeader, Panel } from '@/components/shell/page';
import { Stat, StatRow } from '@/components/shell/stat';
import { DailySeriesChart } from '@/components/reports/daily-series-chart';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

export default async function DasborPage() {
    const actor = await requireActor();
    const [counts, series] = await Promise.all([
        reportCounts(actor),
        dailySeries(actor),
    ]);
    const latest = series.at(-1)?.n ?? 0;

    return (
        <PageBody>
            <PageHeader
                title="Dasbor"
                context={
                    counts.needAction > 0
                        ? `${formatNumber(counts.needAction)} laporan menunggu tindakan.`
                        : 'Tidak ada laporan yang menunggu tindakan.'
                }
            />

            {/* KPIs are type, not tiles: no icon in a circle, no sparkline. */}
            <StatRow>
                <Stat label="Laporan bulan ini" value={counts.total} />
                <Stat label="Menunggu tindakan" value={counts.needAction} />
                <Stat label="Terverifikasi" value={counts.verifiedThisMonth} />
                <Stat
                    label="Lewat SLA 4 hari"
                    value={counts.slaOverdue}
                    signal={counts.slaOverdue > 0 ? 'bad' : undefined}
                />
            </StatRow>

            <Panel
                title="Laporan masuk, 14 hari"
                aside={
                    <span className="text-[12px] text-muted-foreground">
                        {latest > 0
                            ? `${formatNumber(latest)} laporan hari ini`
                            : 'Belum ada laporan hari ini'}
                    </span>
                }
            >
                <DailySeriesChart data={series} />
                <p className="mt-3">
                    <Link
                        href="/laporan"
                        className="text-[13px] text-muted-foreground underline decoration-[var(--control)] underline-offset-4 hover:text-foreground"
                    >
                        Semua laporan
                    </Link>
                </p>
            </Panel>

            <Panel title="Tindakan berikutnya">
                <ul className="divide-y divide-[var(--rule)]">
                    {counts.needAction > 0 && (
                        <Action
                            href="/laporan/perlu-action"
                            title="Tinjau laporan yang menunggu"
                            detail={`${formatNumber(counts.needAction)} laporan`}
                        />
                    )}
                    {counts.slaOverdue > 0 && (
                        <Action
                            href="/laporan?status=ASSIGNED"
                            title="Tindak lanjuti laporan lewat SLA"
                            detail={`${formatNumber(counts.slaOverdue)} laporan`}
                            urgent
                        />
                    )}
                    <Action
                        href="/laporan/baru"
                        title="Laporkan kasus baru"
                        detail="Rumah sakit"
                    />
                </ul>
                {counts.needAction === 0 && counts.slaOverdue === 0 && (
                    <p className="py-3 text-[14px] text-muted-foreground">
                        Tidak ada yang perlu ditindaklanjuti saat ini.
                    </p>
                )}
            </Panel>
        </PageBody>
    );
}

function Action({
    href,
    title,
    detail,
    urgent,
}: {
    href: string;
    title: string;
    detail: string;
    urgent?: boolean;
}) {
    return (
        <li>
            <Link
                href={href}
                className="-mx-2 flex items-center justify-between gap-4 rounded-[var(--radius-control)] px-2 py-3 transition-colors hover:bg-[var(--raised)]"
            >
                <span className="text-[14px]">{title}</span>
                <span
                    className={
                        urgent
                            ? 'shrink-0 text-[13px] tabular-nums text-[var(--negative)]'
                            : 'shrink-0 text-[13px] tabular-nums text-muted-foreground'
                    }
                >
                    {detail}
                </span>
            </Link>
        </li>
    );
}
