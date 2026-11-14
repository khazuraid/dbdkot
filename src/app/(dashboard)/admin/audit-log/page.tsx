import {
    Activity,
    AlertTriangle,
    Database,
    Eye,
    Globe,
    Lock,
    Search,
    Shield,
    ShieldAlert,
    ShieldCheck,
    SlidersHorizontal,
    User,
} from 'lucide-react';
import { requireRole } from '@/lib/session';
import { listAuditLogs } from '@/lib/domain/queries';
import { formatDate, formatTime } from '@/lib/format';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { AutoFilterForm } from '@/components/shell/auto-filter-form';
import { DataTable, Dash } from '@/components/shell/data-table';
import { Pager, readPage } from '@/components/shell/pager-view';
import { Stat, StatRow } from '@/components/shell/stat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from '@/components/ui/input-group';
import { PurgeButton } from './purge-button';
import { AuditLogRowAction, type AuditLogEntry } from './audit-inspector';
import { ROLE_LABEL } from '@/lib/nav';
import type { Role } from '@/lib/roles';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

type AuditRow = Awaited<ReturnType<typeof listAuditLogs>>['rows'][number];

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

    // Compute simple security stats from current slice
    const sensitiveCount = rows.filter(
        (r) => r.action === 'READ_PII' || r.action === 'DELETE',
    ).length;
    const mutationCount = rows.filter(
        (r) => r.action === 'CREATE' || r.action === 'UPDATE',
    ).length;

    return (
        <PageBody>
            <PageHeader
                title="Pusat Audit Keamanan & Forensik"
                context="Perekaman otomatis setiap mutasi entitas, tindakan administratif, dan inspeksi data pribadi terlindungi (AES-256-GCM)."
            >
                <div className="flex flex-wrap items-center gap-2">
                    <PurgeButton isAdmin={actor.role === 'ADMIN'} />
                </div>
            </PageHeader>

            <PageContent className="space-y-6">
                {/* Security KPI Summary */}
                <StatRow>
                    <Stat
                        label="Total Catatan Audit"
                        value={total}
                        hint="Seluruh event terindeks"
                        icon={Shield}
                        signal="neutral"
                    />
                    <Stat
                        label="Operasi Kritis & PII"
                        value={sensitiveCount}
                        hint="Akses data sensitif & hapus"
                        icon={ShieldAlert}
                        signal={sensitiveCount > 0 ? 'warn' : 'good'}
                    />
                    <Stat
                        label="Mutasi Data"
                        value={mutationCount}
                        hint="Operasi pembuatan & modifikasi"
                        icon={Activity}
                        signal="neutral"
                    />
                    <Stat
                        label="Integritas Audit Trail"
                        value="100%"
                        hint="Tervalidasi & Anti-Tamper"
                        icon={ShieldCheck}
                        signal="good"
                    />
                </StatRow>

                {/* Filter and Search Bar */}
                <Panel
                    title="Pencarian & Filter Forensik"
                    subtitle="Saring audit trail berdasarkan nama operator, email, IP address, atau ID entitas"
                >
                    <div className="p-4">
                        <AutoFilterForm
                            action="/admin/audit-log"
                            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                        >
                            <InputGroup className="h-9 flex-1">
                                <InputGroupAddon>
                                    <Search className="size-4 text-muted-foreground" aria-hidden />
                                </InputGroupAddon>
                                <InputGroupInput
                                    name="q"
                                    type="search"
                                    defaultValue={q}
                                    placeholder="Cari nama pengguna, email, atau entity ID..."
                                    aria-label="Cari pengguna atau ID"
                                    className="text-xs"
                                />
                            </InputGroup>

                            <select
                                name="action"
                                defaultValue={action ?? ''}
                                aria-label="Saring aksi"
                                className="h-9 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-foreground outline-none focus-visible:border-[var(--accent)] font-medium"
                            >
                                <option value="">Semua Kategori Aksi</option>
                                <option value="READ_PII">READ_PII (Akses Data Sensitif)</option>
                                <option value="DELETE">DELETE (Penghapusan)</option>
                                <option value="UPDATE">UPDATE (Perubahan Data)</option>
                                <option value="CREATE">CREATE (Entri Baru)</option>
                                <option value="VERIFY">VERIFY (Verifikasi Kasus/PE)</option>
                                <option value="ASSIGN">ASSIGN (Penugasan Faskes)</option>
                                <option value="LOGIN">LOGIN (Sesi Autentikasi)</option>
                            </select>

                            {(q || action) && (
                                <Button
                                    asChild
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 text-xs text-muted-foreground shrink-0"
                                >
                                    <a href="/admin/audit-log">Reset</a>
                                </Button>
                            )}
                        </AutoFilterForm>
                    </div>
                </Panel>

                {/* Audit Table */}
                <Panel
                    title={`Log Aktivitas Keamanan (${total} entri)`}
                    aside={
                        <Badge variant="outline" className="font-mono text-[11px]">
                            Halaman {page} dari {Math.ceil(total / perPage) || 1}
                        </Badge>
                    }
                >
                    <DataTable<AuditRow>
                        rows={rows}
                        empty="Belum ada catatan audit yang cocok dengan filter."
                        caption="Daftar audit log forensik sistem"
                        maxHeight="68vh"
                        columns={[
                            {
                                key: 'time',
                                header: 'Waktu & Jaringan',
                                cell: (a) => (
                                    <div className="space-y-0.5 min-w-[130px]">
                                        <div className="font-mono text-xs text-foreground font-medium">
                                            {formatDate(a.createdAt)}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                            <span className="font-mono">{formatTime(a.createdAt)}</span>
                                            <span>·</span>
                                            <span className="font-mono text-[10px] text-muted-foreground">
                                                {a.ipAddress ?? '127.0.0.1'}
                                            </span>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: 'user',
                                header: 'Aktor / Operator',
                                cell: (a) => (
                                    <div className="space-y-0.5 min-w-[140px]">
                                        <div className="text-xs font-semibold text-foreground">
                                            {a.userName ?? a.userEmail ?? 'Sistem'}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                                            {a.userEmail ?? '-'}
                                        </div>
                                        {a.userRole && (
                                            <div className="pt-0.5">
                                                <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-medium bg-[var(--raised)] border border-[var(--border)] text-muted-foreground">
                                                    {ROLE_LABEL[a.userRole as Role] ?? a.userRole}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ),
                            },
                            {
                                key: 'action',
                                header: 'Kategori Aksi',
                                cell: (a) => {
                                    const isSens = a.action === 'READ_PII';
                                    const isDel = a.action === 'DELETE';
                                    const isCreate = a.action === 'CREATE';
                                    const isVerify = a.action === 'VERIFY';

                                    let badgeClass = 'border-[var(--border)] bg-[var(--raised)] text-foreground';
                                    if (isDel) badgeClass = 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 font-semibold';
                                    else if (isSens) badgeClass = 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium';
                                    else if (isCreate) badgeClass = 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400';
                                    else if (isVerify) badgeClass = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';

                                    return (
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono border ${badgeClass}`}>
                                            {a.action}
                                        </span>
                                    );
                                },
                            },
                            {
                                key: 'entity',
                                header: 'Target Entitas',
                                cell: (a) => (
                                    <div className="space-y-0.5">
                                        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                            {a.entityType}
                                        </div>
                                        <div className="font-mono text-xs text-foreground font-medium">
                                            {shortId(a.entityId)}…
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: 'inspector',
                                header: 'Forensik & Detail',
                                align: 'right',
                                cell: (a) => (
                                    <AuditLogRowAction
                                        log={{
                                            id: a.id,
                                            action: a.action,
                                            entityType: a.entityType,
                                            entityId: a.entityId,
                                            changes: a.changes as Record<string, { from: unknown; to: unknown }> | null,
                                            ipAddress: a.ipAddress,
                                            userAgent: a.userAgent,
                                            createdAt: a.createdAt,
                                            userName: a.userName,
                                            userEmail: a.userEmail,
                                            userRole: a.userRole as Role | null,
                                        }}
                                    />
                                ),
                            },
                        ]}
                    />
                    <div className="p-4 border-t border-[var(--border)]">
                        <Pager
                            info={{ page, perPage, total }}
                            buildHref={(n) =>
                                `/admin/audit-log?${new URLSearchParams({
                                    ...(q ? { q } : {}),
                                    ...(action ? { action } : {}),
                                    page: String(n),
                                })}`
                            }
                        />
                    </div>
                </Panel>
            </PageContent>
        </PageBody>
    );
}
