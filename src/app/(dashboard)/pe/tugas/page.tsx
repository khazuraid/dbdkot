import Link from 'next/link';
import { requireActor } from '@/lib/session';
import { listPeTasks } from '@/lib/domain/queries';
import { formatDate } from '@/lib/format';
import { PageHeader, Panel, Empty } from '@/components/shell/page';
import { Pager, readPage } from '@/components/shell/pager';

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

    return (
        <div className="px-[var(--pad)] py-8">
            <PageHeader
                title="Tugas PE"
                context="Tenggat empat hari sejak laporan masuk."
            />
            <Panel title={`${total} tugas`}>
                {rows.length === 0 ? (
                    <Empty>Belum ada tugas PE.</Empty>
                ) : (
                    <table className="w-full border-collapse text-[14px]">
                        <thead>
                            <tr className="border-y border-border text-left text-[12px] text-muted-foreground">
                                <th className="py-2 font-normal">Laporan</th>
                                <th className="py-2 font-normal">Petugas</th>
                                <th className="py-2 font-normal">Prioritas</th>
                                <th className="py-2 font-normal">Tenggat</th>
                                <th className="py-2 font-normal">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {rows.map((t) => (
                                <tr
                                    key={t.id}
                                    className="h-[var(--row-height)]"
                                >
                                    <td className="py-2">
                                        <Link
                                            href={`/pe/${t.reportPEId}`}
                                            className="underline"
                                        >
                                            {t.reportNumber}
                                        </Link>
                                    </td>
                                    <td className="py-2">
                                        {t.assignedToName ?? '—'}
                                    </td>
                                    <td className="py-2">
                                        {PRIORITY_LABEL[t.priority] ??
                                            t.priority}
                                    </td>
                                    <td
                                        data-numeric
                                        className={
                                            t.isLate
                                                ? 'py-2 text-[var(--negative)]'
                                                : 'py-2'
                                        }
                                    >
                                        {formatDate(t.dueDate)}
                                        {t.isLate && ' · lewat'}
                                    </td>
                                    <td className="py-2">
                                        {TASK_STATUS_LABEL[t.status] ??
                                            t.status}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Panel>
            <Pager
                info={{ page, perPage, total }}
                label="tugas"
                buildHref={(n) => (n > 1 ? `/pe/tugas?page=${n}` : '/pe/tugas')}
            />
        </div>
    );
}
