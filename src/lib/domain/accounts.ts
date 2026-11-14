import { and, count, eq, ilike, ne, or, sql, type SQL } from 'drizzle-orm';
import { APIError } from 'better-auth';
import { hashPassword } from 'better-auth/crypto';
import { getDb } from '@/db';
import { accounts, institutions, sessions, users } from '@/db/schema';
import { auth } from '@/lib/auth';
import { audit } from '@/lib/audit';
import type { Role } from '@/lib/roles';
import type { Actor } from '@/lib/session';

// Field contract lives in form-contracts.ts (zod only) so the client can import
// the same rules without dragging the auth instance and DB client into the bundle.
export {
    createAccountSchema,
    needsInstitution,
    updateAccountSchema,
} from './form-contracts';
import {
    needsInstitution,
    type CreateAccountInput,
    type UpdateAccountInput,
} from './form-contracts';

export type AccountStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type AccountResult =
    { ok: true; id: string } | { ok: false; error: string };

/** Email is the login identity and unique, so a duplicate is a field error. */
function duplicateEmail(error: unknown): boolean {
    if (error instanceof APIError) {
        if (error.status === 'UNPROCESSABLE_ENTITY' || error.statusCode === 422) {
            return true;
        }
        const code =
            typeof error.body === 'object' &&
            error.body !== null &&
            'code' in error.body
                ? String((error.body as { code?: unknown }).code)
                : '';
        if (code.includes('USER_ALREADY_EXISTS')) return true;
    }
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
 * leaves every new row PENDING and inactive — which makes `signUpEmail`'s
 * follow-up session creation throw `FORBIDDEN` — so we catch that expected
 * gate and approve the created row as our final step.
 */
export async function createAccount(
    actor: Actor,
    input: CreateAccountInput,
): Promise<AccountResult> {
    if (actor.role !== 'ADMIN') return { ok: false, error: 'FORBIDDEN' };

    const db = getDb();

    const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

    if (existing) {
        return {
            ok: false,
            error: 'Email ini sudah terdaftar. Gunakan alamat lain.',
        };
    }

    // The sign-up hook deliberately parks every new account at PENDING, so an
    // admin-made account is created first and then approved. If the approve
    // below fails it is rolled back: an account stuck at PENDING with an email
    // that is now taken cannot be recreated, and the operator was told it
    // failed.
    let createdId: string | null = null;

    try {
        const created = await auth.api
            .signUpEmail({
                body: {
                    email: input.email,
                    password: input.password,
                    name: input.name,
                },
            })
            .catch((error) => {
                // `databaseHooks.session.create.before` aborts auto sign-in for
                // PENDING accounts with FORBIDDEN; the user row is already saved.
                const isForbidden =
                    error instanceof APIError &&
                    (error.status === 'FORBIDDEN' || error.statusCode === 403);
                if (!isForbidden) {
                    throw error;
                }
                return null;
            });

        if (created?.user?.id) {
            createdId = created.user.id;
        } else {
            const [row] = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.email, input.email))
                .limit(1);
            createdId = row?.id ?? null;
        }

        if (!createdId) {
            throw new Error('signUpEmail selesai tetapi user tidak ditemukan.');
        }

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
                emailVerified: true,
            })
            .where(eq(users.id, createdId));

        await audit({
            actor,
            action: 'CREATE',
            entityType: 'USER',
            entityId: createdId,
            changes: {
                email: { from: null, to: input.email },
                role: { from: null, to: input.role },
                status: { from: 'PENDING', to: 'APPROVED' },
            },
        });

        return { ok: true, id: createdId };
    } catch (error) {
        if (duplicateEmail(error)) {
            return {
                ok: false,
                error: 'Email ini sudah terdaftar. Gunakan alamat lain.',
            };
        }
        console.error('createAccount failed', error);
        if (createdId) {
            // Compensate: sessions and accounts cascade from the user row.
            await db
                .delete(users)
                .where(eq(users.id, createdId))
                .catch(() => undefined);
        }
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

    // Approval is a transition, not an assignment: re-approving a live
    // account would silently rewrite its role and tenant.
    if (before.status !== 'PENDING') {
        return {
            ok: false,
            error: 'Hanya pendaftaran yang menunggu bisa disetujui.',
        };
    }

    await db
        .update(users)
        .set({
            status: 'APPROVED',
            isActive: true,
            role,
            institutionId: needsInstitution(role) ? institutionId : null,
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
        return {
            ok: false,
            error: 'Hanya pendaftaran yang menunggu bisa ditolak.',
        };
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
        .select({ status: users.status, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!before) return { ok: false, error: 'Akun tidak ditemukan.' };

    // Only an approved account can be switched. Turning a rejected or
    // still-pending row back on would hand a login to an account the roster
    // still labels "Ditolak" — approval is the gate, not this switch.
    if (before.status !== 'APPROVED') {
        return {
            ok: false,
            error: 'Hanya akun yang sudah disetujui bisa diaktifkan.',
        };
    }

    await db.update(users).set({ isActive }).where(eq(users.id, userId));

    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: userId,
        changes: { isActive: { from: before.isActive, to: isActive } },
    });

    return { ok: true, id: userId };
}

/**
 * Update an account's identity, role/institution binding (when APPROVED and not
 * the caller's own account), and optionally reset its credential password.
 */
export async function updateAccount(
    actor: Actor,
    input: UpdateAccountInput,
): Promise<AccountResult> {
    if (actor.role !== 'ADMIN') return { ok: false, error: 'FORBIDDEN' };

    const db = getDb();
    const [before] = await db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            institutionId: users.institutionId,
            status: users.status,
        })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

    if (!before) return { ok: false, error: 'Akun tidak ditemukan.' };

    const [taken] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, input.email), ne(users.id, input.userId)))
        .limit(1);

    if (taken) {
        return {
            ok: false,
            error: 'Email ini sudah terdaftar. Gunakan alamat lain.',
        };
    }

    const isSelf = input.userId === actor.userId;
    let nextRole: Role = before.role;
    let nextInstitutionId: string | null = before.institutionId;

    if (before.status === 'APPROVED') {
        if (isSelf) {
            if (input.role && input.role !== before.role) {
                return {
                    ok: false,
                    error: 'Tidak bisa mengubah peran akun sendiri.',
                };
            }
            nextRole = before.role;
            nextInstitutionId = needsInstitution(before.role)
                ? (input.institutionId ?? before.institutionId)
                : null;
        } else {
            nextRole = input.role ?? before.role;
            nextInstitutionId = needsInstitution(nextRole)
                ? (input.institutionId ?? null)
                : null;
        }

        if (needsInstitution(nextRole) && !nextInstitutionId) {
            return {
                ok: false,
                error: 'Institusi wajib dipilih untuk peran ini',
            };
        }

        if (nextInstitutionId) {
            const [inst] = await db
                .select({ id: institutions.id, type: institutions.type })
                .from(institutions)
                .where(eq(institutions.id, nextInstitutionId))
                .limit(1);
            if (!inst || inst.type !== nextRole) {
                return {
                    ok: false,
                    error: 'Institusi tidak sesuai dengan peran yang dipilih.',
                };
            }
        }
    }

    try {
        await db
            .update(users)
            .set({
                name: input.name,
                email: input.email,
                role: nextRole,
                institutionId: nextInstitutionId,
            })
            .where(eq(users.id, input.userId));

        if (input.password) {
            const hashedPassword = await hashPassword(input.password);
            const updated = await db
                .update(accounts)
                .set({ password: hashedPassword })
                .where(
                    and(
                        eq(accounts.userId, input.userId),
                        eq(accounts.providerId, 'credential'),
                    ),
                )
                .returning({ id: accounts.id });

            if (updated.length === 0) {
                await db.insert(accounts).values({
                    userId: input.userId,
                    accountId: input.userId,
                    providerId: 'credential',
                    password: hashedPassword,
                });
            }
        }

        const privilegeChanged =
            nextRole !== before.role ||
            nextInstitutionId !== before.institutionId;

        if (!isSelf && (input.password || privilegeChanged)) {
            await db.delete(sessions).where(eq(sessions.userId, input.userId));
        }

        const changes: Record<string, { from: unknown; to: unknown }> = {};
        if (input.name !== before.name) {
            changes.name = { from: before.name, to: input.name };
        }
        if (input.email !== before.email) {
            changes.email = { from: before.email, to: input.email };
        }
        if (nextRole !== before.role) {
            changes.role = { from: before.role, to: nextRole };
        }
        if (nextInstitutionId !== before.institutionId) {
            changes.institutionId = {
                from: before.institutionId,
                to: nextInstitutionId,
            };
        }
        if (input.password) {
            changes.passwordReset = { from: false, to: true };
        }

        if (Object.keys(changes).length > 0) {
            await audit({
                actor,
                action: 'UPDATE',
                entityType: 'USER',
                entityId: input.userId,
                changes,
            });
        }

        return { ok: true, id: input.userId };
    } catch (error) {
        if (duplicateEmail(error)) {
            return {
                ok: false,
                error: 'Email ini sudah terdaftar. Gunakan alamat lain.',
            };
        }
        console.error('updateAccount failed', error);
        return { ok: false, error: 'Akun gagal diperbarui. Coba lagi.' };
    }
}

