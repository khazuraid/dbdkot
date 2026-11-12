import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { notifications, users } from '@/db/schema';

export type NotifyTarget =
    | { kind: 'USER'; userId: string }
    | { kind: 'INSTITUTION'; institutionId: string }
    | { kind: 'ROLE'; role: 'ADMIN' | 'DINKES' | 'PUSKESMAS' | 'RUMAH_SAKIT' };

/**
 * In-app notification fan-out. C8 in the audit: the prototype's realtime
 * channel was unauthenticated and clients could join any user's room. Rows are
 * written here, per recipient, and read through an authenticated route — so a
 * client can only ever receive its own notifications.
 */
export async function insertNotifications(
    target: NotifyTarget,
    payload: {
        title: string;
        message: string;
        type: string;
        entityType?: string;
        entityId?: string;
    },
): Promise<number> {
    const db = getDb();

    const recipients = await (async () => {
        if (target.kind === 'USER') {
            return [{ id: target.userId }];
        }

        if (target.kind === 'INSTITUTION') {
            return db
                .select({ id: users.id })
                .from(users)
                .where(
                    and(
                        eq(users.institutionId, target.institutionId),
                        eq(users.isActive, true),
                    ),
                );
        }

        return db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.role, target.role), eq(users.isActive, true)));
    })();

    if (recipients.length === 0) {
        return 0;
    }

    // `onConflictDoNothing` covers the partial unique index on SLA_BREACH rows:
    // a second reminder for the same report and user on the same day is dropped
    // by the database, which is the only place the race can be settled.
    await db
        .insert(notifications)
        .values(
            recipients.map((r) => ({
                userId: r.id,
                title: payload.title,
                message: payload.message,
                type: payload.type,
                entityType: payload.entityType ?? null,
                entityId: payload.entityId ?? null,
            })),
        )
        .onConflictDoNothing();

    return recipients.length;
}
