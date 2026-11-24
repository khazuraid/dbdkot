'use server';

import { and, eq, gt } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { getDb } from '@/db';
import { accounts, sessions, users, verifications } from '@/db/schema';
import {
    requestResetSchema,
    resetPasswordSchema,
    type ResetPasswordInput,
} from '@/lib/auth-schemas';
import { sendOtpEmail } from '@/lib/email';
import {
    checkOtpSendRateLimit,
    clearLoginFailures,
    clearOtpVerifyAttempts,
    generateOtpCode,
    hashOtp,
    recordOtpVerifyAttempt,
} from '@/lib/rate-limit';

/**
 * Step 1: Send OTP to user's registered email address for password reset.
 */
export async function sendResetPasswordOtpAction(rawEmail: string) {
    const parsed = requestResetSchema.safeParse({ email: rawEmail });
    if (!parsed.success) {
        return {
            ok: false as const,
            error: parsed.error.issues[0]?.message || 'Email tidak valid',
        };
    }

    const email = parsed.data.email.toLowerCase().trim();

    const rateCheck = await checkOtpSendRateLimit('reset', email);
    if (!rateCheck.allowed) {
        return {
            ok: false as const,
            error: rateCheck.error || 'Terlalu banyak permintaan OTP.',
        };
    }

    const db = getDb();

    // Verify user exists in system without leaking whether the email is registered
    const [user] = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    if (!user) {
        // Equalize timing to avoid email enumeration via latency oracle
        hashOtp(`reset-otp:${email}`, generateOtpCode());
        await new Promise((r) => setTimeout(r, 150 + Math.floor(Math.random() * 100)));
        return { ok: true as const };
    }

    // Generate cryptographically random 6-digit OTP and store keyed HMAC digest
    const otp = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const identifier = `reset-otp:${email}`;

    await db.delete(verifications).where(eq(verifications.identifier, identifier));
    await db.insert(verifications).values({
        identifier,
        value: hashOtp(identifier, otp),
        expiresAt,
    });
    await clearOtpVerifyAttempts(identifier);

    // Send OTP via Sumopod SMTP
    try {
        await sendOtpEmail(email, otp, 'RESET_PASSWORD');
    } catch (err: unknown) {
        console.error('Failed to send reset password OTP email:', err);
        return {
            ok: false as const,
            error:
                'Gagal mengirim kode OTP ke email. Pastikan koneksi server SMTP di pengaturan Admin sudah benar.',
        };
    }

    return { ok: true as const };
}

/**
 * Step 2: Verify OTP code and update password in accounts table.
 */
export async function verifyAndResetPasswordAction(input: ResetPasswordInput) {
    const parsed = resetPasswordSchema.safeParse(input);
    if (!parsed.success) {
        return {
            ok: false as const,
            error: parsed.error.issues[0]?.message || 'Data tidak valid',
            fieldErrors: parsed.error.issues.reduce<Record<string, string>>((acc, issue) => {
                const key = String(issue.path[0]);
                if (key) acc[key] = issue.message;
                return acc;
            }, {}),
        };
    }

    const { email, otp, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const db = getDb();
    const identifier = `reset-otp:${normalizedEmail}`;

    // Atomically consume matching unexpired OTP so concurrent requests cannot race
    const expectedDigest = hashOtp(identifier, otp);
    const [consumed] = await db
        .delete(verifications)
        .where(
            and(
                eq(verifications.identifier, identifier),
                eq(verifications.value, expectedDigest),
                gt(verifications.expiresAt, new Date()),
            ),
        )
        .returning({ id: verifications.id });

    if (!consumed) {
        const [existingOtp] = await db
            .select({ id: verifications.id })
            .from(verifications)
            .where(
                and(
                    eq(verifications.identifier, identifier),
                    gt(verifications.expiresAt, new Date()),
                ),
            )
            .limit(1);

        if (!existingOtp) {
            return {
                ok: false as const,
                error: 'Kode OTP tidak valid atau sudah kadaluarsa. Silakan minta kode baru.',
            };
        }

        const attempt = await recordOtpVerifyAttempt(identifier);
        if (attempt.exhausted) {
            await db.delete(verifications).where(eq(verifications.id, existingOtp.id));
            return {
                ok: false as const,
                error: 'Terlalu banyak percobaan OTP gagal. Silakan minta kode OTP baru.',
            };
        }
        return {
            ok: false as const,
            error: `Kode OTP salah. Sisa percobaan: ${attempt.remaining} kali.`,
        };
    }

    // Find user
    const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

    if (!user) {
        return { ok: false as const, error: 'Kode OTP tidak valid atau sudah kadaluarsa. Silakan minta kode baru.' };
    }

    await clearOtpVerifyAttempts(identifier);
    await clearLoginFailures(normalizedEmail);

    // Hash new password using better-auth scrypt
    const passwordHash = await hashPassword(password);
    const now = new Date();

    // Update or create credential in accounts table
    const [existingAccount] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(
            and(
                eq(accounts.userId, user.id),
                eq(accounts.providerId, 'credential'),
            ),
        )
        .limit(1);

    await db.transaction(async (tx) => {
        if (existingAccount) {
            await tx
                .update(accounts)
                .set({
                    password: passwordHash,
                    updatedAt: now,
                })
                .where(eq(accounts.id, existingAccount.id));
        } else {
            await tx.insert(accounts).values({
                userId: user.id,
                providerId: 'credential',
                accountId: user.id,
                password: passwordHash,
                createdAt: now,
                updatedAt: now,
            });
        }

        // Revoke old sessions for security
        await tx.delete(sessions).where(eq(sessions.userId, user.id));
    });

    return { ok: true as const };
}
