'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { getDb } from '@/db';
import { systemSettings, users } from '@/db/schema';
import { audit } from '@/lib/audit';
import { requireActor, requireRole } from '@/lib/session';
import { auth } from '@/lib/auth';
import {
    isSafeBrandingUrl,
    isSecretSettingKey,
    MASKED_SECRET,
} from '@/lib/security';
import {
    assertSafeExternalUrl,
    encryptSettingValue,
    safeFetch,
} from '@/lib/security-server';

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

const whatsappProfileSchema = profileUpdateSchema.pick({
    whatsappPhone: true,
    whatsappOptIn: true,
});

export async function saveWhatsAppProfileAction(input: {
    whatsappPhone: string;
    whatsappOptIn: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
    const parsed = whatsappProfileSchema.safeParse(input);
    if (!parsed.success) {
        return {
            ok: false,
            error:
                parsed.error.issues[0]?.message ??
                'Format nomor WhatsApp tidak valid.',
        };
    }

    try {
        const actor = await requireActor();
        await getDb()
            .update(users)
            .set({
                whatsappPhone: parsed.data.whatsappPhone || null,
                whatsappOptIn: parsed.data.whatsappOptIn,
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
            .min(8, 'Kata sandi baru minimal 8 karakter')
            .regex(
                /[^a-zA-Z0-9]/,
                'Kata sandi baru wajib mengandung minimal 1 simbol (contoh: @, #, $, !, %, &)',
            )
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

    const actor = await requireActor();

    try {
        await auth.api.changePassword({
            body: {
                currentPassword: parsed.data.currentPassword,
                newPassword: parsed.data.newPassword,
                revokeOtherSessions: true,
            },
            headers: await headers(),
        });
        await audit({
            actor,
            action: 'UPDATE',
            entityType: 'USER',
            entityId: actor.userId,
            changes: { password: { from: 'redacted', to: 'updated' } },
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

export type RegionalApiConfig = {
    provider: string;
    baseUrl: string;
    apiKey?: string;
    cityCode: string;
    autoSync: boolean;
    centerLat: number;
    centerLng: number;
    defaultZoom: number;
    clusterRadiusMeters: number;
};

const regionalConfigSchema = z.object({
    provider: z.string().min(1, 'Provider API wajib dipilih'),
    baseUrl: z.string().url('Format URL API Wilayah tidak valid'),
    apiKey: z.string().optional(),
    cityCode: z.string().min(2, 'Kode Wilayah wajib diisi (contoh: 32.74)'),
    autoSync: z.boolean(),
    centerLat: z.number().min(-90).max(90),
    centerLng: z.number().min(-180).max(180),
    defaultZoom: z.number().min(1).max(20),
    clusterRadiusMeters: z.number().min(10).max(5000),
});

export async function saveRegionalApiSettingsAction(input: RegionalApiConfig) {
    const actor = await requireRole('ADMIN');

    const parsed = regionalConfigSchema.safeParse(input);
    if (!parsed.success) {
        return {
            ok: false as const,
            error: parsed.error.issues[0]?.message ?? 'Data konfigurasi wilayah tidak valid.',
        };
    }

    try {
        await assertSafeExternalUrl(parsed.data.baseUrl);
    } catch (err: unknown) {
        return {
            ok: false as const,
            error:
                err instanceof Error
                    ? err.message
                    : 'Base URL API Wilayah tidak aman.',
        };
    }

    const db = getDb();
    const now = new Date();
    const preserveApiKey = parsed.data.apiKey === MASKED_SECRET;

    const keysToUpsert: Array<{
        key: string;
        value: string;
        type: string;
        description: string;
    }> = [
        {
            key: 'REGIONAL_API_PROVIDER',
            value: parsed.data.provider,
            type: 'string',
            description: 'Provider layanan data wilayah administratif',
        },
        {
            key: 'REGIONAL_API_BASE_URL',
            value: parsed.data.baseUrl,
            type: 'string',
            description: 'Base URL API wilayah Kemendagri / BPS / SatuData',
        },
        ...(preserveApiKey
            ? []
            : [
                  {
                      key: 'REGIONAL_API_KEY',
                      value: parsed.data.apiKey ?? '',
                      type: 'string',
                      description: 'API Key / Token integrasi data wilayah',
                  },
              ]),
        {
            key: 'REGIONAL_CODE_CITY',
            value: parsed.data.cityCode,
            type: 'string',
            description: 'Kode wilayah administratif Kota Cirebon',
        },
        {
            key: 'REGIONAL_SYNC_AUTO',
            value: String(parsed.data.autoSync),
            type: 'boolean',
            description: 'Sinkronisasi otomatis poligon batas kelurahan',
        },
        {
            key: 'MAP_CENTER_LAT',
            value: String(parsed.data.centerLat),
            type: 'number',
            description: 'Latitude pusat peta wilayah',
        },
        {
            key: 'MAP_CENTER_LNG',
            value: String(parsed.data.centerLng),
            type: 'number',
            description: 'Longitude pusat peta wilayah',
        },
        {
            key: 'MAP_DEFAULT_ZOOM',
            value: String(parsed.data.defaultZoom),
            type: 'number',
            description: 'Level zoom default peta wilayah',
        },
        {
            key: 'EPIDEMIOLOGY_CLUSTER_RADIUS_METERS',
            value: String(parsed.data.clusterRadiusMeters),
            type: 'number',
            description: 'Radius buffer klaster epidemiologi DBD (meter)',
        },
    ];

    for (const item of keysToUpsert) {
        const secret = isSecretSettingKey(item.key);
        const storedValue = secret
            ? encryptSettingValue(item.value)
            : item.value;
        await db
            .insert(systemSettings)
            .values({
                key: item.key,
                value: storedValue,
                type: item.type,
                category: 'REGIONAL_API',
                description: item.description,
                isPublic: !secret,
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: systemSettings.key,
                set: {
                    value: storedValue,
                    category: 'REGIONAL_API',
                    description: item.description,
                    isPublic: !secret,
                    updatedAt: now,
                },
            });
    }

    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: actor.userId,
        changes: {
            regionalApiSettings: {
                from: null,
                to: { provider: parsed.data.provider, baseUrl: parsed.data.baseUrl },
            },
        },
    });

    revalidatePath('/pengaturan');
    revalidatePath('/admin/kelurahan');
    revalidatePath('/laporan/analitik');
    return { ok: true as const };
}

export async function testRegionalApiConnectionAction(url: string) {
    await requireRole('ADMIN');

    try {
        const parsed = z.string().url().safeParse(url);
        if (!parsed.success) {
            return { ok: false as const, error: 'Format URL API tidak valid' };
        }

        const start = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await safeFetch(parsed.data, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                Accept: 'application/json',
                'User-Agent': 'WALI-EPI-Surveillance/1.0',
            },
        });
        clearTimeout(timeoutId);

        const latency = Date.now() - start;

        if (res.ok || res.status === 404 || res.status === 401 || res.status === 403) {
            return {
                ok: true as const,
                latency,
                status: res.status,
                message: `Server merespon dalam ${latency}ms (HTTP ${res.status} ${res.statusText})`,
            };
        }

        return {
            ok: false as const,
            error: `Server mengembalikan status HTTP ${res.status} ${res.statusText}`,
        };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Koneksi gagal';
        return {
            ok: false as const,
            error: msg.includes('aborted')
                ? 'Koneksi timeout (>6 detik)'
                : `Gagal menghubungi endpoint: ${msg}`,
        };
    }
}

export type BrandingConfig = {
    appTitle: string;
    appTagline: string;
    institutionName: string;
    logoUrl?: string;
    faviconUrl?: string;
    footerText: string;
    emergencyHotline: string;
    supportEmail: string;
};

const brandingSchema = z.object({
    appTitle: z.string().trim().min(2, 'Judul aplikasi minimal 2 karakter').max(100),
    appTagline: z.string().trim().min(3, 'Tagline minimal 3 karakter').max(200),
    institutionName: z.string().trim().min(3, 'Nama instansi minimal 3 karakter').max(150),
    logoUrl: z
        .string()
        .trim()
        .refine(
            (v) => isSafeBrandingUrl(v),
            'URL logo hanya boleh path lokal (/...) atau HTTPS yang valid.',
        )
        .optional(),
    faviconUrl: z
        .string()
        .trim()
        .refine(
            (v) => isSafeBrandingUrl(v),
            'URL favicon hanya boleh path lokal (/...) atau HTTPS yang valid.',
        )
        .optional(),
    footerText: z.string().trim().min(3, 'Teks footer minimal 3 karakter').max(200),
    emergencyHotline: z.string().trim().min(3, 'Nomor darurat wajib diisi').max(50),
    supportEmail: z.string().trim().email('Email dukungan tidak valid'),
});

export async function saveBrandingSettingsAction(input: BrandingConfig) {
    const actor = await requireRole('ADMIN');

    const parsed = brandingSchema.safeParse(input);
    if (!parsed.success) {
        return {
            ok: false as const,
            error: parsed.error.issues[0]?.message ?? 'Data branding tidak valid.',
        };
    }

    const db = getDb();
    const now = new Date();

    const items: Array<{ key: string; value: string; description: string }> = [
        {
            key: 'APP_TITLE',
            value: parsed.data.appTitle,
            description: 'Judul aplikasi / nama portal surveilans',
        },
        {
            key: 'APP_TAGLINE',
            value: parsed.data.appTagline,
            description: 'Subjudul atau tagline sistem',
        },
        {
            key: 'INSTITUTION_NAME',
            value: parsed.data.institutionName,
            description: 'Nama instansi pembina utama',
        },
        {
            key: 'APP_LOGO_URL',
            value: parsed.data.logoUrl ?? '',
            description: 'URL gambar logo utama aplikasi',
        },
        {
            key: 'APP_FAVICON_URL',
            value: parsed.data.faviconUrl ?? '',
            description: 'URL favicon tab browser',
        },
        {
            key: 'APP_FOOTER_TEXT',
            value: parsed.data.footerText,
            description: 'Teks hak cipta / footer portal',
        },
        {
            key: 'EMERGENCY_HOTLINE',
            value: parsed.data.emergencyHotline,
            description: 'Nomor hotline darurat respon DBD',
        },
        {
            key: 'SUPPORT_EMAIL',
            value: parsed.data.supportEmail,
            description: 'Alamat email bantuan teknis',
        },
    ];

    for (const item of items) {
        await db
            .insert(systemSettings)
            .values({
                key: item.key,
                value: item.value,
                type: 'string',
                category: 'BRANDING',
                description: item.description,
                isPublic: true,
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: systemSettings.key,
                set: {
                    value: item.value,
                    category: 'BRANDING',
                    description: item.description,
                    updatedAt: now,
                },
            });
    }

    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: actor.userId,
        changes: { brandingSettings: { from: null, to: parsed.data.appTitle } },
    });

    revalidatePath('/pengaturan');
    revalidatePath('/(dashboard)', 'layout');
    revalidatePath('/');
    return { ok: true as const };
}

const smtpSettingsSchema = z.object({
    host: z.string().trim().min(1, 'Host SMTP wajib diisi'),
    port: z.coerce.number().int().min(1).max(65535),
    secure: z.boolean(),
    user: z.string().trim().min(1, 'Username SMTP wajib diisi'),
    pass: z.string().optional().default(''),
    fromEmail: z.string().trim().email('Email pengirim tidak valid'),
    fromName: z.string().trim().min(1, 'Nama pengirim wajib diisi'),
});

export async function saveSmtpSettingsAction(formData: FormData) {
    const actor = await requireRole('ADMIN');

    const parsed = smtpSettingsSchema.safeParse({
        host: formData.get('host'),
        port: formData.get('port'),
        secure: formData.get('secure') === 'true' || formData.get('secure') === 'on',
        user: formData.get('user'),
        pass: formData.get('pass') ?? '',
        fromEmail: formData.get('fromEmail'),
        fromName: formData.get('fromName'),
    });

    if (!parsed.success) {
        return {
            ok: false as const,
            error: parsed.error.issues[0]?.message || 'Input pengaturan SMTP tidak valid',
        };
    }

    const db = getDb();
    const now = new Date();
    const submittedPass = parsed.data.pass ?? '';
    const isMaskedOrBlank = submittedPass === '' || submittedPass === '••••••••';

    let finalPass = submittedPass;
    if (isMaskedOrBlank) {
        const [existingPass] = await db
            .select({ value: systemSettings.value })
            .from(systemSettings)
            .where(eq(systemSettings.key, 'SMTP_PASS'))
            .limit(1);
        finalPass = existingPass?.value || process.env.SMTP_PASS || '';
        if (!finalPass) {
            return {
                ok: false as const,
                error: 'Password SMTP wajib diisi untuk konfigurasi awal.',
            };
        }
    }

    const items = [
        { key: 'SMTP_HOST', value: parsed.data.host, description: 'Host server SMTP (contoh: smtp.sumopod.com)' },
        { key: 'SMTP_PORT', value: String(parsed.data.port), description: 'Port server SMTP (465 SSL / 587 TLS)' },
        { key: 'SMTP_SECURE', value: String(parsed.data.secure), description: 'Apakah menggunakan SSL langsung' },
        { key: 'SMTP_USER', value: parsed.data.user, description: 'Username autentikasi SMTP' },
        ...(isMaskedOrBlank
            ? []
            : [
                  {
                      key: 'SMTP_PASS',
                      value: encryptSettingValue(finalPass),
                      description: 'Password autentikasi SMTP',
                  },
              ]),
        { key: 'SMTP_FROM_EMAIL', value: parsed.data.fromEmail, description: 'Alamat email pengirim default' },
        { key: 'SMTP_FROM_NAME', value: parsed.data.fromName, description: 'Nama tampilan pengirim email' },
    ];

    for (const item of items) {
        await db
            .insert(systemSettings)
            .values({
                key: item.key,
                value: item.value,
                type: 'string',
                category: 'SMTP',
                description: item.description,
                isPublic: false,
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: systemSettings.key,
                set: {
                    value: item.value,
                    category: 'SMTP',
                    description: item.description,
                    updatedAt: now,
                },
            });
    }

    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: actor.userId,
        changes: {
            smtpSettings: {
                from: null,
                to: { host: parsed.data.host, port: parsed.data.port },
            },
        },
    });

    revalidatePath('/pengaturan');
    return { ok: true as const };
}

