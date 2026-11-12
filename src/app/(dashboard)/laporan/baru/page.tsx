import { requireActor } from '@/lib/session';
import { PageBody, PageHeader } from '@/components/shell/page';
import { ReportForm } from './report-form';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

export default async function LaporanBaruPage() {
    await requireActor();

    return (
        <PageBody>
            <PageHeader
                title="Lapor kasus"
                context="Laporan dikirim ke puskesmas sesuai kelurahan pasien."
            />
            <ReportForm />
        </PageBody>
    );
}
