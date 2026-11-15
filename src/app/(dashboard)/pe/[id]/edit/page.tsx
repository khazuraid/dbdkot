import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { requireActor } from '@/lib/session';
import { peCandidates, peDetail } from '@/lib/domain/pe';
import {
    PageBody,
    PageContent,
    PageHeader,
} from '@/components/shell/page';
import { Button } from '@/components/ui/button';
import { PeForm, type InitialPeData } from '@/app/(dashboard)/pe/baru/pe-form';

export const instant = false;

export default async function EditPePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const actor = await requireActor();

    if (
        actor.role !== 'PUSKESMAS' &&
        actor.role !== 'DINKES' &&
        actor.role !== 'ADMIN'
    ) {
        redirect('/pe');
    }

    const detail = await peDetail(actor, id);
    if (!detail) notFound();

    const isAuthorized =
        actor.role === 'ADMIN' ||
        actor.role === 'DINKES' ||
        actor.institutionId === detail.pe.institutionId;

    if (!isAuthorized) {
        redirect(`/laporan/${detail.reportRSId}`);
    }

    const { rows } = await peCandidates(actor, detail.reportRSId);

    const [userRow] = await getDb()
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, actor.userId))
        .limit(1);

    const defaultOfficerName = userRow?.name ?? detail.pe.officerName;

    const initialPe: InitialPeData = {
        id: detail.pe.id,
        reportRSId: detail.reportRSId,
        peDate: detail.pe.peDate,
        officerName: detail.pe.officerName,
        officerNip: detail.pe.officerNip,
        headOfPuskesmasName: detail.pe.headOfPuskesmasName,
        headOfPuskesmasNip: detail.pe.headOfPuskesmasNip,
        respondentName: detail.pe.respondentName,
        respondentRelation: detail.pe.respondentRelation,
        travelHistory14d: detail.pe.travelHistory14d,
        otherFeverCasesCount: detail.pe.otherFeverCasesCount,
        rt: detail.pe.rt,
        rw: detail.pe.rw,
        sourceLocation: detail.pe.sourceLocation,
        conclusion: detail.pe.conclusion,
        recommendation: detail.pe.recommendation,
        formData: detail.pe.formData as Record<string, unknown> | null,
        households: detail.households.map((h) => ({
            address: h.address,
            houseCount: h.houseCount,
            population: h.population,
            larvaCount: h.larvaCount,
            larvaType: h.larvaType,
            abateUsed: h.abateUsed,
        })),
    };

    return (
        <PageBody>
            <PageHeader
                title={`Edit Penyelidikan Epidemiologi (PE)`}
                context={`Perbarui hasil pemeriksaan jentik, parameter lab, atau catatan lapangan untuk kasus ${detail.reportNumber}.`}
                aside={
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/laporan/${detail.reportRSId}`}>
                            <ArrowLeft className="mr-1.5 size-3.5" aria-hidden />
                            Kembali ke Laporan
                        </Link>
                    </Button>
                }
            />

            <PageContent>
                <PeForm
                    candidates={rows}
                    initialReportId={detail.reportRSId}
                    defaultOfficerName={defaultOfficerName}
                    initialPe={initialPe}
                />
            </PageContent>
        </PageBody>
    );
}
