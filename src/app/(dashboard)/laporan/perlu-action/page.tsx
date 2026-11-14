import { requireActor } from '@/lib/session';
import { listReports } from '@/lib/domain/reports';
import { needActionStatusesFor } from '@/lib/domain/report-labels';
import { formatNumber } from '@/lib/format';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { Pager, readPage } from '@/components/shell/pager-view';
import { ReportTable } from '@/components/reports/report-table';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

/** Copy stays per-role here; the status list itself lives in report-labels.ts. */
const QUEUE: Record<string, { title: string; context: string }> = {
    RUMAH_SAKIT: {
        title: 'Perlu tindakan',
        context: 'Ditolak puskesmas atau dikembalikan Dinas Kesehatan.',
    },
    PUSKESMAS: {
        title: 'Perlu tindakan',
        context:
            'Laporan yang ditugaskan ke puskesmas Anda dan belum ditinjau.',
    },
    DINKES: {
        title: 'Perlu tindakan',
        context: 'Penyelidikan epidemiologi selesai dan menunggu verifikasi.',
    },
    ADMIN: {
        title: 'Perlu tindakan',
        context: 'Laporan belum ditugaskan ke puskesmas mana pun.',
    },
};

export default async function PerluActionPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const sp = await searchParams;
    const actor = await requireActor();
    const queue = QUEUE[actor.role] ?? {
        title: 'Perlu tindakan',
        context: 'Laporan yang menunggu tindakan Anda.',
    };
    const statuses = [...needActionStatusesFor(actor.role)];
    const page = readPage(sp.page);
    const { rows, perPage, total } = await listReports(actor, {
        statuses,
        page,
        perPage: 25,
    });

    return (
        <PageBody>
            <PageHeader
                title={queue.title}
                context={`${queue.context} ${formatNumber(total)} laporan.`}
            />
            <PageContent>
                <Panel title={total === 0 ? 'Tidak ada antrian' : 'Antrian'}>
                    <ReportTable
                        rows={rows}
                        empty="Tidak ada yang menunggu tindakan."
                    />
                    <Pager
                        info={{ page, perPage, total }}
                        label="laporan"
                        buildHref={(n) =>
                            n > 1
                                ? `/laporan/perlu-action?page=${n}`
                                : '/laporan/perlu-action'
                        }
                    />
                </Panel>
            </PageContent>
        </PageBody>
    );
}
