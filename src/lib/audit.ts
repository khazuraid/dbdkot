import { getDb } from '@/db';
import { auditLogs } from '@/db/schema';
import type { Actor } from './session';

export type AuditAction =
    | 'CREATE'
    | 'READ'
    | 'READ_PII'
    | 'UPDATE'
    | 'DELETE'
    | 'VERIFY'
    | 'ASSIGN'
    | 'LOGIN';

export type AuditEntity =
    | 'REPORT_RS'
    | 'REPORT_PE'
    | 'PE_TASK'
    | 'USER'
    | 'INSTITUTION'
    | 'ATTACHMENT'
    | 'KOREKSI_WILAYAH';

type AuditInput = {
    actor: Actor;
    action: AuditAction;
    entityType: AuditEntity;
    entityId: string;
    changes?: Record<string, { from: unknown; to: unknown }>;
    ipAddress?: string | null;
    userAgent?: string | null;
};

/**
 * C9: the prototype shipped an AuditLog model with a `log()` method that had
 * zero callers, so the audit trail was permanently empty. Every mutation and
 * every PII read must go through this.
 *
 * Intentionally non-throwing: a failed audit write must not abort a business
 * operation the user already triggered. But it must not vanish either — the
 * whole point of C9 was a trail nobody could tell was missing — so the entry
 * is always emitted to stderr as a structured line, which is what a log
 * collector or the deploy's log store can still recover.
 */
export async function audit(input: AuditInput): Promise<void> {
    try {
        await getDb()
            .insert(auditLogs)
            .values({
                userId: input.actor.userId,
                action: input.action,
                entityType: input.entityType,
                entityId: input.entityId,
                changes: input.changes ?? null,
                ipAddress: input.ipAddress ?? null,
                userAgent: input.userAgent ?? null,
            });
    } catch (error) {
        console.error(
            JSON.stringify({
                level: 'error',
                msg: 'audit write failed',
                persisted: false,
                audit: {
                    userId: input.actor.userId,
                    role: input.actor.role,
                    action: input.action,
                    entityType: input.entityType,
                    entityId: input.entityId,
                    changes: input.changes ?? null,
                },
                error: error instanceof Error ? error.message : String(error),
                at: new Date().toISOString(),
            }),
        );
    }
}