export async function testSmtpConnectionAction(targetEmail?: string) {
    const actor = await requireRole('ADMIN');

    try {
        const { createTransporter, sendEmail } = await import('@/lib/email');
        const transporter = await createTransporter();
        await transporter.verify();

        const recipient = targetEmail?.trim() || actor.userId;
        // Find recipient email if recipient is userId or email
        let to = recipient;
        if (!to.includes('@')) {
            const db = getDb();
            const [u] = await db
                .select({ email: users.email })
                .from(users)
                .where(eq(users.id, actor.userId))
                .limit(1);
            to = u?.email || '';
        }

        if (to && to.includes('@')) {
            await sendEmail({
                to,
                subject: '[WALI-EPI] Uji Coba Pengiriman Email SMTP Sumopod Berhasil',
                text: 'Koneksi ke server SMTP Sumopod berhasil! Layanan pengiriman email siap digunakan untuk verifikasi OTP pendaftaran dan reset kata sandi.',
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h2 style="color: #0d9488; margin-top: 0;">Uji Coba SMTP Sumopod Berhasil!</h2>
                        <p>Koneksi server SMTP berjalan normal dan siap mengirim email verifikasi OTP serta notifikasi sistem WALI-EPI.</p>
                        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
                        <small style="color: #64748b;">WALI-EPI Kota Cirebon &bull; Layanan Email Sumopod</small>
                    </div>
                `,
            });
        }

        return { ok: true as const, recipient: to };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Gagal menghubungkan ke server SMTP';
        return { ok: false as const, error: message };
    }
}

