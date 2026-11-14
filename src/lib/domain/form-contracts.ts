import { z } from 'zod';
import {
    boundaryGeoJsonSchema,
    MAX_BOUNDARY_JSON_BYTES,
    type BoundaryGeoJson,
} from '@/lib/geo/boundary-schema';

/**
 * Field contracts shared by the server domain modules and the client forms.
 *
 * These live apart from the domain modules on purpose: those import the Drizzle
 * client, and a client component importing the schema from there drags
 * `postgres` into the browser bundle. This module imports nothing but zod, so
 * both runtimes can use one definition — the browser validates against exactly
 * what the server enforces.
 */

const requiredInt = (min: number, max: number, label: string) =>
    z.preprocess(
        (v) =>
            v === '' || v === null || v === undefined
                ? undefined
                : typeof v === 'number'
                  ? v
                  : Number(v),
        z
            .number({
                error: (iss) =>
                    iss.input === undefined
                        ? `${label} wajib diisi`
                        : `${label} harus berupa angka`,
            })
            .int(`${label} harus bilangan bulat`)
            .min(min, `${label} minimal ${min}`)
            .max(max, `${label} maksimal ${max}`),
    );

const optionalInt = (min: number, max: number, label: string) =>
    z.preprocess(
        (v) =>
            v === '' || v === null || v === undefined || Number.isNaN(v)
                ? undefined
                : typeof v === 'number'
                  ? v
                  : Number(v),
        z
            .number({ error: `${label} harus berupa angka` })
            .int(`${label} harus bilangan bulat`)
            .min(min, `${label} minimal ${min}`)
            .max(max, `${label} maksimal ${max}`)
            .optional(),
    );

const requiredDate = (label: string) =>
    z.preprocess(
        (v) => (v === '' || v === null ? undefined : v),
        z
            .union([z.string(), z.date()], {
                error: `${label} wajib diisi`,
            })
            .pipe(z.coerce.date({ error: `${label} tidak valid` })),
    );

const optionalDate = z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.date({ error: 'Tanggal tidak valid' }).optional(),
);

