import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireActor } from '@/lib/session';
import { getReport } from '@/lib/domain/report-detail';
import { listKelurahanOptions } from '@/lib/domain/master';
import { PageBody, PageContent, PageHeader } from '@/components/shell/page';
import { Button } from '@/components/ui/button';
import { EditReportForm } from './edit-form';

export const instant = false;

export default async function EditLaporanPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const actor = await requireActor();
    const [report, kelurahanOptions] = await Promise.all([
        getReport(actor, id),
        listKelurahanOptions(),
    ]);

    if (!report) notFound();

    // Izinkan ADMIN, DINKES, atau faskes pembuat laporan
    const canEdit =
        actor.role === 'ADMIN' ||
        actor.role === 'DINKES' ||
        actor.institutionId === report.institutionId;

    if (!canEdit) {
        redirect(`/laporan/${id}`);
    }

    return (
        <PageBody>
            <PageHeader
                title={`Edit Laporan ${report.reportNumber}`}
                context="Perbarui informasi klinis, data pasien, RT/RW, titik lokasi domisili, atau ubah status laporan."
                aside={
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/laporan/${id}`}>
                            <ArrowLeft className="mr-1.5 size-3.5" aria-hidden />
                            Kembali ke Detail
                        </Link>
                    </Button>
                }
            />

            <PageContent className="space-y-6">
                <EditReportForm report={report} kelurahanOptions={kelurahanOptions} />
            </PageContent>
        </PageBody>
    );
}
