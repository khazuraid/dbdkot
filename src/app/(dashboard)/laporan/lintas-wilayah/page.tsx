import { requireRole } from '@/lib/session';
import { listCrossBorderReports } from '@/lib/domain/reports';
import {
    Empty,
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { DispositionCard } from './disposition-card';

export const instant = false;

export default async function LintasWilayahPage() {
    const actor = await requireRole('DINKES');
    const rows = await listCrossBorderReports(actor);

    return (
        <PageBody>
            <PageHeader
                title="Kasus Lintas Wilayah"
                context="Disposisi laporan pasien dengan KTP / domisili di luar wilayah kerja lokal."
            />

            <PageContent>
                {rows.length === 0 ? (
                    <Panel title="Antrian Lintas Wilayah">
                        <Empty action={{ href: '/laporan', label: 'Lihat semua laporan' }}>
                            Tidak ada laporan lintas wilayah yang menunggu
                            disposisi saat ini.
                        </Empty>
                    </Panel>
                ) : (
                    <div className="flex flex-col gap-3">
                        {rows.map((r) => (
                            <DispositionCard key={r.id} row={r} />
                        ))}
                    </div>
                )}
            </PageContent>
        </PageBody>
    );
}
