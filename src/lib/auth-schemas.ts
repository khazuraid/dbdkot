import { z } from 'zod';

export const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;

export function isValidUsername(value: string): boolean {
    return USERNAME_REGEX.test(value.trim().toLowerCase());
}

export const loginSchema = z.object({
    identifier: z
        .string()
        .trim()
        .min(1, 'Email atau username wajib diisi')
        .superRefine((val, ctx) => {
            if (val.includes('@')) {
                if (!z.email().safeParse(val).success) {
                    ctx.addIssue({
                        code: 'custom',
                        message:
                            'Format email tidak valid (contoh: nama@dinkes.go.id)',
                    });
                }
            } else if (!USERNAME_REGEX.test(val.toLowerCase())) {
                ctx.addIssue({
                    code: 'custom',
                    message:
                        'Username 3–30 karakter (huruf, angka, titik, garis bawah, atau tanda hubung)',
                });
            }
        }),
    password: z.string().min(1, 'Password wajib diisi'),
});

export const registerSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(3, 'Nama lengkap minimal 3 karakter')
            .max(100, 'Nama lengkap maksimal 100 karakter'),
        username: z
            .string()
            .trim()
            .transform((v) => v.toLowerCase())
            .refine(
                (v) => v === '' || USERNAME_REGEX.test(v),
                'Username 3–30 karakter (huruf kecil, angka, titik, _, atau -)',
            )
            .optional(),
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
            .min(8, 'Password minimal 8 karakter')
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
                return Boolean(
                    data.institutionId && data.institutionId.trim().length > 0,
                );
            }
            return true;
        },
        {
            message: 'Pilih fasilitas kesehatan / instansi Anda',
            path: ['institutionId'],
        },
    );

export type RegisterInput = z.infer<typeof registerSchema>;

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
            .min(8, 'Password minimal 8 karakter')
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
