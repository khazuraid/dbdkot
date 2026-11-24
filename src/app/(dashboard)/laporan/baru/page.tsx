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
    const actor = await requireRole(
        'RUMAH_SAKIT',
        'PUSKESMAS',
        'DINKES',
        'ADMIN',
    );
    const kelurahanOptions = await listKelurahanOptions();

    const isPuskesmas = actor.role === 'PUSKESMAS';
    const isDinkes = actor.role === 'DINKES' || actor.role === 'ADMIN';
    const defaultAdmissionDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());

    return (
        <PageBody>
            <PageHeader
                title={
                    isPuskesmas
                        ? 'Formulir Kasus Poli / IGD Puskesmas'
                        : isDinkes
                          ? 'Entri Kasus Surveilans (Dinas Kesehatan)'
                          : 'Entri Laporan Kasus Baru (KDRS)'
                }
                context={
                    isPuskesmas
                        ? 'Pelaporan kasus dengue langsung dari Poli/IGD Puskesmas. Berkas akan otomatis masuk ke antrian Penyelidikan Epidemiologi (PE) internal puskesmas Anda.'
                        : isDinkes
                          ? 'Pencatatan kasus rujukan luar daerah atau laporan manual oleh Dinas Kesehatan untuk diteruskan ke Puskesmas wilayah.'
                          : 'Formulir Kewaspadaan Dini Rumah Sakit (KDRS). Sistem otomatis memetakan dan menugaskan Puskesmas wilayah sesuai kelurahan domisili pasien.'
                }
                aside={
                    <Button asChild variant="outline" size="sm">
                        <Link href="/laporan">
                            <ArrowLeft
                                className="mr-1.5 size-3.5"
                                aria-hidden
                            />
                            Kembali ke Daftar Kasus
                        </Link>
                    </Button>
                }
            />

            <PageContent>
                <ReportForm
                    kelurahanOptions={kelurahanOptions}
                    sourceType={isPuskesmas ? 'PUSKESMAS_POLI' : 'RS'}
                    actorRole={actor.role}
                    defaultAdmissionDate={defaultAdmissionDate}
                />
            </PageContent>
        </PageBody>
    );
}
