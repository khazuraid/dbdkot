import { requireRole } from '@/lib/session';
import { listKelurahan } from '@/lib/domain/admin';
import { PageHeader, Panel, Empty } from '@/components/shell/page';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

export default async function KelurahanPage() {
    await requireRole('ADMIN', 'DINKES');
    const rows = await listKelurahan();

    return (
        <div className="px-[var(--pad)] py-8">
            <PageHeader
                title="Kelurahan"
                context="Daftar wilayah yang dapat dipilih saat melapor."
            />
            <Panel title={`${rows.length} kelurahan`}>
                {rows.length === 0 ? (
                    <Empty>Belum ada kelurahan.</Empty>
                ) : (
                    <table className="w-full border-collapse text-[14px]">
                        <thead>
                            <tr className="border-y border-border text-left text-[12px] text-muted-foreground">
                                <th className="py-2 font-normal">Kelurahan</th>
                                <th className="py-2 font-normal">Kecamatan</th>
                                <th className="py-2 font-normal">Kota</th>
                                <th className="py-2 font-normal">Provinsi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {rows.map((k) => (
                                <tr
                                    key={k.id}
                                    className="h-[var(--row-height)]"
                                >
                                    <td className="py-2">{k.name}</td>
                                    <td className="py-2">{k.kecamatan}</td>
                                    <td className="py-2 text-muted-foreground">
                                        {k.kota}
                                    </td>
                                    <td className="py-2 text-muted-foreground">
                                        {k.provinsi}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Panel>
        </div>
    );
}