/** Admin list, with the approval queue first so pending accounts are not missed. */
/** Institutions offered in a picker; the screen says when this cap bites. */
const INSTITUTION_OPTION_LIMIT = 500;

/** Above this the queue shows its first page and says how many remain. */
const PENDING_LIMIT = 50;

export type AccountListFilter =
    | 'ALL'
    | 'ACTIVE'
    | 'INACTIVE'
    | 'PENDING'
    | 'REJECTED';

export async function listManagedAccounts(
    pageOrOpts:
        | number
        | {
              page?: number;
              perPage?: number;
              q?: string;
              filter?: AccountListFilter;
          } = 1,
    perPage = 25,
) {
    const db = getDb();
    const opts =
        typeof pageOrOpts === 'number'
            ? { page: pageOrOpts, perPage }
            : pageOrOpts;
    const size = Math.min(100, Math.max(1, opts.perPage ?? perPage));
    const current = Math.max(1, Math.floor(opts.page ?? 1));
    const offset = (current - 1) * size;

    const conditions: SQL[] = [];
    const search = opts.q?.trim();
    if (search) {
        const searchCond = or(
            ilike(users.name, `%${search}%`),
            ilike(users.email, `%${search}%`),
        );
        if (searchCond) conditions.push(searchCond);
    }
    if (opts.filter === 'ACTIVE') {
        conditions.push(and(eq(users.status, 'APPROVED'), eq(users.isActive, true))!);
    } else if (opts.filter === 'INACTIVE') {
        conditions.push(
            and(eq(users.status, 'APPROVED'), eq(users.isActive, false))!,
        );
    } else if (opts.filter === 'PENDING') {
        conditions.push(eq(users.status, 'PENDING'));
    } else if (opts.filter === 'REJECTED') {
        conditions.push(eq(users.status, 'REJECTED'));
    }
    const where: SQL | undefined =
        conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totals], [summaryRow], waiting] = await Promise.all([
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
            .where(where)
            .orderBy(
                sql`case ${users.status} when 'PENDING' then 0 else 1 end`,
                users.name,
            )
            .limit(size)
            .offset(offset),
        db.select({ n: count() }).from(users).where(where),
        db
            .select({
                total: count(),
                active: sql<number>`count(*) filter (where ${users.status} = 'APPROVED' and ${users.isActive} = true)`.mapWith(
                    Number,
                ),
                pending: sql<number>`count(*) filter (where ${users.status} = 'PENDING')`.mapWith(
                    Number,
                ),
                inactive: sql<number>`count(*) filter (where ${users.status} = 'APPROVED' and ${users.isActive} = false)`.mapWith(
                    Number,
                ),
            })
            .from(users),
        // The approval queue is a list in its own right: a pending account
        // past the current page would otherwise never be reachable, because
        // the roster sorts approved and pending together.
        db
            .select({
                id: users.id,
                name: users.name,
                email: users.email,
                role: users.role,
            })
            .from(users)
            .where(eq(users.status, 'PENDING'))
            .orderBy(users.createdAt)
            .limit(PENDING_LIMIT),
    ]);

    return {
        rows,
        page: current,
        perPage: size,
        total: Number(totals?.n ?? 0),
        pending: Number(summaryRow?.pending ?? 0),
        summary: {
            total: Number(summaryRow?.total ?? 0),
            active: Number(summaryRow?.active ?? 0),
            pending: Number(summaryRow?.pending ?? 0),
            inactive: Number(summaryRow?.inactive ?? 0),
        },
        waiting,
    };
}

/** Options for the institution pickers; small enough to send whole. */
export async function institutionOptions() {
    return (
        getDb()
            .select({
                id: institutions.id,
                name: institutions.name,
                type: institutions.type,
            })
            .from(institutions)
            .where(eq(institutions.isActive, true))
            .orderBy(institutions.name)
            // The picker states it when this cap hides an institution; assigning
            // to a hidden one would otherwise be impossible with no explanation.
            .limit(INSTITUTION_OPTION_LIMIT)
    );
}