export const createReportSchema = z.object({
    patientName: z.string().trim().min(3, 'Nama minimal 3 karakter'),
    patientNik: z
        .string()
        .trim()
        .transform((v) => v.replace(/[\s-]/g, ''))
        .refine((v) => /^\d{16}$/.test(v), 'NIK harus 16 digit angka'),
    patientAddress: z.string().trim().min(5, 'Alamat minimal 5 karakter'),
    patientAge: requiredInt(0, 130, 'Umur'),
    patientGender: z.enum(['L', 'P'], {
        error: 'Jenis kelamin wajib dipilih',
    }),
    caseType: z.enum(['DENGUE', 'SUSPECTED_DENGUE', 'DHF', 'DSS'], {
        error: 'Jenis kasus wajib dipilih',
    }),
    kelurahan: z.string().trim().min(2, 'Kelurahan wajib diisi'),
    kecamatan: z.string().trim().min(2, 'Kecamatan wajib diisi'),
    kota: z.string().trim().min(2, 'Kota wajib diisi'),
    provinsi: z.string().trim().min(2, 'Provinsi wajib diisi'),
    admissionDate: requiredDate('Tanggal masuk').refine(
        (d) => d.getTime() <= Date.now(),
        'Tanggal masuk tidak boleh di masa depan',
    ),
    symptomOnsetDate: optionalDate,
    diagnosisDate: optionalDate,
    phoneNumber: z
        .string()
        .trim()
        .refine(
            (v) => {
                if (!v) return true;
                const cleaned = v.replace(/[\s-]/g, '');
                return /^(\+?62|0|8)[0-9]{7,14}$/.test(cleaned);
            },
            'Nomor HP tidak valid. Gunakan format Indonesia (contoh: 081234567890 atau 81234567890)',
        )
        .optional(),
    plateletCount: optionalInt(0, 2_000_000, 'Trombosit'),
    hematocrit: z.preprocess(
        (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
        z.number().min(0).max(100).optional(),
    ),
    ns1Result: z.enum(['POSITIF', 'NEGATIF', 'TIDAK_DIPERIKSA']).optional(),
    igmResult: z.enum(['POSITIF', 'NEGATIF', 'TIDAK_DIPERIKSA']).optional(),
    iggResult: z.enum(['POSITIF', 'NEGATIF', 'TIDAK_DIPERIKSA']).optional(),
    latitude: z.preprocess(
        (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
        z.number().min(-90).max(90).optional(),
    ),
    longitude: z.preprocess(
        (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
        z.number().min(-180).max(180).optional(),
    ),
    sourceType: z.enum(['RS', 'PUSKESMAS_POLI']).optional(),
    diagnosis: z.string().trim().max(500).optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

export const householdSchema = z
    .object({
        address: z.string().trim().min(1, 'Alamat wajib diisi'),
        houseCount: requiredInt(1, 100_000, 'Jumlah rumah'),
        population: requiredInt(0, 1_000_000, 'Jumlah penghuni'),
        larvaCount: requiredInt(0, 100_000, 'Jumlah jentik'),
        larvaType: z.string().trim().max(100).optional(),
        // Sent as real JSON booleans; coerce would turn the string "false" into true.
        abateUsed: z.boolean().optional(),
        insidePositive: z.boolean().optional(),
        outsidePositive: z.boolean().optional(),
        containersChecked: optionalInt(0, 1_000, 'TPA diperiksa'),
        positiveContainers: optionalInt(0, 1_000, 'TPA positif'),
        hasFeverContact: z.boolean().optional(),
        hasBleedingContact: z.boolean().optional(),
    })
    .refine((h) => h.larvaCount <= h.houseCount, {
        path: ['larvaCount'],
        message: 'Jumlah positif jentik tidak boleh melebihi jumlah rumah',
    });

export const createPeSchema = z.object({
    reportRSId: z.uuid({ error: 'Laporan wajib dipilih' }),
    peDate: requiredDate('Tanggal PE'),
    officerName: z.string().trim().min(3, 'Nama petugas wajib diisi'),
    officerNip: z.string().trim().max(40).optional(),
    headOfPuskesmasName: z.string().trim().max(120).optional(),
    headOfPuskesmasNip: z.string().trim().max(40).optional(),
    respondentName: z.string().trim().max(120).optional(),
    respondentRelation: z.string().trim().max(80).optional(),
    respondentAge: optionalInt(0, 150, 'Umur responden'),
    respondentAddress: z.string().trim().max(300).optional(),
    respondentJob: z.string().trim().max(120).optional(),
    patientJob: z.string().trim().max(120).optional(),
    mainComplaint: z.string().trim().max(300).optional(),
    symptomOnsetDate: optionalDate,
    firstActionTaken: z.string().trim().max(200).optional(),
    dengueAttackOrder: z.string().trim().max(50).optional(),
    comorbidity: z.string().trim().max(300).optional(),
    travelHistory14d: z.string().trim().max(300).optional(),
    clinicalSymptoms: z.array(z.string()).optional(),
    labRdtNs1: z.enum(['POSITIF', 'NEGATIF', 'TIDAK_DIPERIKSA']).optional(),
    labIgm: z.enum(['POSITIF', 'NEGATIF', 'TIDAK_DIPERIKSA']).optional(),
    labIgg: z.enum(['POSITIF', 'NEGATIF', 'TIDAK_DIPERIKSA']).optional(),
    labPlatelet: optionalInt(0, 2_000_000, 'Trombosit'),
    labHematocrit: z.preprocess(
        (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
        z.number().min(0).max(100).optional(),
    ),
    otherFeverCasesCount: optionalInt(0, 500, 'Penderita demam lain'),
    hasOtherDenguePatients: z.boolean().optional(),
    treatmentGiven: z.string().trim().max(200).optional(),
    currentPatientCondition: z.string().trim().max(200).optional(),
    sourceLocation: z.string().trim().max(300).optional(),
    conclusion: z.string().trim().max(1000).optional(),
    recommendation: z.string().trim().max(1000).optional(),
    additionalNotes: z.string().trim().max(500).optional(),
    households: z.array(householdSchema).min(1, 'Minimal satu rumah diperiksa'),
});

/**
 * A PUSKESMAS or RUMAH_SAKIT account without an institution could never be
 * tenant-scoped, so it would read every institution's reports. Refuse it here
 * so the form shows the error before the server ever inserts a row.
 */
export const needsInstitution = (role: string) =>
    role === 'PUSKESMAS' || role === 'RUMAH_SAKIT';

export const createAccountSchema = z
    .object({
        name: z.string().trim().min(3, 'Nama minimal 3 karakter'),
        email: z.email('Email tidak valid').toLowerCase(),
        password: z.string().min(10, 'Password minimal 10 karakter'),
        role: z.enum(['ADMIN', 'DINKES', 'PUSKESMAS', 'RUMAH_SAKIT'], {
            error: 'Peran wajib dipilih',
        }),
        // FormData omits the field for ADMIN/DINKES (`null`), so null and ''
        // both mean "no institution".
        institutionId: z.preprocess(
            (v) => (v === '' || v === null || v === undefined ? undefined : v),
            z.uuid({ error: 'Institusi tidak valid' }).optional(),
        ),
    })
    .superRefine((v, ctx) => {
        if (needsInstitution(v.role) && !v.institutionId) {
            ctx.addIssue({
                code: 'custom',
                path: ['institutionId'],
                message: 'Institusi wajib dipilih untuk peran ini',
            });
        }
    });

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z
    .object({
        userId: z.uuid({ error: 'Akun tidak valid' }),
        name: z.string().trim().min(3, 'Nama minimal 3 karakter'),
        email: z.email('Email tidak valid').toLowerCase(),
        password: z.preprocess(
            (v) => (v === '' || v === null || v === undefined ? undefined : v),
            z.string().min(10, 'Password minimal 10 karakter').optional(),
        ),
        role: z
            .enum(['ADMIN', 'DINKES', 'PUSKESMAS', 'RUMAH_SAKIT'], {
                error: 'Peran wajib dipilih',
            })
            .optional(),
        institutionId: z.preprocess(
            (v) => (v === '' || v === null || v === undefined ? undefined : v),
            z.uuid({ error: 'Institusi tidak valid' }).optional(),
        ),
    })
    .superRefine((v, ctx) => {
        if (v.role && needsInstitution(v.role) && !v.institutionId) {
            ctx.addIssue({
                code: 'custom',
                path: ['institutionId'],
                message: 'Institusi wajib dipilih untuk peran ini',
            });
        }
    });

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export type CreatePeInput = z.infer<typeof createPeSchema>;

/**
 * Master data edited by an administrator, shared by the form on the client and
 * the server action that writes it — the browser validates exactly what the
 * server enforces. `optional` folds an empty input to undefined so a blank field
 * is stored as NULL, not as "".
 */
const optional = (max: number) =>
    z
        .union([z.string().trim().max(max), z.literal('')])
        .optional()
        .transform((v) => (v ? v : undefined));

const checkbox = z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === 'on' || v === 'true');

/** A number input arrives as a string; blank means absent, not zero. */
const optionalNumber = (min: number, max: number, label: string) =>
    z
        .union([z.string(), z.number()])
        .optional()
        .transform((v) => (v === '' || v === undefined ? undefined : Number(v)))
        // Blank is absent, not invalid: only a present, non-numeric or
        // out-of-range value fails.
        .refine(
            (v) =>
                v === undefined || (!Number.isNaN(v) && v >= min && v <= max),
            `${label} harus antara ${min} dan ${max}`,
        )
        .transform((v) => (Number.isNaN(v) ? undefined : v));

export const institutionSchema = z.object({
    id: z.uuid().optional(),
    name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(160),
    type: z.enum(['RUMAH_SAKIT', 'PUSKESMAS', 'DINAS_KESEHATAN'], {
        error: 'Jenis institusi wajib dipilih',
    }),
    address: optional(300),
    province: optional(100),
    city: optional(100),
    subDistrict: optional(100),
    phoneNumber: optional(30),
    latitude: optionalNumber(-90, 90, 'Lintang'),
    longitude: optionalNumber(-180, 180, 'Bujur'),
    // Comma separated in the form; stored as text[] because
    // assignReportByKelurahan matches it with lower(k) = lower(report.kelurahan).
    kelurahanList: z
        .union([z.array(z.string()), z.string()])
        .optional()
        .transform((v) => {
            const list = Array.isArray(v) ? v : (v ?? '').split(',');
            return [
                ...new Set(
                    list.map((s) => s.trim()).filter((s) => s.length > 0),
                ),
            ];
        })
        .refine((v) => v.length <= 200, 'Maksimal 200 kelurahan'),
    isActive: checkbox,
});

export type InstitutionInput = z.infer<typeof institutionSchema>;

const optionalBoundaryGeoJson = z.preprocess(
    (v) => {
        if (v === undefined) return undefined;
        if (v === null) return null;
        if (typeof v === 'string') {
            const trimmed = v.trim();
            if (!trimmed) return null;
            if (trimmed.length > MAX_BOUNDARY_JSON_BYTES) return Symbol('too_large');
            try {
                return JSON.parse(trimmed);
            } catch {
                return Symbol('invalid_json');
            }
        }
        return v;
    },
    boundaryGeoJsonSchema
        .nullable()
        .optional()
        .transform((v) => v as BoundaryGeoJson | null | undefined),
);

export const kelurahanSchema = z.object({
    id: z.uuid().optional(),
    name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(120),
    kecamatan: z.string().trim().min(2, 'Kecamatan wajib diisi').max(120),
    kota: z.string().trim().min(2, 'Kota wajib diisi').max(120),
    provinsi: z.string().trim().min(2, 'Provinsi wajib diisi').max(120),
    boundaryGeojson: optionalBoundaryGeoJson,
});

export type KelurahanInput = z.infer<typeof kelurahanSchema>;

export const assetSchema = z.object({
    id: z.uuid().optional(),
    name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(160),
    code: z.string().trim().min(2, 'Kode minimal 2 karakter').max(60),
    category: z.string().trim().min(2, 'Kategori wajib diisi').max(80),
    unit: z.string().trim().min(1, 'Satuan wajib diisi').max(30),
    currentStock: requiredInt(0, 1_000_000_000, 'Stok'),
    minimumStock: requiredInt(0, 1_000_000_000, 'Stok minimum'),
    institutionId: z.uuid({ error: 'Institusi wajib dipilih' }),
    isActive: checkbox,
});

export type AssetInput = z.infer<typeof assetSchema>;

/** Every write action takes an id from a form; a non-uuid is forged, not a 500. */
export const idSchema = z.uuid('ID tidak valid');

export const crossBorderDispositionSchema = z.object({
    reportId: z.uuid('Laporan tidak valid'),
    targetCity: z.string().trim().min(2, 'Kota/Kabupaten tujuan wajib diisi').max(120),
    notes: z.string().trim().min(5, 'Catatan disposisi minimal 5 karakter').max(500),
});

export const foggingCycleSchema = z.object({
    reportRSId: z.uuid('Laporan tidak valid'),
    cycleNumber: z.union([z.literal(1), z.literal(2)]),
    abateUsedKg: z.coerce.number().min(0).max(500),
    insecticideUsedLiter: z.coerce.number().min(0).max(500),
    foggerMachinesCount: requiredInt(1, 50, 'Jumlah mesin fogger'),
    materialCost: requiredInt(0, 100_000_000, 'Biaya bahan'),
    honorCost: requiredInt(0, 100_000_000, 'Honor petugas'),
    maintenanceCost: requiredInt(0, 100_000_000, 'Pemeliharaan'),
    notes: z.string().trim().max(500).optional(),
});

export type FoggingCycleInput = z.infer<typeof foggingCycleSchema>;
