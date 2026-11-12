import { requireActor } from '@/lib/session';
import { listReports, type ReportStatus } from '@/lib/domain/reports';
import { formatNumber } from '@/lib/format';
import { PageHeader, Panel } from '@/components/shell/page';
import { ReportTable } from '@/components/reports/report-table';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

/** What "needs action" means depends entirely on who is looking at it. */
const QUEUE: Record<
    string,
    { title: string; context: string; statuses: ReportStatus[] }
> = {
    RUMAH_SAKIT: {
        title: 'Perlu action',
        context: 'Ditolak puskesmas atau dikembalikan Dinas Kesehatan.',
        statuses: ['PUSKESMAS_REJECTED', 'REJECTED'],
    },
    PUSKESMAS: {
        title: 'Perlu action',
        context:
            'Laporan yang ditugaskan ke puskesmas Anda dan belum ditinjau.',
        statuses: ['ASSIGNED'],
    },
    DINKES: {
        title: 'Perlu action',
        context: 'Penyelidikan epidemiologi selesai dan menunggu verifikasi.',
        statuses: ['PE_COMPLETED'],
    },
    ADMIN: {
        title: 'Perlu action',
        context: 'Laporan belum ditugaskan ke puskesmas mana pun.',
        statuses: ['SUBMITTED'],
    },
};

export default async function PerluActionPage() {
    const actor = await requireActor();
    const queue = QUEUE[actor.role];
    const { rows } = await listReports(actor, {
        statuses: queue.statuses,
        perPage: 100,
    });

    return (
        <div className="px-[var(--pad)] py-8">
            <PageHeader title={queue.title} context={queue.context} />
            <Panel title={`${formatNumber(rows.length)} laporan`}>
                <ReportTable
                    rows={rows}
                    empty="Tidak ada yang menunggu tindakan."
                />
            </Panel>
        </div>
    );
}
