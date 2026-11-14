'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { requireActor } from '@/lib/session';
import { auth } from '@/lib/auth';

const profileUpdateSchema = z.object({
    name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100),
    whatsappPhone: z
        .string()
        .trim()
        .refine(
            (val) => {
                if (!val) return true;
                const cleaned = val.replace(/[\s-]/g, '');
                return /^(\+?62|0|8)[0-9]{7,14}$/.test(cleaned);
            },
            'Nomor HP/WhatsApp tidak valid (contoh: 081234567890 atau 6281234567890)',
        )
        .optional(),
    whatsappOptIn: z.boolean(),
});

export async function updateUserProfileAction(input: {
    name: string;
    whatsappPhone?: string;
    whatsappOptIn: boolean;
}) {
    const parsed = profileUpdateSchema.safeParse(input);
    if (!parsed.success) {
        return {
            ok: false as const,
            error: parsed.error.issues[0]?.message ?? 'Data profil tidak valid.',
        };
    }

    const actor = await requireActor();
    await getDb()
        .update(users)
        .set({
            name: parsed.data.name,
            whatsappPhone: parsed.data.whatsappPhone || null,
            whatsappOptIn: parsed.data.whatsappOptIn,
            updatedAt: new Date(),
        })
        .where(eq(users.id, actor.userId));

    revalidatePath('/pengaturan');
    revalidatePath('/(dashboard)', 'layout');
    return { ok: true as const };
}

export async function saveWhatsAppProfileAction(input: {
    whatsappPhone: string;
    whatsappOptIn: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        const actor = await requireActor();
        await getDb()
            .update(users)
            .set({
                whatsappPhone: input.whatsappPhone.trim() || null,
                whatsappOptIn: input.whatsappOptIn,
                updatedAt: new Date(),
            })
            .where(eq(users.id, actor.userId));

        revalidatePath('/pengaturan');
        return { ok: true };
    } catch (err: unknown) {
        return {
            ok: false,
            error:
                err instanceof Error
                    ? err.message
                    : 'Gagal menyimpan preferensi WhatsApp.',
        };
    }
}

const changePasswordSchema = z
    .object({
        currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi'),
        newPassword: z
            .string()
            .min(10, 'Kata sandi baru minimal 10 karakter')
            .max(100),
        confirmPassword: z.string().min(1, 'Konfirmasi kata sandi wajib diisi'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: 'Konfirmasi kata sandi baru tidak cocok',
        path: ['confirmPassword'],
    });

export async function changeUserPasswordAction(input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}) {
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
        return {
            ok: false as const,
            error:
                parsed.error.issues[0]?.message ??
                'Format kata sandi tidak valid.',
        };
    }

    try {
        await auth.api.changePassword({
            body: {
                currentPassword: parsed.data.currentPassword,
                newPassword: parsed.data.newPassword,
                revokeOtherSessions: false,
            },
            headers: await headers(),
        });
        return { ok: true as const };
    } catch (err: unknown) {
        const message =
            err instanceof Error ? err.message : 'Gagal memperbarui kata sandi.';
        return {
            ok: false as const,
            error:
                message.includes('password') || message.includes('credential')
                    ? 'Kata sandi saat ini tidak tepat atau tidak sesuai.'
                    : message,
        };
    }
}
