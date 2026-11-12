import { requireRole } from '@/lib/session';
import { listSettings } from '@/lib/domain/admin';
import { PageHeader, Panel, Empty } from '@/components/shell/page';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

/** Public settings only: an admin screen must never print a stored secret. */
export default async function PengaturanPage() {
    const actor = await requireRole('DINKES', 'ADMIN');
    const rows = await listSettings(actor.role !== 'ADMIN');

    return (
        <div className="px-[var(--pad)] py-8">
            <PageHeader
                title="Pengaturan"
                context="Parameter sistem dan SLA."
            />
            <Panel title={`${rows.length} pengaturan`}>
                {rows.length === 0 ? (
                    <Empty>Belum ada pengaturan.</Empty>
                ) : (
                    <dl className="divide-y divide-border border-t border-border">
                        {rows.map((s) => (
                            <div
                                key={s.id}
                                className="flex items-baseline justify-between py-3"
                            >
                                <dt className="text-[14px]">
                                    {s.description ?? s.key}
                                    <span className="ml-2 text-[12px] text-muted-foreground">
                                        {s.category}
                                    </span>
                                </dt>
                                <dd data-numeric className="text-[14px]">
                                    {s.value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}
            </Panel>
        </div>
    );
}
