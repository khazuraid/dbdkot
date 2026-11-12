import { requireActor } from '@/lib/session';
import { PageHeader, NotBuilt } from '@/components/shell/page';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

export default async function PesanPage() {
    await requireActor();

    return (
        <div className="px-[var(--pad)] py-8">
            <PageHeader
                title="Pesan"
                context="Percakapan antar fasilitas kesehatan."
            />
            <NotBuilt
                what="Pesan belum tersambung"
                why="Tabel conversations dan messages sudah ada, tetapi halaman diskusi belum dibuat."
            />
        </div>
    );
}
