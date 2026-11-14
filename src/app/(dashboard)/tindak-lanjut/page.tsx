import { requireRole } from '@/lib/session';
import { listFoggingQueue } from '@/lib/domain/fogging';
import {
    Empty,
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { FoggingCard } from './fogging-card';

export const instant = false;

export default async function TindakLanjutPage() {
    const actor = await requireRole('DINKES', 'PUSKESMAS');
    const items = await listFoggingQueue(actor);

    const canExecute =
        actor.role === 'DINKES' || actor.role === 'PUSKESMAS';

    return (
        <PageBody>
            <PageHeader
                title="Tindak Lanjut & Fogging Fokus"
                context="Pelaksanaan fogging 2 siklus (H0 & H+7 otomatis), pemotongan stok larvasida/insektisida, dan estimasi anggaran."
            />

            <PageContent>
                {items.length === 0 ? (
                    <Panel title="Antrian Fogging Fokus">
                        <Empty action={{ href: '/laporan', label: 'Lihat semua laporan' }}>
                            Belum ada kasus yang memerlukan tindak lanjut
                            fogging fokus saat ini.
                        </Empty>
                    </Panel>
                ) : (
                    <div className="flex flex-col gap-4">
                        {items.map((item) => (
                            <FoggingCard
                                key={item.reportId}
                                item={item}
                                canExecute={canExecute}
                            />
                        ))}
                    </div>
                )}
            </PageContent>
        </PageBody>
    );
}
