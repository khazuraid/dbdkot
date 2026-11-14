import {
    AlertTriangle,
    Building2,
    Map as MapIcon,
    MapPin,
    PlusIcon,
    Search,
} from 'lucide-react';
import Link from 'next/link';
import { requireRole } from '@/lib/session';
import {
    listKelurahanPaged,
    listKelurahanZoneOptions,
} from '@/lib/domain/master';
import { formatNumber } from '@/lib/format';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { Pager, readPage } from '@/components/shell/pager-view';
import { Stat } from '@/components/shell/stat';
import { StatusText } from '@/components/shell/status-text';
import { MasterTable } from '@/components/admin/master-table';
import {
    MasterTableView,
    type TableColumn,
} from '@/components/admin/master-table-view';
import { KelurahanZonePanel } from '@/components/admin/kelurahan-zone-panel';
import { Button } from '@/components/ui/button';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from '@/components/ui/input-group';
import { deleteKelurahanAction, saveKelurahanAction } from './actions';

// Data wilayah: rute ini dirender per permintaan, bukan dari shell statis.
export const instant = false;

type Row = Awaited<ReturnType<typeof listKelurahanPaged>>['rows'][number];

export default async function KelurahanPage({
    searchParams,
}: {
    searchParams: Promise<{
        page?: string;
        q?: string;
        tambah?: string;
        ubah?: string;
        hapus?: string;
        peta?: string;
    }>;
}) {
    const sp = await searchParams;
    await requireRole('ADMIN', 'DINKES');
    const q = sp.q?.trim() ?? '';
    const [{ rows, page, perPage, total, summary }, zoneOptions] =
        await Promise.all([
            listKelurahanPaged({
                q,
                page: readPage(sp.page),
            }),
            listKelurahanZoneOptions(),
        ]);

    const columns: TableColumn<Row>[] = [
        {
            key: 'name',
            header: 'Kelurahan',
            cell: (k) => (
                <span className="font-medium text-foreground">{k.name}</span>
            ),
        },
        { key: 'kec', header: 'Kecamatan', cell: (k) => k.kecamatan },
        {
            key: 'kota',
            header: 'Kota / Kab.',
            cell: (k) => (
                <span>
                    {k.kota}
                    <span className="block text-[11.5px] text-muted-foreground">
                        {k.provinsi}
                    </span>
                </span>
            ),
        },
        {
            key: 'coverage',
            header: 'Cakupan puskesmas',
            cell: (k) =>
                k.puskesmasNames.length > 0 ? (
                    <div title={k.puskesmasNames.join(', ')}>
                        <StatusText tone="good">
                            {k.puskesmasNames[0]}
                            {k.puskesmasNames.length > 1
                                ? ` +${k.puskesmasNames.length - 1}`
                                : ''}
                        </StatusText>
                    </div>
                ) : (
                    <StatusText tone="warn">Belum tercakup</StatusText>
                ),
        },
        {
            key: 'zone',
            header: 'Zonasi peta',
            cell: (k) =>
                k.boundaryGeojson ? (
                    <Link
                        href={`/admin/kelurahan?${new URLSearchParams({
                            ...(q ? { q } : {}),
                            ...(page > 1 ? { page: String(page) } : {}),
                            peta: k.id,
                        })}`}
                        scroll={false}
                        className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--pill-positive-border)] bg-[var(--pill-positive-bg)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--pill-positive-ink)] hover:underline"
                    >
                        <MapPin className="size-3" aria-hidden />
                        Lihat batas
                    </Link>
                ) : (
                    <StatusText tone="neutral">Belum diatur</StatusText>
                ),
        },
    ];

    return (
        <PageBody>
            <PageHeader
                title="Kelurahan"
                context="Wilayah yang muncul sebagai pilihan saat melapor. Nama di sini harus sama dengan wilayah kerja puskesmas."
            >
                <form
                    action="/admin/kelurahan"
                    className="flex flex-wrap items-center gap-2"
                >
                    <InputGroup className="h-9 w-full sm:w-[280px]">
                        <InputGroupAddon>
                            <Search className="size-4" aria-hidden />
                        </InputGroupAddon>
                        <InputGroupInput
                            type="search"
                            name="q"
                            defaultValue={q}
                            placeholder="Cari kelurahan, kecamatan, kota…"
                            aria-label="Cari kelurahan"
                        />
                    </InputGroup>
                    <Button type="submit" variant="outline" size="sm">
                        Cari
                    </Button>
                    {q && (
                        <Button asChild variant="ghost" size="sm">
                            <Link href="/admin/kelurahan">Reset</Link>
                        </Button>
                    )}
                </form>
            </PageHeader>

            <PageContent className="space-y-5">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat
                        label="Total kelurahan"
                        value={summary.total}
                        icon={MapPin}
                    />
                    <Stat
                        label="Kecamatan"
                        value={summary.kecamatan}
                        icon={MapIcon}
                    />
                    <Stat
                        label="Zonasi peta"
                        value={`${summary.withBoundary} / ${summary.total}`}
                        icon={Building2}
                    />
                    <Stat
                        label="Belum tercakup"
                        value={summary.uncovered}
                        signal={summary.uncovered > 0 ? 'warn' : 'good'}
                        hint={
                            summary.uncovered > 0
                                ? 'Atur di wilayah kerja puskesmas'
                                : 'Seluruh kelurahan punya puskesmas'
                        }
                        icon={AlertTriangle}
                    />
                </dl>

                <Panel
                    padded
                    title="Peta zonasi kelurahan"
                    subtitle="Cari nama kelurahan (mis. Kesambi, Cirebon) untuk menampilkan batas poligon putus-putus dan menyimpannya ke register."
                >
                    <KelurahanZonePanel
                        key={sp.peta ?? 'all'}
                        zones={zoneOptions}
                        initialFocusId={sp.peta ?? null}
                    />
                </Panel>

                <Panel
                    title={`${formatNumber(total)} kelurahan${q ? ` · “${q}”` : ''}`}
                    aside={
                        <div className="flex flex-wrap items-center gap-2">
                            {summary.uncovered > 0 && (
                                <Button asChild variant="outline" size="sm">
                                    <Link href="/admin/institusi">
                                        Atur cakupan
                                    </Link>
                                </Button>
                            )}
                            <Button asChild size="sm">
                                <Link
                                    href="/admin/kelurahan?tambah=1"
                                    scroll={false}
                                >
                                    <PlusIcon aria-hidden /> Tambah kelurahan
                                </Link>
                            </Button>
                        </div>
                    }
                >
                    <MasterTableView<Row>
                        singular="Kelurahan"
                        pathname="/admin/kelurahan"
                        rows={rows}
                        columns={columns}
                        empty={
                            q ? (
                                <span className="text-[13px] normal-case">
                                    Tidak ada kelurahan yang cocok dengan “{q}”.
                                </span>
                            ) : (
                                <span className="text-[13px] normal-case">
                                    Belum ada kelurahan. Tambahkan wilayah dulu
                                    supaya petugas bisa memilihnya saat melapor.
                                </span>
                            )
                        }
                    />

                    <MasterTable<Row>
                        singular="Kelurahan"
                        rows={rows}
                        editId={sp.ubah ?? (sp.tambah ? 'tambah' : null)}
                        deleteId={sp.hapus}
                        fields={[
                            {
                                name: 'name',
                                label: 'Kelurahan',
                                kind: 'text',
                                required: true,
                                placeholder: 'Cilodong',
                            },
                            {
                                name: 'kecamatan',
                                label: 'Kecamatan',
                                kind: 'text',
                                required: true,
                                placeholder: 'Cilodong',
                            },
                            {
                                name: 'kota',
                                label: 'Kota',
                                kind: 'text',
                                required: true,
                                placeholder: 'Depok',
                            },
                            {
                                name: 'provinsi',
                                label: 'Provinsi',
                                kind: 'text',
                                required: true,
                                placeholder: 'Jawa Barat',
                            },
                            {
                                name: 'boundaryGeojson',
                                label: 'Zonasi peta kelurahan',
                                kind: 'boundary',
                                wide: true,
                                hint: 'Opsional. Ambil batas poligon administratif kelurahan agar muncul di peta zonasi.',
                            },
                        ]}
                        saveAction={saveKelurahanAction}
                        deleteAction={deleteKelurahanAction}
                    />
                    <Pager
                        info={{ page, perPage, total }}
                        buildHref={(n) =>
                            `/admin/kelurahan?${new URLSearchParams({
                                ...(q ? { q } : {}),
                                page: String(n),
                            })}`
                        }
                    />
                </Panel>
            </PageContent>
        </PageBody>
    );
}
