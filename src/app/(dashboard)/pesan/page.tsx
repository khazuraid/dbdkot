import { requireActor } from '@/lib/session';
import { PageBody, PageHeader, NotBuilt } from '@/components/shell/page';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

export default async function PesanPage() {
    await requireActor();

    return (
        <PageBody>
            <PageHeader
                title="Pesan"
                context="Percakapan antar fasilitas kesehatan."
            />
            <NotBuilt
                what="Pesan belum tersambung"
                why="Tabel percakapan dan pesan sudah ada, tetapi halaman diskusi belum dibuat."
            />
        </PageBody>
    );
}
