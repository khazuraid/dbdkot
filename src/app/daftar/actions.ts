'use server';

import { and, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { institutions, users, verifications } from '@/db/schema';
import { auth } from '@/lib/auth';
import { sendOtpEmail } from '@/lib/email';
import {
    checkOtpSendRateLimit,
    clearOtpVerifyAttempts,
    generateOtpCode,
    hashOtp,
    recordOtpVerifyAttempt,
    verifyOtpDigest,
} from '@/lib/rate-limit';
import { type Role } from '@/lib/roles';

export const registerSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(3, 'Nama lengkap minimal 3 karakter')
            .max(100, 'Nama lengkap maksimal 100 karakter'),
        email: z
            .string()
            .trim()
            .min(1, 'Email wajib diisi')
            .email('Format email tidak valid (contoh: nama@instansi.go.id)'),
        role: z.enum(['PUSKESMAS', 'RUMAH_SAKIT', 'DINKES'], {
            message: 'Pilih peran instansi yang sesuai',
        }),
        institutionId: z.string().optional().nullable(),
        password: z
            .string()
            .min(7, 'Password minimal 7 karakter')
            .regex(
                /[^a-zA-Z0-9]/,
                'Password wajib mengandung minimal 1 simbol (contoh: @, #, $, !, %, &)',
            )
            .max(100, 'Password maksimal 100 karakter'),
        confirm: z.string().min(1, 'Konfirmasi password wajib diisi'),
    })
    .refine((data) => data.password === data.confirm, {
        message: 'Password dan konfirmasi tidak sama',
        path: ['confirm'],
    })
    .refine(
        (data) => {
            if (data.role === 'PUSKESMAS' || data.role === 'RUMAH_SAKIT') {
                return Boolean(data.institutionId && data.institutionId.trim().length > 0);
            }
            return true;
        },
        {
            message: 'Pilih fasilitas kesehatan / instansi Anda',
            path: ['institutionId'],
        },
    );

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Step 1: Validate registration details and send a 6-digit OTP code to applicant email.
 */
export async function sendRegisterOtpAction(input: RegisterInput) {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
        return {
            ok: false as const,
            error: parsed.error.issues[0]?.message || 'Data registrasi tidak valid',
            fieldErrors: parsed.error.issues.reduce<Record<string, string>>((acc, issue) => {
                const key = String(issue.path[0]);
                if (key) acc[key] = issue.message;
                return acc;
            }, {}),
        };
    }

    const { email, role, institutionId } = parsed.data;
    const db = getDb();
    const normalizedEmail = email.toLowerCase().trim();

    const rateCheck = await checkOtpSendRateLimit('register', normalizedEmail);
    if (!rateCheck.allowed) {
        return {
            ok: false as const,
            error: rateCheck.error || 'Terlalu banyak permintaan OTP.',
        };
    }

    // Check if email is already registered
    const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

    if (existing) {
        return {
            ok: false as const,
            error: 'Alamat email ini sudah terdaftar. Silakan masuk atau gunakan fitur lupa kata sandi.',
        };
    }

    // Verify institution exists if role is PUSKESMAS / RUMAH_SAKIT
    if (role === 'PUSKESMAS' || role === 'RUMAH_SAKIT') {
        const [inst] = await db
            .select({ id: institutions.id, type: institutions.type })
            .from(institutions)
            .where(eq(institutions.id, institutionId!))
            .limit(1);

        if (!inst || inst.type !== role) {
            return {
                ok: false as const,
                error: 'Fasilitas kesehatan tidak valid atau tidak cocok dengan peran yang dipilih.',
            };
        }
    }

    // Generate cryptographically random 6-digit OTP and store keyed HMAC digest
    const otp = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const identifier = `register-otp:${normalizedEmail}`;

    await db.delete(verifications).where(eq(verifications.identifier, identifier));
    await db.insert(verifications).values({
        identifier,
        value: hashOtp(identifier, otp),
        expiresAt,
    });
    await clearOtpVerifyAttempts(identifier);

    // Send OTP via Sumopod SMTP
    try {
        await sendOtpEmail(normalizedEmail, otp, 'REGISTER');
    } catch (err: unknown) {
        console.error('Failed to send registration OTP email:', err);
        return {
            ok: false as const,
            error:
                'Gagal mengirim kode OTP ke email. Pastikan server SMTP di pengaturan Admin sudah dikonfigurasi dengan benar.',
        };
    }

    return { ok: true as const };
}

/**
 * Step 2: Verify the 6-digit OTP and create the pending user account.
 */
export async function verifyAndRegisterAction(input: RegisterInput & { otp: string }) {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
        return {
            ok: false as const,
            error: parsed.error.issues[0]?.message || 'Data registrasi tidak valid',
        };
    }

    const otpCode = input.otp?.trim();
    if (!otpCode || otpCode.length !== 6) {
        return { ok: false as const, error: 'Kode OTP harus berupa 6 digit angka' };
    }

    const { name, email, password, role, institutionId } = parsed.data;
    const db = getDb();
    const normalizedEmail = email.toLowerCase().trim();
    const identifier = `register-otp:${normalizedEmail}`;

    // Verify OTP code
    const [record] = await db
        .select({
            id: verifications.id,
            value: verifications.value,
            expiresAt: verifications.expiresAt,
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

    if (!verifyOtpDigest(record.value, identifier, otpCode)) {
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

    // Delete used OTP and clear failure counter
    await db.delete(verifications).where(eq(verifications.id, record.id));
    await clearOtpVerifyAttempts(identifier);

    // Register user through Better-Auth
    try {
        await auth.api.signUpEmail({
            body: {
                name,
                email: normalizedEmail,
                password,
            },
        });
    } catch (err: unknown) {
        console.error('Better-Auth signUpEmail failed:', err);
        const msg = err instanceof Error ? err.message : 'Pendaftaran gagal';
        return { ok: false as const, error: msg };
    }

    // Assign requested role and institution (parks at PENDING awaiting admin approval)
    const [createdUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

    if (createdUser) {
        await db
            .update(users)
            .set({
                role: role as Role,
                institutionId: role === 'DINKES' ? null : institutionId,
                status: 'PENDING',
                isActive: false,
                emailVerified: true,
                updatedAt: new Date(),
            })
            .where(eq(users.id, createdUser.id));
    }

    return { ok: true as const };
}
