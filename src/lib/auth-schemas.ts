import { z } from 'zod';

export const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .min(1, 'Email wajib diisi')
        .email('Format email tidak valid (contoh: nama@dinkes.go.id)'),
    password: z.string().min(1, 'Password wajib diisi'),
});

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
