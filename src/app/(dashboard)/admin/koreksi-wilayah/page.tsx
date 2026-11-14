import Link from 'next/link';
import {
    AlertTriangle,
    CheckCircle2,
    MapPin,
    Stethoscope,
} from 'lucide-react';
import { requireRole } from '@/lib/session';
import { listReports } from '@/lib/domain/reports';
import { institutionChoices } from '@/lib/domain/master';
import { formatDate, formatNumber } from '@/lib/format';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { DataTable, Dash } from '@/components/shell/data-table';
import { Pager, readPage } from '@/components/shell/pager-view';
import { Stat } from '@/components/shell/stat';
import { StatusText } from '@/components/shell/status-text';
import { Button } from '@/components/ui/button';
import { ReassignControl } from './reassign-control';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

type ReportRow = Awaited<ReturnType<typeof listReports>>['rows'][number];

/**
 * The queue of reports whose assignment failed. It is a work list, not a
 * report: each row carries the two ways to resolve it, and both go through the
 * same auto-assign the submission path uses.
 */
export default async function KoreksiWilayahPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const sp = await searchParams;
    const actor = await requireRole('ADMIN', 'DINKES');
    const page = readPage(sp.page);

    const [{ rows, perPage, total }, institutions] = await Promise.all([
        listReports(actor, { status: 'SUBMITTED', page, perPage: 25 }),
        institutionChoices(),
    ]);

    const puskesmas = institutions
        .filter((i) => i.type === 'PUSKESMAS')
        .map((i) => ({ id: i.id, name: i.name }));

    const distinctKelurahan = new Set(
        rows.map((r) => r.kelurahan?.trim().toLowerCase()).filter(Boolean),
    ).size;

    return (
        <PageBody>
            <PageHeader
                title="Koreksi wilayah"
                context="Laporan yang belum menemukan puskesmas karena kelurahannya belum masuk wilayah kerja mana pun."
            />

            <PageContent className="space-y-5">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Stat
                        label="Laporan tertahan"
                        value={total}
                        signal={total > 0 ? 'warn' : 'good'}
                        hint={
                            total > 0
                                ? 'Menunggu penugasan ke puskesmas'
                                : 'Seluruh laporan sudah tersalurkan'
                        }
                        icon={total > 0 ? AlertTriangle : CheckCircle2}
                    />
                    <Stat
                        label="Kelurahan di halaman ini"
                        value={distinctKelurahan}
                        hint="Wilayah unik yang perlu pencocokan"
                        icon={MapPin}
                    />
                    <Stat
                        label="Puskesmas aktif"
                        value={puskesmas.length}
                        hint="Tersedia sebagai tujuan penugasan"
                        icon={Stethoscope}
                    />
                </dl>

                <Panel
                    title={`${formatNumber(total)} laporan tanpa puskesmas`}
                    className={
                        total > 0
                            ? 'border-l-[3px] border-l-[var(--warning)]'
                            : undefined
                    }
                    aside={
                        <div className="flex flex-wrap items-center gap-2">
                            <Button asChild variant="outline" size="sm">
                                <Link href="/admin/institusi">
                                    Atur wilayah institusi
                                </Link>
                            </Button>
                            <Button asChild variant="ghost" size="sm">
                                <Link href="/admin/kelurahan">
                                    Kelola kelurahan
                                </Link>
                            </Button>
                        </div>
                    }
                >
                    <DataTable<ReportRow>
                        rows={rows}
                        empty={
                            <div className="flex flex-col items-center gap-2 py-2">
                                <span className="grid size-10 place-items-center rounded-full bg-[var(--pill-positive-bg)] text-[var(--positive)]">
                                    <CheckCircle2
                                        className="size-5"
                                        aria-hidden
                                    />
                                </span>
                                <p className="text-[13.5px] font-medium text-foreground normal-case">
                                    Antrean bersih
                                </p>
                                <p className="max-w-[38ch] text-[12.5px] text-muted-foreground normal-case">
                                    Tidak ada laporan yang gagal ditugaskan.
                                    Semua kelurahan cocok dengan wilayah
                                    puskesmas.
                                </p>
                                <Button
                                    asChild
                                    size="xs"
                                    variant="outline"
                                    className="mt-1"
                                >
                                    <Link href="/admin/institusi">
                                        Lihat cakupan institusi
                                    </Link>
                                </Button>
                            </div>
                        }
                        caption="Laporan yang perlu koreksi wilayah"
                        minWidth={960}
                        columns={[
                            {
                                key: 'number',
                                header: 'No. laporan',
                                cell: (r) => (
                                    <span className="font-mono text-[13px] font-medium tabular-nums text-foreground">
                                        {r.reportNumber}
                                    </span>
                                ),
                            },
                            {
                                key: 'kel',
                                header: 'Kelurahan',
                                cell: (r) =>
                                    r.kelurahan ? (
                                        <StatusText tone="warn">
                                            {r.kelurahan}
                                        </StatusText>
                                    ) : (
                                        <Dash />
                                    ),
                            },
                            {
                                key: 'kec',
                                header: 'Kecamatan',
                                cell: (r) => r.kecamatan ?? <Dash />,
                            },
                            {
                                key: 'created',
                                header: 'Masuk',
                                cell: (r) => (
                                    <span className="whitespace-nowrap text-muted-foreground">
                                        {formatDate(r.createdAt)}
                                    </span>
                                ),
                            },
                            {
                                key: 'act',
                                header: 'Tindakan',
                                align: 'right',
                                cell: (r) => (
                                    <ReassignControl
                                        reportId={r.id}
                                        reportNumber={r.reportNumber}
                                        kelurahan={r.kelurahan}
                                        options={puskesmas}
                                    />
                                ),
                            },
                        ]}
                    />
                    <Pager
                        info={{ page, perPage, total }}
                        buildHref={(p) => `/admin/koreksi-wilayah?page=${p}`}
                        label="laporan"
                    />
                </Panel>
            </PageContent>
        </PageBody>
    );
}
