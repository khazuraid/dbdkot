import Link from 'next/link';
import { requireActor } from '@/lib/session';
import { listPeTasks } from '@/lib/domain/queries';
import { formatDate } from '@/lib/format';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { DataTable, Dash } from '@/components/shell/data-table';
import { Pager, readPage } from '@/components/shell/pager-view';
import { StatusText } from '@/components/shell/status-text';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

const TASK_STATUS_LABEL: Record<string, string> = {
    PENDING: 'Menunggu',
    IN_PROGRESS: 'Dikerjakan',
    COMPLETED: 'Selesai',
    OVERDUE: 'Lewat tenggat',
};

const PRIORITY_LABEL: Record<string, string> = {
    LOW: 'Rendah',
    NORMAL: 'Normal',
    HIGH: 'Tinggi',
    CRITICAL: 'Kritis',
};

type TaskRow = Awaited<ReturnType<typeof listPeTasks>>['rows'][number];

export default async function PeTugasPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const sp = await searchParams;
    const actor = await requireActor();
    const { rows, page, perPage, total } = await listPeTasks(
        actor,
        readPage(sp.page),
    );
    const late = rows.filter((t) => t.isLate).length;

    return (
        <PageBody>
            <PageHeader
                title="Tugas PE"
                context={
                    <>
                        Tenggat empat hari sejak laporan masuk.
                        {late > 0 && (
                            <span className="text-[var(--negative)]">
                                {' '}
                                {late} lewat tenggat di halaman ini.
                            </span>
                        )}
                    </>
                }
            />

            <PageContent>
                <Panel title={`${total} tugas`}>
                    <DataTable<TaskRow>
                        rows={rows}
                        empty="Belum ada tugas PE yang ditugaskan."
                        caption="Tugas penyelidikan epidemiologi"
                        columns={[
                            {
                                key: 'report',
                                header: 'Laporan',
                                cell: (t) => (
                                    <Link
                                        href={`/laporan/${t.reportRSId}`}
                                        className="font-mono text-[13px] font-medium text-[var(--accent)] underline-offset-4 hover:underline"
                                    >
                                        {t.reportNumber}
                                    </Link>
                                ),
                            },
                            {
                                key: 'officer',
                                header: 'Petugas',
                                cell: (t) => t.assignedToName ?? <Dash />,
                            },
                            {
                                key: 'priority',
                                header: 'Prioritas',
                                cell: (t) => (
                                    <StatusText
                                        tone={
                                            t.priority === 'CRITICAL'
                                                ? 'bad'
                                                : t.priority === 'HIGH'
                                                  ? 'warn'
                                                  : 'neutral'
                                        }
                                    >
                                        {PRIORITY_LABEL[t.priority] ??
                                            t.priority}
                                    </StatusText>
                                ),
                            },
                            {
                                key: 'due',
                                header: 'Tenggat',
                                align: 'right',
                                cell: (t) => (
                                    <StatusText
                                        tone={t.isLate ? 'bad' : 'neutral'}
                                    >
                                        {formatDate(t.dueDate)}
                                        {t.isLate && ' · lewat'}
                                    </StatusText>
                                ),
                            },
                            {
                                key: 'status',
                                header: 'Status',
                                cell: (t) => (
                                    <div className="flex flex-col gap-0.5">
                                        <StatusText
                                            tone={
                                                t.status === 'COMPLETED'
                                                    ? 'good'
                                                    : t.status === 'OVERDUE'
                                                      ? 'bad'
                                                      : 'warn'
                                            }
                                        >
                                            {TASK_STATUS_LABEL[t.status] ??
                                                t.status}
                                        </StatusText>
                                        {t.notes && (
                                            <span className="text-[11px] text-muted-foreground line-clamp-1">
                                                {t.notes}
                                            </span>
                                        )}
                                    </div>
                                ),
                            },
                            {
                                key: 'action',
                                header: 'Aksi',
                                align: 'right',
                                cell: (t) => {
                                    if (
                                        t.rawStatus === 'ASSIGNED_ACCEPTED' ||
                                        t.rawStatus === 'PE_IN_PROGRESS'
                                    ) {
                                        return (
                                            <Link
                                                href={`/pe/baru?reportId=${t.reportRSId}`}
                                                className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)] px-2.5 py-1 text-[11.5px] font-medium text-white shadow-2xs hover:opacity-90"
                                            >
                                                Isi Form PE
                                            </Link>
                                        );
                                    }
                                    return (
                                        <Link
                                            href={`/laporan/${t.reportRSId}`}
                                            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11.5px] font-medium text-foreground hover:bg-[var(--raised)]"
                                        >
                                            {t.rawStatus === 'ASSIGNED'
                                                ? 'Tinjau'
                                                : 'Detail'}
                                        </Link>
                                    );
                                },
                            },
                        ]}
                    />
                    <Pager
                        info={{ page, perPage, total }}
                        label="tugas"
                        buildHref={(n) =>
                            n > 1 ? `/pe/tugas?page=${n}` : '/pe/tugas'
                        }
                    />
                </Panel>
            </PageContent>
        </PageBody>
    );
}
