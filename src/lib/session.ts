import { headers } from 'next/headers';
import { auth } from './auth';
import type { Role } from './roles';

export type Actor = {
    userId: string;
    role: Role;
    institutionId: string | null;
    email: string;
};

/**
 * Resolves the caller from the better-auth session. Roles are read from the
 * database, never from a request header — the legacy `ProxyAuthGuard` trusted
 * `x-user-id`/`x-user-email`, which let anyone act as any user (C3).
 */
export async function requireActor(): Promise<Actor> {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
        throw new Error('UNAUTHENTICATED');
    }

    const user = session.user as typeof session.user & {
        role?: Role;
        institutionId?: string | null;
        isActive?: boolean;
    };

    if (user.isActive === false) {
        throw new Error('ACCOUNT_DISABLED');
    }

    return {
        userId: user.id,
        role: (user.role ?? 'PUSKESMAS') as Role,
        institutionId: user.institutionId ?? null,
        email: user.email,
    };
}

export async function requireRole(...allowed: Role[]): Promise<Actor> {
    const actor = await requireActor();

    if (!allowed.includes(actor.role)) {
        throw new Error('FORBIDDEN');
    }

    return actor;
}

/**
 * Tenant scoping (C6). DINKES and ADMIN see everything; PUSKESMAS and
 * RUMAH_SAKIT are confined to their own institution. Every query on ReportRS
 * must go through this so cross-institution reads are impossible by default.
 */
export function scopeToInstitution(actor: Actor): string | null {
    if (actor.role === 'ADMIN' || actor.role === 'DINKES') {
        return null;
    }

    if (!actor.institutionId) {
        throw new Error('FORBIDDEN');
    }

    return actor.institutionId;
}
