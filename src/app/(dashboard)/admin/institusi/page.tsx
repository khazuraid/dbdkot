import {
    AlertTriangle,
    Building2,
    Hospital,
    PlusIcon,
    Search,
    Stethoscope,
} from 'lucide-react';
import Link from 'next/link';
import { requireRole } from '@/lib/session';
import {
    listInstitutionsPaged,
    listKelurahanOptions,
    type InstitutionTypeFilter,
} from '@/lib/domain/master';
import { formatNumber } from '@/lib/format';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { Dash } from '@/components/shell/data-table';
import { Pager, readPage } from '@/components/shell/pager-view';
import { Stat } from '@/components/shell/stat';
import { StatusText } from '@/components/shell/status-text';
import { MasterTable } from '@/components/admin/master-table';
import {
    MasterTableView,
    type TableColumn,
} from '@/components/admin/master-table-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from '@/components/ui/input-group';
import { cn } from '@/lib/utils';
import { deleteInstitutionAction, saveInstitutionAction } from './actions';

// Data fasilitas: rute ini dirender per permintaan, bukan dari shell statis.
export const instant = false;

const TYPE_LABEL: Record<string, string> = {
    RUMAH_SAKIT: 'Rumah sakit',
    PUSKESMAS: 'Puskesmas',
    DINAS_KESEHATAN: 'Dinas kesehatan',
};

const TYPE_FILTERS: { value: '' | InstitutionTypeFilter; label: string }[] = [
    { value: '', label: 'Semua' },
    { value: 'PUSKESMAS', label: 'Puskesmas' },
    { value: 'RUMAH_SAKIT', label: 'Rumah sakit' },
    { value: 'DINAS_KESEHATAN', label: 'Dinas kesehatan' },
];

function typeBadgeClass(type: string) {
    if (type === 'PUSKESMAS') {
        return 'border-[var(--border)] bg-[var(--accent-soft)] text-[var(--accent)]';
    }
    if (type === 'RUMAH_SAKIT') {
        return 'border-[var(--pill-info-border)] bg-[var(--pill-info-bg)] text-[var(--pill-info-ink)]';
    }
    return 'border-[var(--pill-neutral-border)] bg-[var(--pill-neutral-bg)] text-[var(--pill-neutral-ink)]';
}

type Row = Awaited<ReturnType<typeof listInstitutionsPaged>>['rows'][number];

