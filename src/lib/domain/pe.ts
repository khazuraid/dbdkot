import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { peHouseholdSurveys, reportsPE, reportsRS } from '@/db/schema';
import { audit } from '@/lib/audit';
import { scopeToInstitution, type Actor } from '@/lib/session';
import { listReports } from './reports';

export {
    householdSchema,
    createPeSchema,
    type CreatePeInput,
} from './form-contracts';
import type { CreatePeInput } from './form-contracts';

export type CreatePeResult =
    { ok: true; id: string } | { ok: false; error: string };

/** Reports a Puskesmas has accepted but not yet investigated. */
export async function peCandidates(actor: Actor) {
    return listReports(actor, { status: 'ASSIGNED_ACCEPTED', perPage: 100 });
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

    if (report.status !== 'ASSIGNED_ACCEPTED') {
        return { ok: false, error: 'Laporan belum diterima puskesmas.' };
    }

    // Indices are computed here, once, so two screens cannot disagree.
    const houses = input.households.reduce((n, h) => n + h.houseCount, 0);
    const inspectedWithLarva = input.households.reduce(
        (n, h) => n + h.larvaCount,
        0,
    );
    const houseIndex = houses
        ? ((inspectedWithLarva / houses) * 100).toFixed(2)
        : null;

    const db = getDb();

    const created = await db.transaction(async (tx) => {
        const [pe] = await tx
            .insert(reportsPE)
            .values({
                reportRSId: input.reportRSId,
                institutionId,
                peDate: input.peDate,
                officerName: input.officerName,
                officerId: actor.userId,
                createdById: actor.userId,
                houseIndex,
                sourceInvestigationDone: Boolean(input.sourceLocation),
                sourceLocation: input.sourceLocation || null,
                conclusion: input.conclusion || null,
                recommendation: input.recommendation || null,
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
                    eq(reportsRS.status, 'ASSIGNED_ACCEPTED'),
                ),
            )
            .returning({ id: reportsRS.id });

        if (!moved[0]) throw new Error('ILLEGAL_STATE');

        return pe;
    });

    await audit({
        actor,
        action: 'CREATE',
        entityType: 'REPORT_PE',
        entityId: created.id,
        changes: {
            reportRSId: { from: null, to: input.reportRSId },
            institutionId: { from: null, to: institutionId },
        },
    });

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
