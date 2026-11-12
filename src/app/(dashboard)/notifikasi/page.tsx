import { requireActor } from '@/lib/session';
import { listNotifications } from '@/lib/domain/queries';
import { formatDate } from '@/lib/format';
import { PageHeader, Panel, Empty } from '@/components/shell/page';
import { Pager, readPage } from '@/components/shell/pager';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

export default async function NotifikasiPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const sp = await searchParams;
    const actor = await requireActor();
    const { rows, page, perPage, total } = await listNotifications(
        actor.userId,
        readPage(sp.page),
    );

    return (
        <div className="px-[var(--pad)] py-8">
            <PageHeader
                title="Notifikasi"
                context="Pemberitahuan untuk akun Anda."
            />
            <Panel title="Semua notifikasi">
                {rows.length === 0 ? (
                    <Empty>Belum ada notifikasi.</Empty>
                ) : (
                    <ul className="divide-y divide-border border-t border-border">
                        {rows.map((n) => (
                            <li
                                key={n.id}
                                className="flex items-start gap-3 py-3"
                            >
                                <span
                                    aria-hidden
                                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                                        n.isRead
                                            ? 'bg-[var(--control)]'
                                            : 'bg-[var(--data)]'
                                    }`}
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="text-[14px] font-medium">
                                        {n.title}
                                    </p>
                                    <p className="text-[13px] text-muted-foreground">
                                        {n.message}
                                    </p>
                                </div>
                                <time
                                    data-numeric
                                    className="shrink-0 text-[12px] text-muted-foreground"
                                >
                                    {formatDate(n.createdAt)}
                                </time>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
            <Pager
                info={{ page, perPage, total }}
                buildHref={(n) =>
                    n > 1 ? `/notifikasi?page=${n}` : '/notifikasi'
                }
            />
        </div>
    );
}
