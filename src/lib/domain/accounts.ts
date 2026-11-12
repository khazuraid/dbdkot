import { and, count, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { institutions, users } from '@/db/schema';
import { auth } from '@/lib/auth';
import { audit } from '@/lib/audit';
import type { Role } from '@/lib/roles';
import type { Actor } from '@/lib/session';

// Field contract lives in form-contracts.ts (zod only) so the client can import
// the same rules without dragging the auth instance and DB client into the bundle.
export { createAccountSchema, needsInstitution } from './form-contracts';
import {
    needsInstitution,
    type CreateAccountInput,
} from './form-contracts';

export type AccountStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type AccountResult = { ok: true; id: string } | { ok: false; error: string };

/** Email is the login identity and unique, so a duplicate is a field error. */
function duplicateEmail(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === '23505'
    );
}

/**
 * Minting a user has to go through better-auth, never a hand-written INSERT:
 * the password column holds an scrypt hash in a format better-auth owns.
 * `signUpEmail` is used rather than the admin plugin so this deployment keeps
 * one auth surface; the role is then written with an UPDATE because `role`,
 * `status` and `isActive` are all `input: false`. The account-creation hook
 * leaves every new row PENDING and inactive, so this function approves it as
 * its final step — the caller must already be an ADMIN.
 */
export async function createAccount(
    actor: Actor,
    input: CreateAccountInput,
): Promise<AccountResult> {
    if (actor.role !== 'ADMIN') return { ok: false, error: 'FORBIDDEN' };

    const db = getDb();

    try {
        const created = await auth.api.signUpEmail({
            body: {
                email: input.email,
                password: input.password,
                name: input.name,
            },
        });

        await db
            .update(users)
            .set({
                role: input.role,
                institutionId:
                    needsInstitution(input.role) && input.institutionId
                        ? input.institutionId
                        : null,
                status: 'APPROVED',
                isActive: true,
            })
            .where(eq(users.id, created.user.id));

        await audit({
            actor,
            action: 'CREATE',
            entityType: 'USER',
            entityId: created.user.id,
            changes: {
                email: { from: null, to: input.email },
                role: { from: null, to: input.role },
                status: { from: 'PENDING', to: 'APPROVED' },
            },
        });

        return { ok: true, id: created.user.id };
    } catch (error) {
        if (duplicateEmail(error)) {
            return {
                ok: false,
                error: 'Email ini sudah terdaftar. Gunakan alamat lain.',
            };
        }
        console.error('createAccount failed', error);
        return { ok: false, error: 'Akun gagal dibuat. Coba lagi.' };
    }
}

/**
 * Approve a PENDING (or previously rejected) self-registration. The role and
 * institution are chosen here rather than at sign-up, so the applicant cannot
 * pick a tenant they do not belong to.
 */
export async function approveAccount(
    actor: Actor,
    userId: string,
    role: Role,
    institutionId: string | null,
): Promise<AccountResult> {
    if (actor.role !== 'ADMIN') return { ok: false, error: 'FORBIDDEN' };
    if (needsInstitution(role) && !institutionId) {
        return { ok: false, error: 'Institusi wajib dipilih untuk peran ini' };
    }

    const db = getDb();
    const [before] = await db
        .select({ status: users.status, role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!before) return { ok: false, error: 'Akun tidak ditemukan.' };

    await db
        .update(users)
        .set({
            status: 'APPROVED',
            isActive: true,
            role,
            institutionId:
                needsInstitution(role) ? institutionId : null,
        })
        .where(eq(users.id, userId));

    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: userId,
        changes: {
            status: { from: before.status, to: 'APPROVED' },
            role: { from: before.role, to: role },
        },
    });

    return { ok: true, id: userId };
}

export async function rejectAccount(
    actor: Actor,
    userId: string,
): Promise<AccountResult> {
    if (actor.role !== 'ADMIN') return { ok: false, error: 'FORBIDDEN' };

    const db = getDb();
    const [before] = await db
        .select({ status: users.status })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!before) return { ok: false, error: 'Akun tidak ditemukan.' };

    // Only a not-yet-approved account is rejectable; revoking a live one is
    // a disable, which is a different decision and leaves a different trail.
    if (before.status !== 'PENDING') {
        return { ok: false, error: 'Hanya pendaftaran yang menunggu bisa ditolak.' };
    }

    await db
        .update(users)
        .set({ status: 'REJECTED', isActive: false })
        .where(eq(users.id, userId));

    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: userId,
        changes: { status: { from: 'PENDING', to: 'REJECTED' } },
    });

    return { ok: true, id: userId };
}

/**
 * Disable or re-enable an already approved account. The session hook checks
 * `isActive` on every session creation, so disabling also locks a user out of
 * the next request once the current session expires; deleting sessions here
 * would be faster but would also hide the disable from the audit trail if it
 * failed halfway.
 */
export async function setAccountActive(
    actor: Actor,
    userId: string,
    isActive: boolean,
): Promise<AccountResult> {
    if (actor.role !== 'ADMIN') return { ok: false, error: 'FORBIDDEN' };
    if (userId === actor.userId) {
        return { ok: false, error: 'Tidak bisa menonaktifkan akun sendiri.' };
    }

    const db = getDb();
    const [before] = await db
        .select({ isActive: users.isActive })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!before) return { ok: false, error: 'Akun tidak ditemukan.' };

    await db
        .update(users)
        .set({ isActive })
        .where(eq(users.id, userId));

    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: userId,
        changes: { isActive: { from: before.isActive, to: isActive } },
    });

    return { ok: true, id: userId };
}

/** Admin list, with the approval queue first so pending accounts are not missed. */
export async function listManagedAccounts(page = 1, perPage = 25) {
    const db = getDb();
    const size = Math.min(100, Math.max(1, perPage));
    const current = Math.max(1, Math.floor(page));
    const offset = (current - 1) * size;

    const [rows, [totals], [pending]] = await Promise.all([
        db
            .select({
                id: users.id,
                name: users.name,
                email: users.email,
                role: users.role,
                status: users.status,
                isActive: users.isActive,
                institutionId: users.institutionId,
                institutionName: institutions.name,
                createdAt: users.createdAt,
            })
            .from(users)
            .leftJoin(institutions, eq(institutions.id, users.institutionId))
            .orderBy(
                sql`case ${users.status} when 'PENDING' then 0 else 1 end`,
                users.name,
            )
            .limit(size)
            .offset(offset),
        db.select({ n: count() }).from(users),
        db
            .select({ n: count() })
            .from(users)
            .where(and(eq(users.status, 'PENDING'))),
    ]);

    return {
        rows,
        page: current,
        perPage: size,
        total: Number(totals?.n ?? 0),
        pending: Number(pending?.n ?? 0),
    };
}

/** Options for the institution pickers; small enough to send whole. */
export async function institutionOptions() {
    return getDb()
        .select({ id: institutions.id, name: institutions.name, type: institutions.type })
        .from(institutions)
        .where(eq(institutions.isActive, true))
        .orderBy(institutions.name)
        .limit(500);
}
