import Link from 'next/link';
import { requireActor } from '@/lib/session';
import { listNotifications } from '@/lib/domain/queries';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { Pager, readPage } from '@/components/shell/pager-view';
import { Button } from '@/components/ui/button';
import { NotificationList } from './notification-list';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

/** The two buckets are a filter on the URL, so a view is linkable. */
const TAB = {
    all: 'Semua',
    unread: 'Belum dibaca',
} as const;

type Tab = keyof typeof TAB;

export default async function NotifikasiPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; tab?: string }>;
}) {
    const sp = await searchParams;
    const actor = await requireActor();
    const tab: Tab = sp.tab === 'unread' ? 'unread' : 'all';
    const page = readPage(sp.page);

    const { rows, perPage, total, unread } = await listNotifications(
        actor.userId,
        page,
        25,
        { unreadOnly: tab === 'unread' },
    );

    const href = (next: number) => `/notifikasi?tab=${tab}&page=${next}`;

    return (
        <PageBody>
            <PageHeader
                title="Notifikasi"
                context="Pemberitahuan untuk akun Anda."
            >
                {/* Inactive tabs are links to the URL that selects them; the
                    current one is rendered as a link to itself (aria-current
                    marks it), so keyboard and middle-click behave the same in
                    both states. */}
                <div
                    role="tablist"
                    aria-label="Saringan notifikasi"
                    className="flex gap-1"
                >
                    {(Object.keys(TAB) as Tab[]).map((key) => {
                        const active = tab === key;
                        return (
                            <Button
                                key={key}
                                asChild
                                variant="ghost"
                                size="sm"
                                className={
                                    active
                                        ? 'rounded-[var(--radius-pill)] bg-[var(--accent-soft)] px-3 text-[12.5px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]'
                                        : 'rounded-[var(--radius-pill)] px-3 text-[12.5px] text-muted-foreground'
                                }
                            >
                                <Link
                                    href={`/notifikasi?tab=${key}`}
                                    role="tab"
                                    aria-selected={active}
                                    aria-current={active ? 'page' : undefined}
                                >
                                    {TAB[key]}
                                    {key === 'unread' && unread > 0 && (
                                        <span className="ml-1.5 tabular-nums">
                                            {unread}
                                        </span>
                                    )}
                                </Link>
                            </Button>
                        );
                    })}
                </div>
            </PageHeader>

            <PageContent>
                <Panel title={`${total} notifikasi`}>
                    <NotificationList rows={rows} unreadTotal={unread} />
                    <Pager
                        info={{ page, perPage, total }}
                        buildHref={href}
                        label="notifikasi"
                    />
                </Panel>
            </PageContent>
        </PageBody>
    );
}
