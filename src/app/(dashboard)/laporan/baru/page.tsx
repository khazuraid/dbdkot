import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/session';
import { listKelurahanOptions } from '@/lib/domain/master';
import { PageBody, PageContent, PageHeader } from '@/components/shell/page';
import { Button } from '@/components/ui/button';
import { ReportForm } from './report-form';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

export default async function LaporanBaruPage() {
    const [actor, kelurahanOptions] = await Promise.all([
        requireRole('RUMAH_SAKIT', 'PUSKESMAS', 'DINKES', 'ADMIN'),
        listKelurahanOptions(),
    ]);

    const isPuskesmas = actor.role === 'PUSKESMAS';

    return (
        <PageBody>
            <PageHeader
                title={
                    isPuskesmas
                        ? 'Formulir Kasus Poli / IGD Puskesmas'
                        : 'Entri Laporan Kasus Baru (KDRS)'
                }
                context={
                    isPuskesmas
                        ? 'Pelaporan kasus dengue langsung dari Poli/IGD Puskesmas. Berkas akan otomatis masuk ke antrian Penyelidikan Epidemiologi (PE) internal puskesmas Anda.'
                        : 'Formulir Kewaspadaan Dini Rumah Sakit (KDRS). Sistem otomatis memetakan dan menugaskan Puskesmas wilayah sesuai kelurahan domisili pasien.'
                }
                aside={
                    <Button asChild variant="outline" size="sm">
                        <Link href="/laporan">
                            <ArrowLeft className="mr-1.5 size-3.5" aria-hidden />
                            Kembali ke Daftar Kasus
                        </Link>
                    </Button>
                }
            />

            <PageContent>
                <ReportForm
                    kelurahanOptions={kelurahanOptions}
                    sourceType={isPuskesmas ? 'PUSKESMAS_POLI' : 'RS'}
                />
            </PageContent>
        </PageBody>
    );
}
