import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { peHouseholdSurveys, reportsPE, reportsRS } from '@/db/schema';
import { audit } from '@/lib/audit';
import { calculateEntomologyMetrics } from '@/lib/entomology-calculator';
import { scopeToInstitution, type Actor } from '@/lib/session';
import { decryptPii } from '@/lib/crypto';
import { insertNotifications } from './notify';

export {
    householdSchema,
    createPeSchema,
    type CreatePeInput,
} from './form-contracts';
import type { CreatePeInput } from './form-contracts';

export type CreatePeResult =
    | { ok: true; id: string }
    | { ok: false; error: string };

export type PeCandidateDetail = {
    id: string;
    reportNumber: string;
    patientName: string;
    patientNik: string;
    patientAddress: string;
    phoneNumber: string;
    patientAge: number;
    patientGender: 'L' | 'P';
    caseType: string;
    kelurahan: string;
    kecamatan: string;
    kota: string;
    provinsi: string;
    latitude: number | null;
    longitude: number | null;
    dengueBlot: 'POSITIF' | 'NEGATIF' | 'TIDAK_DIPERIKSA' | null;
    igm: 'POSITIF' | 'NEGATIF' | 'TIDAK_DIPERIKSA' | null;
    igg: 'POSITIF' | 'NEGATIF' | 'TIDAK_DIPERIKSA' | null;
    plateletCount: number | null;
    hematocrit: number | null;
    admissionDate: Date;
    symptomOnsetDate: Date | null;
    diagnosisDate: Date | null;
    diagnosis: string | null;
};

function decryptOrDash(value: string | null | undefined): string {
    if (!value) return '';
    try {
        return decryptPii(value);
    } catch {
        return '—';
    }
}

/**
 * Reports a Puskesmas has accepted but not yet investigated. Includes decrypted
 * patient identity and laboratory results for auto-population into the PE form.
 */
export async function peCandidates(actor: Actor): Promise<{
    rows: PeCandidateDetail[];
    total: number;
}> {
    const institutionId = scopeToInstitution(actor);
    const db = getDb();

    const whereConditions = [
        inArray(reportsRS.status, ['ASSIGNED_ACCEPTED', 'PE_IN_PROGRESS']),
    ];

    if (institutionId) {
        whereConditions.push(eq(reportsRS.assignedPuskesmasId, institutionId));
    }

    const rows = await db
        .select({
            id: reportsRS.id,
            reportNumber: reportsRS.reportNumber,
            patientNameEncrypted: reportsRS.patientNameEncrypted,
            patientNikEncrypted: reportsRS.patientNikEncrypted,
            patientAddressEncrypted: reportsRS.patientAddressEncrypted,
            phoneNumberEncrypted: reportsRS.phoneNumberEncrypted,
            patientAge: reportsRS.patientAge,
            patientGender: reportsRS.patientGender,
            caseType: reportsRS.caseType,
            kelurahan: reportsRS.kelurahan,
            kecamatan: reportsRS.kecamatan,
            kota: reportsRS.kota,
            provinsi: reportsRS.provinsi,
            latitude: reportsRS.latitude,
            longitude: reportsRS.longitude,
            dengueBlot: reportsRS.dengueBlot,
            igm: reportsRS.igm,
            igg: reportsRS.igg,
            plateletCount: reportsRS.plateletCount,
            hematocrit: reportsRS.hematocrit,
            admissionDate: reportsRS.admissionDate,
            symptomOnsetDate: reportsRS.symptomOnsetDate,
            diagnosisDate: reportsRS.diagnosisDate,
            diagnosis: reportsRS.diagnosis,
        })
        .from(reportsRS)
        .where(and(...whereConditions))
        .orderBy(desc(reportsRS.createdAt))
        .limit(100);

    const candidates: PeCandidateDetail[] = rows.map((r) => ({
        id: r.id,
        reportNumber: r.reportNumber,
        patientName: decryptOrDash(r.patientNameEncrypted),
        patientNik: decryptOrDash(r.patientNikEncrypted),
        patientAddress: decryptOrDash(r.patientAddressEncrypted),
        phoneNumber: decryptOrDash(r.phoneNumberEncrypted),
        patientAge: r.patientAge,
        patientGender: r.patientGender,
        caseType: r.caseType,
        kelurahan: r.kelurahan ?? '',
        kecamatan: r.kecamatan ?? '',
        kota: r.kota ?? '',
        provinsi: r.provinsi ?? '',
        latitude: r.latitude ? Number(r.latitude) : null,
        longitude: r.longitude ? Number(r.longitude) : null,
        dengueBlot:
            (r.dengueBlot as 'POSITIF' | 'NEGATIF' | 'TIDAK_DIPERIKSA' | null) ??
            null,
        igm:
            (r.igm as 'POSITIF' | 'NEGATIF' | 'TIDAK_DIPERIKSA' | null) ??
            null,
        igg:
            (r.igg as 'POSITIF' | 'NEGATIF' | 'TIDAK_DIPERIKSA' | null) ??
            null,
        plateletCount: r.plateletCount,
        hematocrit: r.hematocrit ? Number(r.hematocrit) : null,
        admissionDate: r.admissionDate,
        symptomOnsetDate: r.symptomOnsetDate,
        diagnosisDate: r.diagnosisDate,
        diagnosis: r.diagnosis,
    }));

    return { rows: candidates, total: candidates.length };
}

