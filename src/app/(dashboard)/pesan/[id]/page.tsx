import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireActor } from '@/lib/session';
import { canReadConversation, listThreadMessages } from '@/lib/domain/actions';
import { PageBody, PageHeader, Panel } from '@/components/shell/page';
import { Pager, readPage } from '@/components/shell/pager-view';
import { MessageComposer, MessageList } from '../message-ui';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

/**
 * One thread. Opening it marks the fetched messages read (in the domain
 * function, after the membership join), so the unread count in the inbox is a
 * function of what was actually seen.
 */
export default async function ThreadPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ page?: string }>;
}) {
    const { id } = await params;
    const sp = await searchParams;
    const actor = await requireActor();

    // Membership is the permission: a non-member gets the same 404 as a
    // thread that does not exist, so ids cannot be probed for existence.
    if (!(await canReadConversation(actor, id))) notFound();

    const page = readPage(sp.page);
    const { rows, perPage, total } = await listThreadMessages(actor, id, page);

    return (
        <PageBody>
            <PageHeader
                title="Percakapan"
                context={`${total} pesan`}
                aside={
                    <Link
                        href="/pesan"
                        className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="size-3.5" /> Kotak masuk
                    </Link>
                }
            />

            <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 overflow-y-auto">
                    <Panel title="Pesan">
                        <MessageList messages={rows} />
                        <Pager
                            info={{ page, perPage, total }}
                            buildHref={(p) => `/pesan/${id}?page=${p}`}
                            label="pesan"
                        />
                    </Panel>
                </div>
                <MessageComposer conversationId={id} />
            </div>
        </PageBody>
    );
}
