import { Search } from 'lucide-react';
import { requireRole } from '@/lib/session';
import { listAuditLogs } from '@/lib/domain/queries';
import { formatDate, formatTime } from '@/lib/format';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { DataTable, Dash } from '@/components/shell/data-table';
import { Pager, readPage } from '@/components/shell/pager-view';
import { StatusText } from '@/components/shell/status-text';
import { Button } from '@/components/ui/button';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from '@/components/ui/input-group';
import { PurgeButton } from './purge-button';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

type AuditRow = Awaited<ReturnType<typeof listAuditLogs>>['rows'][number];

/** UUIDs are unreadable; the first block is enough to match against a record. */
function shortId(id: string) {
    return id.slice(0, 8);
}

const ACTIONS = [
    'CREATE',
    'UPDATE',
    'DELETE',
    'VERIFY',
    'ASSIGN',
    'LOGIN',
    'READ_PII',
] as const;

const TONE: Record<string, 'good' | 'warn' | 'bad' | 'neutral'> = {
    CREATE: 'good',
    UPDATE: 'neutral',
    DELETE: 'bad',
    VERIFY: 'good',
    ASSIGN: 'neutral',
    LOGIN: 'neutral',
    READ_PII: 'warn',
};

export default async function AuditLogPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; q?: string; action?: string }>;
}) {
    const sp = await searchParams;
    const actor = await requireRole('ADMIN');
    const q = sp.q?.trim() ?? '';
    const action = ACTIONS.includes(sp.action as (typeof ACTIONS)[number])
        ? sp.action
        : undefined;
    const { rows, page, perPage, total } = await listAuditLogs(
        readPage(sp.page),
        25,
        { q, action },
    );

    return (
        <PageBody>
            <PageHeader
                title="Audit log"
                context="Setiap mutasi dan setiap pembacaan data pribadi dicatat di sini."
            >
                <form
                    action="/admin/audit-log"
                    className="flex flex-wrap items-center gap-2"
                >
                    <InputGroup className="h-9 w-full sm:w-[220px]">
                        <InputGroupAddon>
                            <Search className="size-4" aria-hidden />
                        </InputGroupAddon>
                        <InputGroupInput
                            name="q"
                            type="search"
                            defaultValue={q}
                            placeholder="Cari pengguna atau ID"
                            aria-label="Cari pengguna atau ID"
                        />
                    </InputGroup>
                    <select
                        name="action"
                        defaultValue={action ?? ''}
                        aria-label="Saring aksi"
                        className="h-9 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[13px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                        <option value="">Semua aksi</option>
                        {ACTIONS.map((a) => (
                            <option key={a} value={a}>
                                {a}
                            </option>
                        ))}
                    </select>
                    <Button type="submit" size="sm" className="h-9 px-3">
                        Saring
                    </Button>
                    <PurgeButton isAdmin={actor.role === 'ADMIN'} />
                </form>
            </PageHeader>
            <PageContent>
                <Panel title={`${total} entri terbaru`}>
                    <DataTable<AuditRow>
                        rows={rows}
                        empty="Belum ada entri audit."
                        caption="Catatan audit sistem"
                        columns={[
                            {
                                key: 'time',
                                header: 'Waktu',
                                align: 'right',
                                cell: (a) => (
                                    <span className="whitespace-nowrap text-muted-foreground">
                                        {formatDate(a.createdAt)}
                                        {' · '}
                                        {formatTime(a.createdAt)}
                                    </span>
                                ),
                            },
                            {
                                key: 'user',
                                header: 'Pengguna',
                                cell: (a) =>
                                    a.userName ?? a.userEmail ?? <Dash />,
                            },
                            {
                                key: 'action',
                                header: 'Aksi',
                                cell: (a) => (
                                    <StatusText
                                        tone={TONE[a.action] ?? 'neutral'}
                                    >
                                        {a.action}
                                    </StatusText>
                                ),
                            },
                            {
                                key: 'entity',
                                header: 'Entitas',
                                cell: (a) => (
                                    <span className="text-muted-foreground">
                                        {a.entityType}
                                    </span>
                                ),
                            },
                            {
                                key: 'id',
                                header: 'ID',
                                align: 'right',
                                cell: (a) => (
                                    <span
                                        className="text-[12px] text-muted-foreground tabular-nums"
                                        title={a.entityId}
                                    >
                                        {shortId(a.entityId)}
                                    </span>
                                ),
                            },
                        ]}
                    />
                    <Pager
                        info={{ page, perPage, total }}
                        label="entri"
                        buildHref={(n) => {
                            const params = new URLSearchParams();
                            if (q) params.set('q', q);
                            if (action) params.set('action', action);
                            params.set('page', String(n));
                            return `/admin/audit-log?${params}`;
                        }}
                    />
                </Panel>
            </PageContent>
        </PageBody>
    );
}
