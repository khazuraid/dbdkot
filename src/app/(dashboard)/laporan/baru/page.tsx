import { requireActor } from '@/lib/session';
import { ReportForm } from './report-form';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

export default async function LaporanBaruPage() {
    await requireActor();

    return (
        <div className="px-[var(--pad)] py-8">
            <h1 className="text-[24px] font-medium tracking-tight">
                Lapor kasus
            </h1>
            <p className="mt-1 text-[14px] text-muted-foreground">
                Laporan dikirim ke puskesmas sesuai kelurahan pasien.
            </p>
            <ReportForm />
        </div>
    );
}
