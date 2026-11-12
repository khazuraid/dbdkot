import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth';

/**
 * Creates the first administrator. Run with `npm run db:seed-admin`.
 *
 * The account has to be minted through better-auth's own sign-up path, not a
 * hand-written INSERT: the password column holds a scrypt hash in a format
 * better-auth owns, and a hand-rolled one would simply not authenticate.
 *
 * `role` is set afterwards with an UPDATE because `user.role` is declared
 * `input: false` in `lib/auth.ts` — the server, not the request, decides a
 * role. That is also why the public sign-up form cannot mint an ADMIN, and why
 * this script also clears the PENDING/inactive state that the user-create hook
 * gives every new row.
 *
 * Idempotent on purpose: a second run finds the account and stops without
 * touching it, so this is safe to leave in a deploy script.
 *
 * Config is checked before any import runs: importing `@/lib/auth` reads
 * `BETTER_AUTH_SECRET` and touching the database needs `DATABASE_URL`, and
 * failing with "DATABASE_URL is not set" when the real mistake was a missing
 * ADMIN_EMAIL sends people after the wrong problem.
 */
function readConfig() {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME?.trim() || 'Administrator';

    const problems: string[] = [];
    if (!email) problems.push('ADMIN_EMAIL belum diisi');
    if (!password) problems.push('ADMIN_PASSWORD belum diisi');
    // Mirrors `minPasswordLength: 10` in lib/auth.ts.
    else if (password.length < 10) problems.push('ADMIN_PASSWORD minimal 10 karakter');
    if (!process.env.DATABASE_URL) problems.push('DATABASE_URL belum diisi');
    if (!process.env.BETTER_AUTH_SECRET) problems.push('BETTER_AUTH_SECRET belum diisi');

    if (problems.length) {
        console.error(
            'Konfigurasi belum lengkap:\n' +
                problems.map((p) => `  - ${p}`).join('\n') +
                '\n\nContoh:\n  ADMIN_EMAIL=admin@contoh.id ADMIN_PASSWORD=... npm run db:seed-admin',
        );
        process.exit(1);
    }

    return { email: email!, password: password!, name };
}

async function main() {
    const { email, password, name } = readConfig();

    // Imported only after the config check: these modules read env at import.
    const { getDb } = await import('@/db');
    const { users } = await import('@/db/schema');
    const { auth } = await import('@/lib/auth');

    const db = getDb();

    const [existing] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    if (existing) {
        if (existing.role === 'ADMIN') {
            console.log(`Akun ${email} sudah ada dan sudah ADMIN. Tidak ada yang diubah.`);
            return;
        }

        // Present but not an admin: promote rather than create a second row.
        await db
            .update(users)
            .set({
                role: 'ADMIN',
                isActive: true,
                status: 'APPROVED',
                updatedAt: new Date(),
            })
            .where(eq(users.id, existing.id));

        console.log(`${email} sudah ada; role dinaikkan ke ADMIN.`);
        return;
    }

    // The public route is open now, but every account it creates lands PENDING
    // and inactive (see the user-create hook in lib/auth.ts). This call is not
    // a request from the public, so the seed clears that state right after.
    //
    // Sign-up writes the user row and then mints a session, and the session
    // hook refuses one for a PENDING account — so the FORBIDDEN it raises here
    // is the approval gate working, not a failure to create the account. The
    // row is already there by the time it is thrown; the update below is what
    // makes the account usable.
    await auth.api.signUpEmail({ body: { name, email, password } }).catch((error) => {
        if (!(error instanceof APIError) || error.status !== 'FORBIDDEN') throw error;
    });

    const [created] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    if (!created) {
        throw new Error(
            `sign-up selesai tetapi ${email} tidak ditemukan di tabel users.`,
        );
    }

    await db
        .update(users)
        .set({
            role: 'ADMIN',
            status: 'APPROVED',
            isActive: true,
            emailVerified: true,
            updatedAt: new Date(),
        })
        .where(eq(users.id, created.id));

    console.log(`Admin dibuat: ${email}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Gagal membuat admin:', error instanceof Error ? error.message : error);
        process.exit(1);
    });
