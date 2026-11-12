import { z } from 'zod';

/**
 * Field contracts shared by the server domain modules and the client forms.
 *
 * These live apart from the domain modules on purpose: those import the Drizzle
 * client, and a client component importing the schema from there drags
 * `postgres` into the browser bundle. This module imports nothing but zod, so
 * both runtimes can use one definition — the browser validates against exactly
 * what the server enforces.
 */

export const createReportSchema = z.object({
    patientName: z.string().trim().min(3, 'Nama minimal 3 karakter'),
    patientNik: z
        .string()
        .trim()
        .regex(/^\d{16}$/, 'NIK harus 16 angka'),
    patientAddress: z.string().trim().min(5, 'Alamat minimal 5 karakter'),
    patientAge: z.coerce.number().int().min(0).max(130),
    patientGender: z.enum(['L', 'P']),
    caseType: z.enum(['DENGUE', 'SUSPECTED_DENGUE', 'DHF', 'DSS']),
    kelurahan: z.string().trim().min(2, 'Kelurahan wajib diisi'),
    kecamatan: z.string().trim().min(2, 'Kecamatan wajib diisi'),
    kota: z.string().trim().min(2, 'Kota wajib diisi'),
    provinsi: z.string().trim().min(2, 'Provinsi wajib diisi'),
    admissionDate: z.coerce
        .date()
        .refine(
            (d) => d.getTime() <= Date.now(),
            'Tanggal masuk tidak boleh di masa depan',
        ),
    symptomOnsetDate: z.coerce.date().optional(),
    diagnosisDate: z.coerce.date().optional(),
    phoneNumber: z.string().trim().max(20).optional(),
    plateletCount: z.coerce.number().int().min(0).max(2_000_000).optional(),
    diagnosis: z.string().trim().max(500).optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

export const householdSchema = z.object({
    address: z.string().trim().min(3, 'Alamat wajib diisi'),
    houseCount: z.coerce.number().int().min(1, 'Jumlah rumah minimal 1'),
    population: z.coerce.number().int().min(0),
    larvaCount: z.coerce.number().int().min(0),
    larvaType: z.string().trim().max(100).optional(),
    // Sent as real JSON booleans; coerce would turn the string "false" into true.
    abateUsed: z.boolean().optional(),
});

export const createPeSchema = z.object({
    reportRSId: z.uuid('Laporan wajib dipilih'),
    peDate: z.coerce.date(),
    officerName: z.string().trim().min(3, 'Nama petugas wajib diisi'),
    sourceLocation: z.string().trim().max(300).optional(),
    conclusion: z.string().trim().max(1000).optional(),
    recommendation: z.string().trim().max(1000).optional(),
    households: z.array(householdSchema).min(1, 'Minimal satu rumah diperiksa'),
});

export type CreatePeInput = z.infer<typeof createPeSchema>;
