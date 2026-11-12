import { connection } from 'next/server';
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
 *
 * Deliberately renders per request: patient data must never come from a
 * prerendered or cached shell, so every screen that calls this calls
 * `connection()` and is dynamic by fact rather than by config flag.
 */
export async function requireActor(): Promise<Actor> {
    await connection();

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
        // A staff account detached from its institution has no data to see.
        // Callers that can recover (a page) turn this into a 403; without the
        // explicit code it would surface as a bare 500 on every screen.
        throw new Error('NO_INSTITUTION');
    }

    return actor.institutionId;
}
