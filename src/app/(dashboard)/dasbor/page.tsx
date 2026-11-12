import Link from 'next/link';
import { requireActor } from '@/lib/session';
import { dailySeries, reportCounts } from '@/lib/domain/reports';
import { formatNumber } from '@/lib/format';
import { DailySeriesChart } from '@/components/reports/daily-series-chart';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

export default async function DasborPage() {
    const actor = await requireActor();
    const [counts, series] = await Promise.all([
        reportCounts(actor),
        dailySeries(actor),
    ]);

    return (
        <div className="px-[var(--pad)] py-8">
            <header>
                <h1 className="text-[24px] font-medium tracking-tight">
                    Dasbor
                </h1>
                <p className="mt-1 text-[14px] text-muted-foreground">
                    {counts.needAction > 0
                        ? `${formatNumber(counts.needAction)} laporan menunggu tindakan.`
                        : 'Tidak ada laporan yang menunggu tindakan.'}
                </p>
            </header>

            {/* KPIs are type, not tiles: no icon in a circle, no sparkline. */}
            <dl className="mt-8 grid grid-cols-2 gap-y-6 border-y border-border py-6 lg:grid-cols-4">
                <Metric label="Laporan bulan ini" value={counts.total} />
                <Metric label="Menunggu tindakan" value={counts.needAction} />
                <Metric
                    label="Terverifikasi"
                    value={counts.verifiedThisMonth}
                />
                <Metric
                    label="Lewat SLA 4 hari"
                    value={counts.slaOverdue}
                    signal={counts.slaOverdue > 0 ? 'bad' : undefined}
                />
            </dl>

            <section className="mt-10">
                <div className="flex items-baseline justify-between">
                    <h2 className="text-[16px] font-medium">
                        Laporan masuk, 14 hari
                    </h2>
                    <Link
                        href="/laporan"
                        className="text-[13px] text-muted-foreground underline"
                    >
                        Semua laporan
                    </Link>
                </div>

                <div className="mt-4">
                    <DailySeriesChart data={series} />
                </div>
            </section>

            <section className="mt-10">
                <h2 className="text-[16px] font-medium">Tindakan berikutnya</h2>
                <ul className="divide-y divide-border border-t border-border">
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
                        />
                    )}
                    <Action
                        href="/laporan/baru"
                        title="Laporkan kasus baru"
                        detail="Rumah sakit"
                    />
                </ul>
            </section>
        </div>
    );
}

function Metric({
    label,
    value,
    signal,
}: {
    label: string;
    value: number;
    signal?: 'bad';
}) {
    return (
        <div>
            <dt className="text-[12px] text-muted-foreground">{label}</dt>
            <dd
                data-numeric
                className={
                    signal === 'bad'
                        ? 'mt-1 text-[30px] leading-none font-medium text-[var(--negative)]'
                        : 'mt-1 text-[30px] leading-none font-medium'
                }
            >
                {formatNumber(value)}
            </dd>
        </div>
    );
}

function Action({
    href,
    title,
    detail,
}: {
    href: string;
    title: string;
    detail: string;
}) {
    return (
        <li>
            <Link
                href={href}
                className="flex items-center justify-between px-1 py-3 hover:bg-[var(--raised)]"
            >
                <span className="text-[14px]">{title}</span>
                <span className="text-[13px] text-muted-foreground">
                    {detail}
                </span>
            </Link>
        </li>
    );
}