export default async function InstitusiPage({
    searchParams,
}: {
    searchParams: Promise<{
        page?: string;
        q?: string;
        type?: string;
        tambah?: string;
        ubah?: string;
        hapus?: string;
    }>;
}) {
    const sp = await searchParams;
    await requireRole('ADMIN', 'DINKES');
    const q = sp.q?.trim() ?? '';
    const type: InstitutionTypeFilter | undefined =
        sp.type === 'PUSKESMAS' ||
        sp.type === 'RUMAH_SAKIT' ||
        sp.type === 'DINAS_KESEHATAN'
            ? sp.type
            : undefined;
    const [{ rows, page, perPage, total, summary }, kelurahanOpts] =
        await Promise.all([
            listInstitutionsPaged({
                q,
                type,
                page: readPage(sp.page),
            }),
            listKelurahanOptions(),
        ]);

    const buildQuery = (overrides: { page?: number; type?: string; q?: string }) => {
        const nextQ = overrides.q !== undefined ? overrides.q : q;
        const nextType =
            overrides.type !== undefined ? overrides.type : (type ?? '');
        const nextPage = overrides.page ?? 1;
        const params = new URLSearchParams();
        if (nextQ) params.set('q', nextQ);
        if (nextType) params.set('type', nextType);
        if (nextPage > 1) params.set('page', String(nextPage));
        const qs = params.toString();
        return qs ? `/admin/institusi?${qs}` : '/admin/institusi';
    };

    const columns: TableColumn<Row>[] = [
        {
            key: 'name',
            header: 'Institusi',
            cell: (i) => (
                <div className="min-w-0">
                    <p className="font-medium text-foreground">{i.name}</p>
                    {(i.phoneNumber || i.address) && (
                        <p className="mt-0.5 max-w-[260px] truncate text-[12px] text-muted-foreground">
                            {[i.phoneNumber, i.address]
                                .filter(Boolean)
                                .join(' · ')}
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: 'type',
            header: 'Jenis',
            cell: (i) => (
                <Badge variant="outline" className={typeBadgeClass(i.type)}>
                    {TYPE_LABEL[i.type] ?? i.type}
                </Badge>
            ),
        },
        {
            key: 'city',
            header: 'Kota',
            cell: (i) =>
                i.city ? (
                    <span>
                        {i.city}
                        {i.province && (
                            <span className="block text-[11.5px] text-muted-foreground">
                                {i.province}
                            </span>
                        )}
                    </span>
                ) : (
                    <Dash />
                ),
        },
        {
            key: 'coverage',
            header: 'Wilayah kerja',
            cell: (i) => {
                if (i.type !== 'PUSKESMAS') return <Dash />;
                if (i.kelurahanList.length === 0) {
                    return (
                        <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--pill-warning-ink)]">
                            Belum diatur
                        </span>
                    );
                }
                return (
                    <div
                        title={i.kelurahanList.join(', ')}
                        className="max-w-[220px]"
                    >
                        <span className="font-mono text-[12px] font-medium text-foreground">
                            {i.kelurahanList.length} kelurahan
                        </span>
                        <p className="truncate text-[11.5px] text-muted-foreground">
                            {i.kelurahanList.slice(0, 3).join(', ')}
                            {i.kelurahanList.length > 3 ? '…' : ''}
                        </p>
                    </div>
                );
            },
        },
        {
            key: 'users',
            header: 'Akun',
            align: 'right',
            cell: (i) => formatNumber(i.userCount),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (i) => (
                <StatusText tone={i.isActive ? 'good' : 'neutral'}>
                    {i.isActive ? 'Aktif' : 'Nonaktif'}
                </StatusText>
            ),
        },
    ];

    return (
        <PageBody>
            <PageHeader
                title="Institusi"
                context="Fasilitas kesehatan dan wilayah kerjanya. Wilayah inilah yang menentukan laporan masuk ke puskesmas mana."
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <form
                        action="/admin/institusi"
                        className="flex flex-wrap items-center gap-2"
                    >
                        {type && (
                            <input type="hidden" name="type" value={type} />
                        )}
                        <InputGroup className="h-9 w-full sm:w-[260px]">
                            <InputGroupAddon>
                                <Search className="size-4" aria-hidden />
                            </InputGroupAddon>
                            <InputGroupInput
                                type="search"
                                name="q"
                                defaultValue={q}
                                placeholder="Cari nama atau kota…"
                                aria-label="Cari institusi"
                            />
                        </InputGroup>
                        <Button type="submit" variant="outline" size="sm">
                            Cari
                        </Button>
                        {(q || type) && (
                            <Button asChild variant="ghost" size="sm">
                                <Link href="/admin/institusi">Reset</Link>
                            </Button>
                        )}
                    </form>

                    <div
                        role="group"
                        aria-label="Filter jenis institusi"
                        className="flex flex-wrap items-center gap-1.5"
                    >
                        {TYPE_FILTERS.map((opt) => {
                            const active = (type ?? '') === opt.value;
                            return (
                                <Link
                                    key={opt.label}
                                    href={buildQuery({ type: opt.value })}
                                    className={cn(
                                        'inline-flex h-8 items-center rounded-[var(--radius-pill)] border px-3 text-[12.5px] font-medium transition-colors',
                                        active
                                            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                                            : 'border-[var(--border)] bg-[var(--surface)] text-muted-foreground hover:bg-[var(--raised)] hover:text-foreground',
                                    )}
                                >
                                    {opt.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </PageHeader>

            <PageContent className="space-y-5">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat
                        label="Total institusi"
                        value={summary.total}
                        icon={Building2}
                    />
                    <Stat
                        label="Puskesmas"
                        value={summary.puskesmas}
                        icon={Stethoscope}
                    />
                    <Stat
                        label="Rumah sakit"
                        value={summary.rumahSakit}
                        icon={Hospital}
                    />
                    <Stat
                        label="Puskesmas tanpa wilayah"
                        value={summary.uncoveredPuskesmas}
                        signal={
                            summary.uncoveredPuskesmas > 0 ? 'warn' : 'good'
                        }
                        hint={
                            summary.uncoveredPuskesmas > 0
                                ? 'Lengkapi wilayah kerja untuk auto-assign'
                                : 'Semua puskesmas aktif punya wilayah'
                        }
                        icon={AlertTriangle}
                    />
                </dl>

                <Panel
                    title={`${formatNumber(total)} institusi${type ? ` · ${TYPE_LABEL[type]}` : ''}${q ? ` · “${q}”` : ''}`}
                    aside={
                        <Button asChild size="sm">
                            <Link
                                href="/admin/institusi?tambah=1"
                                scroll={false}
                            >
                                <PlusIcon aria-hidden /> Tambah institusi
                            </Link>
                        </Button>
                    }
                >
                    <MasterTableView<Row>
                        singular="Institusi"
                        pathname="/admin/institusi"
                        rows={rows}
                        columns={columns}
                        empty={
                            q || type ? (
                                <span className="text-[13px] normal-case">
                                    Tidak ada institusi yang cocok dengan
                                    filter saat ini.
                                </span>
                            ) : (
                                <span className="text-[13px] normal-case">
                                    Belum ada institusi. Tambahkan puskesmas
                                    lebih dulu: laporan hanya bisa ditugaskan ke
                                    wilayah yang terdaftar.
                                </span>
                            )
                        }
                    />

                    <MasterTable<Row>
                        singular="Institusi"
                        rows={rows}
                        editId={sp.ubah ?? (sp.tambah ? 'tambah' : null)}
                        deleteId={sp.hapus}
                        fields={[
                            {
                                name: 'name',
                                label: 'Nama',
                                kind: 'text',
                                required: true,
                                placeholder: 'Puskesmas Cilodong',
                            },
                            {
                                name: 'type',
                                label: 'Jenis',
                                kind: 'select',
                                required: true,
                                options: [
                                    {
                                        value: 'PUSKESMAS',
                                        label: 'Puskesmas',
                                    },
                                    {
                                        value: 'RUMAH_SAKIT',
                                        label: 'Rumah sakit',
                                    },
                                    {
                                        value: 'DINAS_KESEHATAN',
                                        label: 'Dinas kesehatan',
                                    },
                                ],
                            },
                            {
                                name: 'city',
                                label: 'Kota',
                                kind: 'text',
                                placeholder: 'Depok',
                            },
                            {
                                name: 'province',
                                label: 'Provinsi',
                                kind: 'text',
                                placeholder: 'Jawa Barat',
                            },
                            {
                                name: 'address',
                                label: 'Alamat',
                                kind: 'textarea',
                                wide: true,
                            },
                            {
                                name: 'phoneNumber',
                                label: 'Telepon',
                                kind: 'text',
                                wide: true,
                            },
                            {
                                name: 'kelurahanList',
                                label: 'Wilayah kerja',
                                kind: 'list',
                                wide: true,
                                visibleWhen: {
                                    field: 'type',
                                    value: 'PUSKESMAS',
                                },
                                options: kelurahanOpts.map((k) => ({
                                    value: k.name,
                                    label: k.name,
                                    hint: `${k.kecamatan}, ${k.kota}`,
                                })),
                                hint: 'Pilih dari kelurahan terdaftar. Hanya puskesmas yang memakai wilayah kerja untuk penugasan laporan.',
                                placeholder: 'Cari kelurahan atau kecamatan…',
                            },
                            {
                                name: 'isActive',
                                label: 'Aktif',
                                kind: 'checkbox',
                                placeholder: 'Tampil sebagai tujuan penugasan',
                            },
                        ]}
                        saveAction={saveInstitutionAction}
                        deleteAction={deleteInstitutionAction}
                    />
                    <Pager
                        info={{ page, perPage, total }}
                        buildHref={(n) => buildQuery({ page: n })}
                    />
                </Panel>
            </PageContent>
        </PageBody>
    );
}
