import { Search, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { institutionChoices, listAssetsPaged } from '@/lib/domain/master';
import { formatNumber } from '@/lib/format';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { Dash } from '@/components/shell/data-table';
import { Pager, readPage } from '@/components/shell/pager-view';
import { StatusText } from '@/components/shell/status-text';
import { MasterTable } from '@/components/admin/master-table';
import {
    MasterTableView,
    type TableColumn,
} from '@/components/admin/master-table-view';
import { Button } from '@/components/ui/button';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from '@/components/ui/input-group';
import { deleteAssetAction, saveAssetAction } from './actions';

// Data stok: rute ini dirender per permintaan, bukan dari shell statis.
export const instant = false;

type Row = Awaited<ReturnType<typeof listAssetsPaged>>['rows'][number];

export default async function AsetPage({
    searchParams,
}: {
    searchParams: Promise<{
        page?: string;
        q?: string;
        tambah?: string;
        ubah?: string;
        hapus?: string;
    }>;
}) {
    const sp = await searchParams;
    const actor = await requireRole('ADMIN', 'PUSKESMAS');
    const q = sp.q?.trim() ?? '';
    const [{ rows, page, perPage, total }, allInstitutions] = await Promise.all(
        [
            listAssetsPaged(actor, { q, page: readPage(sp.page) }),
            institutionChoices(),
        ],
    );
    const institutions =
        actor.role === 'PUSKESMAS' && actor.institutionId
            ? allInstitutions.filter((i) => i.id === actor.institutionId)
            : allInstitutions;

    const low = rows.filter(
        (a) => Number(a.currentStock) < Number(a.minimumStock),
    ).length;

    const columns: TableColumn<Row>[] = [
        {
            key: 'code',
            header: 'Kode',
            cell: (a) => (
                <span className="font-mono text-[12px] text-muted-foreground">
                    {a.code}
                </span>
            ),
        },
        {
            key: 'name',
            header: 'Nama',
            cell: (a) => (
                <span className="font-medium text-foreground">{a.name}</span>
            ),
        },
        {
            key: 'category',
            header: 'Kategori',
            cell: (a) => (
                <span className="text-muted-foreground">{a.category}</span>
            ),
        },
        {
            key: 'institution',
            header: 'Institusi',
            cell: (a) => a.institutionName ?? <Dash />,
        },
        {
            key: 'stock',
            header: 'Stok',
            align: 'right',
            cell: (a) => (
                <span
                    className={
                        Number(a.currentStock) < Number(a.minimumStock)
                            ? 'font-medium text-[var(--warning)]'
                            : undefined
                    }
                >
                    {formatNumber(Number(a.currentStock))}
                    <span className="text-faint"> / min {a.minimumStock}</span>
                </span>
            ),
        },
        {
            key: 'unit',
            header: 'Satuan',
            cell: (a) => (
                <span className="text-muted-foreground">{a.unit}</span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (a) => (
                <StatusText tone={a.isActive ? 'good' : 'neutral'}>
                    {a.isActive ? 'Aktif' : 'Diarsipkan'}
                </StatusText>
            ),
        },
    ];

    return (
        <PageBody>
            <PageHeader
                title="Aset"
                context={
                    <>
                        Stok insektisida, larvasida, dan alat pemeriksaan.
                        {low > 0 && (
                            <span className="text-[var(--warning)]">
                                {' '}
                                {low} di bawah minimum di halaman ini.
                            </span>
                        )}
                    </>
                }
            >
                <form
                    action="/aset"
                    className="flex flex-wrap items-center gap-2"
                >
                    <InputGroup className="h-9 w-full sm:w-[260px]">
                        <InputGroupAddon>
                            <Search className="size-4" aria-hidden />
                        </InputGroupAddon>
                        <InputGroupInput
                            type="search"
                            name="q"
                            defaultValue={q}
                            placeholder="Cari nama atau kode…"
                            aria-label="Cari aset"
                        />
                    </InputGroup>
                </form>
            </PageHeader>

            <PageContent>
                <Panel
                    title={`${formatNumber(total)} jenis aset${q ? ` · “${q}”` : ''}`}
                    aside={
                        <Button asChild size="sm">
                            <Link href="/aset?tambah=1" scroll={false}>
                                <PlusIcon aria-hidden /> Tambah aset
                            </Link>
                        </Button>
                    }
                >
                    <MasterTableView<Row>
                        singular="Aset"
                        pathname="/aset"
                        rows={rows}
                        columns={columns}
                        empty={
                            <span className="text-[13px] normal-case">
                                Belum ada aset terdaftar untuk institusi
                                Anda.
                            </span>
                        }
                    />

                    <MasterTable<Row>
                        singular="Aset"
                        rows={rows}
                        editId={sp.ubah ?? (sp.tambah ? 'tambah' : null)}
                        deleteId={sp.hapus}
                        fields={[
                            {
                                name: 'name',
                                label: 'Nama',
                                kind: 'text',
                                required: true,
                                placeholder: 'Malathion 50%',
                            },
                            {
                                name: 'code',
                                label: 'Kode',
                                kind: 'text',
                                required: true,
                                placeholder: 'INS-MAL-50',
                            },
                            {
                                name: 'category',
                                label: 'Kategori',
                                kind: 'text',
                                required: true,
                                placeholder: 'Insektisida',
                            },
                            {
                                name: 'unit',
                                label: 'Satuan',
                                kind: 'text',
                                required: true,
                                placeholder: 'liter',
                            },
                            {
                                name: 'institutionId',
                                label: 'Institusi',
                                kind: 'select',
                                required: true,
                                options: institutions.map((i) => ({
                                    value: i.id,
                                    label: i.name,
                                })),
                            },
                            {
                                name: 'currentStock',
                                label: 'Stok',
                                kind: 'number',
                                step: '1',
                                required: true,
                                placeholder: '0',
                            },
                            {
                                name: 'minimumStock',
                                label: 'Stok minimum',
                                kind: 'number',
                                step: '1',
                                required: true,
                                placeholder: '0',
                            },
                            {
                                name: 'isActive',
                                label: 'Aktif',
                                kind: 'checkbox',
                            },
                        ]}
                        saveAction={saveAssetAction}
                        deleteAction={deleteAssetAction}
                    />
                    <Pager
                        info={{ page, perPage, total }}
                        buildHref={(n) =>
                            `/aset?${new URLSearchParams({
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
