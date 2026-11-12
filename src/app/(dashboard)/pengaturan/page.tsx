import { requireRole } from '@/lib/session';
import { listSettings } from '@/lib/domain/admin';
import { PageBody, PageHeader } from '@/components/shell/page';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

/**
 * Settings are label-beside-panel rows, not a table: each key is a decision with
 * a default and a current value, and a reader scans the left column for the one
 * they came to change. Public settings only: an admin screen must never print a
 * stored secret.
 */
export default async function PengaturanPage() {
    const actor = await requireRole('DINKES', 'ADMIN');
    const rows = await listSettings(actor.role !== 'ADMIN');

    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
        const category = row.category ?? 'Lainnya';
        const list = groups.get(category) ?? [];
        list.push(row);
        groups.set(category, list);
    }

    return (
        <PageBody>
            <PageHeader
                title="Pengaturan"
                context="Parameter sistem dan SLA, dikelompokkan per kategori."
            />

            {rows.length === 0 ? (
                <p className="mt-8 rounded-[var(--radius-card)] bg-[var(--raised)] px-4 py-10 text-center text-[14px] text-muted-foreground">
                    Belum ada pengaturan tersimpan.
                </p>
            ) : (
                <div className="mt-8 space-y-10">
                    {[...groups.entries()].map(([category, items]) => (
                        <section key={category}>
                            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
                                {category}
                            </h2>
                            <dl className="mt-3 divide-y divide-[var(--rule)]">
                                {items.map((s) => (
                                    <div
                                        key={s.id}
                                        className="grid items-baseline gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6"
                                    >
                                        <dt className="text-[14px]">
                                            {s.description ?? s.key}
                                            {s.description && (
                                                <span className="mt-0.5 block text-[12px] text-muted-foreground">
                                                    {s.key}
                                                </span>
                                            )}
                                        </dt>
                                        <dd className="tabular-nums text-[14px] font-medium sm:text-right">
                                            {String(s.value)}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    ))}
                </div>
            )}
        </PageBody>
    );
}
