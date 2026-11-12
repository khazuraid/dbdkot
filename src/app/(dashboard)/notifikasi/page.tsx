import { requireActor } from '@/lib/session';
import { listNotifications } from '@/lib/domain/queries';
import { formatDate } from '@/lib/format';
import { PageBody, PageHeader, Panel } from '@/components/shell/page';
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
    const unread = rows.filter((n) => !n.isRead).length;

    return (
        <PageBody>
            <PageHeader
                title="Notifikasi"
                context={
                    <>
                        Pemberitahuan untuk akun Anda.
                        {unread > 0 && ` ${unread} belum dibaca di halaman ini.`}
                    </>
                }
            />
            <Panel title={`${total} notifikasi`}>
                {rows.length === 0 ? (
                    <p className="rounded-[var(--radius-card)] bg-[var(--raised)] px-4 py-10 text-center text-[14px] text-muted-foreground">
                        Belum ada notifikasi. Pemberitahuan muncul di sini
                        saat laporan ditugaskan atau diverifikasi.
                    </p>
                ) : (
                    <ul className="divide-y divide-[var(--rule)]">
                        {rows.map((n) => (
                            <li
                                key={n.id}
                                className="flex items-start gap-3 py-3"
                            >
                                <span
                                    aria-hidden
                                    className={`mt-[7px] size-1.5 shrink-0 rounded-full ${
                                        n.isRead
                                            ? 'bg-[var(--control)]'
                                            : 'bg-[var(--data)]'
                                    }`}
                                />
                                <div className="min-w-0 flex-1">
                                    <p
                                        className={
                                            n.isRead
                                                ? 'text-[14px] text-muted-foreground'
                                                : 'text-[14px] font-medium'
                                        }
                                    >
                                        {n.title}
                                    </p>
                                    <p className="text-[13px] text-muted-foreground">
                                        {n.message}
                                    </p>
                                </div>
                                <time className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-muted-foreground">
                                    {formatDate(n.createdAt)}
                                </time>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
            <Pager
                info={{ page, perPage, total }}
                label="notifikasi"
                buildHref={(n) =>
                    n > 1 ? `/notifikasi?page=${n}` : '/notifikasi'
                }
            />
        </PageBody>
    );
}
