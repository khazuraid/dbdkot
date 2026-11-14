import { requireActor } from '@/lib/session';
import { getDb } from '@/db';
import { institutions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
    getSurveillanceReportData,
    getEpiWeekReportData,
    getEndemicityStratification,
    getPeComplianceReport,
} from '@/lib/domain/surveillance-report';
import { PageBody, PageHeader } from '@/components/shell/page';
import { SurveillanceReportView } from '@/components/reports/surveillance-report-view';

export default async function RekapLaporanPage({
    searchParams,
}: {
    searchParams: Promise<{
        m?: string;
        y?: string;
        lvl?: string;
        pk?: string;
        month?: string;
        year?: string;
        level?: string;
        puskesmasId?: string;
    }>;
}) {
    const actor = await requireActor();
    const params = await searchParams;

    const isPuskesmas = actor.role === 'PUSKESMAS';
    const isDinkesOrAdmin = actor.role === 'DINKES' || actor.role === 'ADMIN';

    const now = new Date();
    const month = params.m ? parseInt(params.m, 10) : params.month ? parseInt(params.month, 10) : now.getMonth() + 1;
    const year = params.y ? parseInt(params.y, 10) : params.year ? parseInt(params.year, 10) : now.getFullYear();

    // Auto-detect puskesmas role: lock to their own institution without requiring long URL params
    const puskesmasId = isPuskesmas
        ? (actor.institutionId ?? undefined)
        : (params.pk || params.puskesmasId || undefined);
    const level = isPuskesmas || params.lvl === 'puskesmas' || params.level === 'puskesmas' ? 'puskesmas' : 'kota';

    // Fetch Puskesmas list for selector (only needed for Dinkes/Admin)
    const db = getDb();
    const puskesmasList = isDinkesOrAdmin
        ? await db
              .select({ id: institutions.id, name: institutions.name })
              .from(institutions)
              .where(eq(institutions.type, 'PUSKESMAS'))
              .orderBy(institutions.name)
        : [];

    const [reportData, epiWeekData, endemicityData, peComplianceData] =
        await Promise.all([
            getSurveillanceReportData(actor, {
                month,
                year,
                level,
                puskesmasId,
            }),
            getEpiWeekReportData(actor, {
                year,
                level,
                puskesmasId,
            }),
            isDinkesOrAdmin
                ? getEndemicityStratification(actor, year)
                : Promise.resolve({
                      title: '',
                      subtitle: '',
                      currentYear: year,
                      years: [year, year - 1, year - 2] as [number, number, number],
                      rows: [],
                      summary: {
                          endemis: 0,
                          sporadis: 0,
                          potensial: 0,
                          bebas: 0,
                          totalKelurahan: 0,
                      },
                  }),
            isDinkesOrAdmin
                ? getPeComplianceReport(actor, {
                      year,
                      month,
                  })
                : Promise.resolve({
                      title: '',
                      subtitle: '',
                      periodLabel: '',
                      year,
                      month,
                      rows: [],
                      totals: {
                          totalCases: 0,
                          investigatedCount: 0,
                          under24h: 0,
                          hours24to72: 0,
                          over72h: 0,
                          notInvestigated: 0,
                          avgComplianceRate: 0,
                      },
                  }),
        ]);

    return (
        <PageBody>
            <PageHeader
                title="Rekapitulasi Laporan Surveilans"
                context="Format Resmi Kemenkes RI: Golongan Umur, SKDR Mingguan W1-W52, Stratifikasi Endemisitas & Respon PE"
            />
            <div className="p-4 md:p-[var(--pad)]">
                <SurveillanceReportView
                    initialData={reportData}
                    epiWeekData={epiWeekData}
                    endemicityData={endemicityData}
                    peComplianceData={peComplianceData}
                    userRole={actor.role}
                    puskesmasOptions={puskesmasList}
                />
            </div>
        </PageBody>
    );
}
