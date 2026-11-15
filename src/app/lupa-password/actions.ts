'use server';

import { and, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import { hashPassword } from 'better-auth/crypto';
import { getDb } from '@/db';
import { accounts, sessions, users, verifications } from '@/db/schema';
import { sendOtpEmail } from '@/lib/email';
import {
    checkOtpSendRateLimit,
    clearLoginFailures,
    clearOtpVerifyAttempts,
    generateOtpCode,
    hashOtp,
    recordOtpVerifyAttempt,
    verifyOtpDigest,
} from '@/lib/rate-limit';

export const requestResetSchema = z.object({
    email: z
        .string()
        .trim()
        .min(1, 'Email wajib diisi')
        .email('Format email tidak valid'),
});

export const resetPasswordSchema = z
    .object({
        email: z.string().trim().email('Email tidak valid'),
        otp: z.string().trim().length(6, 'Kode OTP harus berupa 6 digit angka'),
        password: z
            .string()
            .min(7, 'Password minimal 7 karakter')
            .regex(
                /[^a-zA-Z0-9]/,
                'Password wajib mengandung minimal 1 simbol khusus (contoh: @, #, $, !, %, *)',
            )
            .max(100, 'Password maksimal 100 karakter'),
        confirm: z.string().min(1, 'Konfirmasi password wajib diisi'),
    })
    .refine((data) => data.password === data.confirm, {
        message: 'Password baru dan konfirmasi tidak cocok',
        path: ['confirm'],
    });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

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

    // Verify OTP
    const [record] = await db
        .select({
            id: verifications.id,
            value: verifications.value,
        })
        .from(verifications)
        .where(
            and(
                eq(verifications.identifier, identifier),
                gt(verifications.expiresAt, new Date()),
            ),
        )
        .limit(1);

    if (!record) {
        return {
            ok: false as const,
            error: 'Kode OTP tidak valid atau sudah kadaluarsa. Silakan minta kode baru.',
        };
    }

    if (!verifyOtpDigest(record.value, identifier, otp)) {
        const attempt = await recordOtpVerifyAttempt(identifier);
        if (attempt.exhausted) {
            await db.delete(verifications).where(eq(verifications.id, record.id));
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
        return { ok: false as const, error: 'Pengguna tidak ditemukan' };
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

    if (existingAccount) {
        await db
            .update(accounts)
            .set({
                password: passwordHash,
                updatedAt: now,
            })
            .where(eq(accounts.id, existingAccount.id));
    } else {
        await db.insert(accounts).values({
            userId: user.id,
            providerId: 'credential',
            accountId: user.id,
            password: passwordHash,
            createdAt: now,
            updatedAt: now,
        });
    }

    // Revoke old sessions for security
    await db.delete(sessions).where(eq(sessions.userId, user.id));

    // Delete verified OTP
    await db.delete(verifications).where(eq(verifications.id, record.id));

    return { ok: true as const };
}
