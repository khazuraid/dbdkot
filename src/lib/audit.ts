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
 * Intentionally non-throwing: losing an audit row must not abort the business
 * operation, but it is logged loudly so it cannot pass silently.
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
        console.error('[audit] failed to persist audit entry', {
            action: input.action,
            entityType: input.entityType,
            entityId: input.entityId,
            error,
        });
    }
}
