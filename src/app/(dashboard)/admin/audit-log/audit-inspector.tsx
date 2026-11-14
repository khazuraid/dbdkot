'use client';

import { useState } from 'react';
import {
    Activity,
    ArrowRight,
    CheckCircle2,
    Clock,
    Code2,
    Eye,
    Globe,
    Laptop,
    Lock,
    Shield,
    ShieldAlert,
    User,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate, formatTime } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/nav';
import type { Role } from '@/lib/roles';

export type AuditLogEntry = {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    changes: Record<string, { from: unknown; to: unknown }> | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    userName: string | null;
    userEmail: string | null;
    userRole?: Role | null;
};

export function AuditInspectorModal({
    log,
    open,
    onOpenChange,
}: {
    log: AuditLogEntry | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    if (!log) return null;

    const changesEntries = log.changes
        ? Object.entries(log.changes)
        : [];

    const isSensitive = log.action === 'READ_PII';
    const isDestructive = log.action === 'DELETE';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader className="border-b border-[var(--border)] pb-3">
                    <div className="flex items-center gap-2">
                        <Badge
                            variant={
                                isDestructive
                                    ? 'destructive'
                                    : isSensitive
                                      ? 'outline'
                                      : 'secondary'
                            }
                            className={`font-mono text-xs uppercase ${
                                isSensitive
                                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                    : ''
                            }`}
                        >
                            {log.action}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">
                            ID: {log.id}
                        </span>
                    </div>
                    <DialogTitle className="text-base font-semibold pt-1">
                        Inspeksi Keamanan & Forensik Audit
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Direkam secara otomatis pada {formatDate(log.createdAt)} pukul{' '}
                        {formatTime(log.createdAt)} WIB
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/40 p-3 space-y-1.5">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <User className="size-3.5 text-[var(--accent)]" />
                                Aktor / Operator
                            </div>
                            <div className="font-semibold text-foreground">
                                {log.userName ?? 'Sistem / Anonim'}
                            </div>
                            <div className="text-muted-foreground font-mono text-[11px]">
                                {log.userEmail ?? '-'}
                            </div>
                            {log.userRole && (
                                <Badge variant="outline" className="text-[10px] mt-1">
                                    {ROLE_LABEL[log.userRole] ?? log.userRole}
                                </Badge>
                            )}
                        </div>

                        <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/40 p-3 space-y-1.5">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Globe className="size-3.5 text-[var(--accent)]" />
                                Jaringan & Klien
                            </div>
                            <div className="font-mono text-foreground font-semibold">
                                {log.ipAddress ?? '127.0.0.1 (Internal Proxy)'}
                            </div>
                            <div className="text-muted-foreground text-[11px] line-clamp-2">
                                {log.userAgent ?? 'Koneksi Internal / Server Session'}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3 text-xs space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Entitas Sasaran:
                        </span>
                        <div className="flex items-center gap-2 pt-0.5">
                            <Badge variant="outline" className="font-mono text-xs">
                                {log.entityType}
                            </Badge>
                            <span className="font-mono text-[12px] text-foreground font-medium">
                                {log.entityId}
                            </span>
                        </div>
                    </div>

                    {/* Changes & Payload View */}
                    <Tabs defaultValue="diff" className="w-full">
                        <TabsList className="h-8">
                            <TabsTrigger value="diff" className="text-xs">
                                Perubahan Nilai ({changesEntries.length})
                            </TabsTrigger>
                            <TabsTrigger value="raw" className="text-xs">
                                Raw JSON Payload
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="diff" className="pt-2">
                            {changesEntries.length === 0 ? (
                                <div className="rounded-[var(--radius-control)] border border-dashed border-[var(--border)] p-6 text-center text-xs text-muted-foreground">
                                    Aksi ini tidak menyertakan mutasi field bertahap (operasi baca atau penandaan status langsung).
                                </div>
                            ) : (
                                <div className="rounded-[var(--radius-control)] border border-[var(--border)] overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-[var(--raised)]/70 text-muted-foreground border-b border-[var(--border)]">
                                            <tr>
                                                <th className="text-left py-2 px-3 font-medium">Kolom / Field</th>
                                                <th className="text-left py-2 px-3 font-medium">Nilai Sebelum (From)</th>
                                                <th className="text-left py-2 px-3 font-medium">Nilai Sesudah (To)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--border)]">
                                            {changesEntries.map(([field, delta]) => (
                                                <tr key={field} className="hover:bg-[var(--raised)]/30">
                                                    <td className="py-2 px-3 font-mono font-semibold text-foreground">
                                                        {field}
                                                    </td>
                                                    <td className="py-2 px-3 font-mono text-rose-600 dark:text-rose-400 bg-rose-500/5">
                                                        {delta?.from !== undefined && delta?.from !== null
                                                            ? String(delta.from)
                                                            : '<kosong>'}
                                                    </td>
                                                    <td className="py-2 px-3 font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 font-medium">
                                                        {delta?.to !== undefined && delta?.to !== null
                                                            ? String(delta.to)
                                                            : '<kosong>'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="raw" className="pt-2">
                            <pre className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-sunken)] p-3 text-[11px] font-mono text-foreground overflow-x-auto max-h-60">
                                {JSON.stringify(
                                    {
                                        id: log.id,
                                        action: log.action,
                                        entityType: log.entityType,
                                        entityId: log.entityId,
                                        changes: log.changes,
                                        ipAddress: log.ipAddress,
                                        userAgent: log.userAgent,
                                        createdAt: log.createdAt,
                                    },
                                    null,
                                    2,
                                )}
                            </pre>
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function AuditLogRowAction({ log }: { log: AuditLogEntry }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(true)}
                className="h-7 px-2 text-[11.5px] font-medium gap-1 text-[var(--accent)] hover:bg-[var(--accent)]/10"
            >
                <Eye className="size-3" />
                <span>Detail</span>
            </Button>
            <AuditInspectorModal
                log={log}
                open={open}
                onOpenChange={setOpen}
            />
        </>
    );
}
