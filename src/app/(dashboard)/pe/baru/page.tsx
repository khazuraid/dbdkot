import { requireRole } from '@/lib/session';
import { peCandidates } from '@/lib/domain/pe';
import { PageBody, PageHeader, NotBuilt } from '@/components/shell/page';
import { PeForm } from './pe-form';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

export default async function PeBaruPage() {
    // ADMIN was admitted here but `createPe` refuses any non-PUSKESMAS role, so
    // the screen offered a form whose submit could never succeed.
    const actor = await requireRole('PUSKESMAS');
    const { rows } = await peCandidates(actor);

    return (
        <PageBody>
            <PageHeader
                title="Buat PE"
                context="Laporan yang sudah Anda terima dan belum diselidiki."
            />
            {rows.length === 0 ? (
                <NotBuilt
                    what="Belum ada laporan untuk diselidiki"
                    why="Terima laporan di antrian puskesmas terlebih dahulu."
                />
            ) : (
                <PeForm
                    candidates={rows.map((r) => ({
                        id: r.id,
                        reportNumber: r.reportNumber,
                    }))}
                />
            )}
        </PageBody>
    );
}
