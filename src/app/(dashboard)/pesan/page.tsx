import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { requireActor } from '@/lib/session';
import { listConversations, messagePeers } from '@/lib/domain/actions';
import { formatDate, formatTime } from '@/lib/format';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { Pager, readPage } from '@/components/shell/pager-view';
import { Badge } from '@/components/ui/badge';
import { NewThreadButton, DeleteThreadButton } from './message-ui';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

/** Inbox: threads the caller belongs to, newest activity first, paged in SQL. */
export default async function PesanPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const sp = await searchParams;
    const actor = await requireActor();
    const page = readPage(sp.page);
    const [{ rows, perPage, total }, peers] = await Promise.all([
        listConversations(actor, page),
        messagePeers(actor),
    ]);

    return (
        <PageBody>
            <PageHeader
                title="Pesan"
                context="Percakapan antar fasilitas kesehatan."
            >
                <NewThreadButton peers={peers} />
            </PageHeader>

            <PageContent>
                <Panel title={`${total} percakapan`}>
                    {rows.length === 0 ? (
                        <div className="px-4 py-14 text-center">
                            <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-[var(--raised)] text-muted-foreground">
                                <MessageSquare className="size-5" />
                            </span>
                            <p className="mx-auto max-w-[46ch] text-[13px] text-muted-foreground">
                                Belum ada percakapan. Mulai satu dengan rekan di
                                institusi Anda.
                            </p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-[var(--rule)]">
                            {rows.map((c) => (
                                <li
                                    key={c.id}
                                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--raised)]"
                                >
                                    <Link
                                        href={`/pesan/${c.id}`}
                                        className="min-w-0 flex-1"
                                    >
                                        <div className="flex items-center gap-2">
                                            <p
                                                className="truncate text-[13.5px] font-medium"
                                                title={c.title}
                                            >
                                                {c.title}
                                            </p>
                                            {c.unread > 0 && (
                                                <Badge variant="default">
                                                    {c.unread}
                                                </Badge>
                                            )}
                                        </div>
                                        <p
                                            className="mt-0.5 truncate text-[12.5px] text-muted-foreground"
                                            title={c.lastMessage ?? undefined}
                                        >
                                            {c.lastMessage ?? 'Belum ada pesan'}
                                        </p>
                                    </Link>

                                    <span className="shrink-0 text-[11.5px] text-muted-foreground">
                                        {c.lastAt
                                            ? c.lastAt.toDateString() ===
                                              new Date().toDateString()
                                                ? formatTime(c.lastAt)
                                                : formatDate(c.lastAt)
                                            : '—'}
                                    </span>

                                    <DeleteThreadButton id={c.id} />
                                </li>
                            ))}
                        </ul>
                    )}
                    <Pager
                        info={{ page, perPage, total }}
                        buildHref={(p) => `/pesan?page=${p}`}
                        label="percakapan"
                    />
                </Panel>
            </PageContent>
        </PageBody>
    );
}