export async function createPe(
    actor: Actor,
    input: CreatePeInput,
): Promise<CreatePeResult> {
    // scopeToInstitution returns null for Admin/Dinkes; a PE is performed by
    // the puskesmas, so the role is checked before anything else.
    if (actor.role !== 'PUSKESMAS') {
        return { ok: false, error: 'Hanya puskesmas yang dapat mengisi PE.' };
    }

    const institutionId = scopeToInstitution(actor);

    if (!institutionId) {
        return { ok: false, error: 'Akun Anda belum terhubung ke puskesmas.' };
    }

    const [report] = await getDb()
        .select({
            id: reportsRS.id,
            status: reportsRS.status,
            assignedPuskesmasId: reportsRS.assignedPuskesmasId,
        })
        .from(reportsRS)
        .where(eq(reportsRS.id, input.reportRSId))
        .limit(1);

    if (!report || report.assignedPuskesmasId !== institutionId) {
        return {
            ok: false,
            error: 'Laporan tidak ditemukan di puskesmas Anda.',
        };
    }

    if (
        report.status !== 'ASSIGNED_ACCEPTED' &&
        report.status !== 'PE_IN_PROGRESS'
    ) {
        return { ok: false, error: 'Laporan belum diterima puskesmas.' };
    }

    const metrics = calculateEntomologyMetrics(
        input.households.map((h, idx) => {
            const containersChecked =
                h.containersChecked ?? Math.max(h.houseCount * 2, h.larvaCount);
            const positiveContainers = h.positiveContainers ?? h.larvaCount;
            const isPositive =
                Boolean(h.insidePositive) ||
                Boolean(h.outsidePositive) ||
                h.larvaCount > 0;
            return {
                houseNumber: idx + 1,
                houseOwner: h.address,
                isInsideContainerPositive: h.insidePositive ?? isPositive,
                isOutsideContainerPositive: h.outsidePositive ?? false,
                totalContainersChecked: containersChecked,
                totalPositiveContainers: positiveContainers,
            };
        }),
        Boolean(input.hasOtherDenguePatients),
        input.otherFeverCasesCount ?? 0,
    );

    const db = getDb();

    let created: { id: string };
    try {
        created = await db.transaction(async (tx) => {
            const [pe] = await tx
                .insert(reportsPE)
                .values({
                    reportRSId: input.reportRSId,
                    institutionId,
                    peDate: input.peDate,
                    officerName: input.officerName,
                    officerId: actor.userId,
                    officerNip: input.officerNip || null,
                    headOfPuskesmasName: input.headOfPuskesmasName || null,
                    headOfPuskesmasNip: input.headOfPuskesmasNip || null,
                    respondentName: input.respondentName || null,
                    respondentRelation: input.respondentRelation || null,
                    travelHistory14d: input.travelHistory14d || null,
                    otherFeverCasesCount: input.otherFeverCasesCount ?? 0,
                    housesInspected: metrics.totalHousesChecked,
                    housesPositive: metrics.positiveHousesCount,
                    containersInspected: metrics.totalContainersChecked,
                    containersPositive: metrics.positiveContainersCount,
                    abj: String(metrics.abj),
                    houseIndex: String(metrics.hi),
                    containerIndex: String(metrics.ci),
                    breteauIndex: String(metrics.bi),
                    transmissionRisk: metrics.transmissionRisk,
                    foggingRecommended: metrics.foggingRecommended,
                    formData: {
                        clinicalSymptoms: input.clinicalSymptoms ?? [],
                        labRdtNs1: input.labRdtNs1 ?? 'TIDAK_DIPERIKSA',
                        labIgm: input.labIgm ?? 'TIDAK_DIPERIKSA',
                        labIgg: input.labIgg ?? 'TIDAK_DIPERIKSA',
                        labPlatelet: input.labPlatelet ?? null,
                        labHematocrit: input.labHematocrit ?? null,
                        hasOtherDenguePatients: Boolean(
                            input.hasOtherDenguePatients,
                        ),
                        respondentAge: input.respondentAge ?? null,
                        respondentAddress: input.respondentAddress ?? null,
                        respondentJob: input.respondentJob ?? null,
                        patientJob: input.patientJob ?? null,
                        mainComplaint: input.mainComplaint ?? null,
                        symptomOnsetDate: input.symptomOnsetDate ?? null,
                        firstActionTaken: input.firstActionTaken ?? null,
                        dengueAttackOrder: input.dengueAttackOrder ?? null,
                        comorbidity: input.comorbidity ?? null,
                        treatmentGiven: input.treatmentGiven ?? null,
                        currentPatientCondition:
                            input.currentPatientCondition ?? null,
                        additionalNotes: input.additionalNotes ?? null,
                    },
                    createdById: actor.userId,
                    sourceInvestigationDone: Boolean(input.sourceLocation),
                    sourceLocation: input.sourceLocation || null,
                    conclusion: input.conclusion || metrics.actionPlan,
                    recommendation: input.recommendation || metrics.actionPlan,
                    status: 'SUBMITTED',
                })
                .returning({ id: reportsPE.id });

            if (!pe) throw new Error('INSERT_FAILED');

            await tx.insert(peHouseholdSurveys).values(
                input.households.map((h) => ({
                    reportPEId: pe.id,
                    address: h.address,
                    houseCount: h.houseCount,
                    population: h.population,
                    larvaCount: h.larvaCount,
                    larvaType: h.larvaType || null,
                    abateUsed: h.abateUsed ?? false,
                })),
            );

            // Status advances only inside the same transaction as the PE row: a PE
            // without its report flipped (or vice versa) is the drift C10 produced.
            const moved = await tx
                .update(reportsRS)
                .set({
                    status: 'PE_COMPLETED',
                    updatedById: actor.userId,
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(reportsRS.id, input.reportRSId),
                        inArray(reportsRS.status, [
                            'ASSIGNED_ACCEPTED',
                            'PE_IN_PROGRESS',
                        ]),
                    ),
                )
                .returning({ id: reportsRS.id });

            if (!moved[0]) throw new Error('ILLEGAL_STATE');

            return pe;
        });
    } catch (error) {
        // A second PE for the same report hits the unique index on
        // report_rs_id; that is a field error, not a 500.
        const code =
            (error as { cause?: { code?: string }; code?: string }).cause
                ?.code ?? (error as { code?: string }).code;
        if (code === '23505') {
            return { ok: false, error: 'Laporan ini sudah punya PE.' };
        }
        throw error;
    }

    await audit({
        actor,
        action: 'CREATE',
        entityType: 'REPORT_PE',
        entityId: created.id,
        changes: {
            reportRSId: { from: null, to: input.reportRSId },
            institutionId: { from: null, to: institutionId },
            abj: { from: null, to: metrics.abj },
            foggingRecommended: { from: null, to: metrics.foggingRecommended },
        },
    });

    try {
        await insertNotifications(
            { kind: 'ROLE', role: 'DINKES' },
            {
                title: 'Hasil PE selesai dilaporkan',
                message: `Penyelidikan epidemiologi (PE) telah selesai disubmit (${metrics.transmissionRisk === 'POSITIF_PENULARAN' ? 'Positif Penularan · Rekomendasi Fogging' : 'Negatif Penularan'}) dan menunggu verifikasi Dinkes.`,
                type: 'PE_COMPLETED',
                entityType: 'REPORT_RS',
                entityId: input.reportRSId,
            },
        );
    } catch (err) {
        console.error('[pe] notify dinkes error:', err);
    }

    return { ok: true, id: created.id };
}

export async function peDetail(actor: Actor, id: string) {
    const institutionId = scopeToInstitution(actor);

    const rows = await getDb()
        .select({
            pe: reportsPE,
            reportNumber: reportsRS.reportNumber,
            reportRSId: reportsRS.id,
        })
        .from(reportsPE)
        .innerJoin(reportsRS, eq(reportsRS.id, reportsPE.reportRSId))
        .where(
            institutionId
                ? and(
                      eq(reportsPE.id, id),
                      inArray(reportsPE.institutionId, [institutionId]),
                  )
                : eq(reportsPE.id, id),
        )
        .limit(1);

    const row = rows[0];
    if (!row) return null;

    // A PE carries household addresses and occupant counts: reading one is a
    // PII access like reading the report itself.
    await audit({
        actor,
        action: 'READ_PII',
        entityType: 'REPORT_PE',
        entityId: id,
    });

    const households = await getDb()
        .select()
        .from(peHouseholdSurveys)
        .where(eq(peHouseholdSurveys.reportPEId, id));

    return { ...row, households };
}
