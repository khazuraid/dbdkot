import Link from 'next/link';
import {
    FileText,
    FolderOpen,
    HardDrive,
    Image as ImageIcon,
    Search,
    ShieldCheck,
} from 'lucide-react';
import { requireRole } from '@/lib/session';
import {
    listAllUploadedFiles,
    type AdminUploadedFileRow,
} from '@/lib/domain/attachments';
import { formatDate, formatTime } from '@/lib/format';
import {
    PageBody,
    PageContent,
    PageHeader,
    Panel,
} from '@/components/shell/page';
import { AutoFilterForm } from '@/components/shell/auto-filter-form';
import { DataTable, Dash } from '@/components/shell/data-table';
import { Pager, readPage } from '@/components/shell/pager-view';
import { Stat, StatRow } from '@/components/shell/stat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from '@/components/ui/input-group';
import { UploadedFileRowActions } from './file-controls';

export const instant = false;

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default async function AdminUploadedFilesPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; q?: string; kind?: string }>;
}) {
    const actor = await requireRole('ADMIN');
    const sp = await searchParams;
    const q = sp.q?.trim() ?? '';
    const kind =
        sp.kind === 'image' || sp.kind === 'pdf' ? sp.kind : undefined;

    const { rows, page, perPage, total, summary } =
        await listAllUploadedFiles(actor, {
            page: readPage(sp.page),
            perPage: 25,
            q,
            kind,
        });

    const buildHref = (p: number) => {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (kind) params.set('kind', kind);
        if (p > 1) params.set('page', String(p));
        const qs = params.toString();
        return qs ? `/admin/berkas?${qs}` : '/admin/berkas';
    };

    const columns = [
        {
            key: 'file',
            header: 'Berkas & Tipe',
            cell: (r: AdminUploadedFileRow) => {
                const isImage = r.fileType.startsWith('image/');
                return (
                    <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-[var(--surface)] text-muted-foreground">
                            {isImage ? (
                                <ImageIcon className="size-4 text-[var(--accent)]" />
                            ) : (
                                <FileText className="size-4 text-[var(--warning)]" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <p
                                className="max-w-[260px] truncate font-medium text-foreground"
                                title={r.fileName}
                            >
                                {r.fileName}
                            </p>
                            <p className="font-mono text-[11px] text-muted-foreground">
                                {r.fileType}
                            </p>
                        </div>
                    </div>
                );
            },
        },
        {
            key: 'size',
            header: 'Ukuran',
            className: 'w-28',
            cell: (r: AdminUploadedFileRow) => (
                <span className="font-mono text-[12px] text-foreground tabular-nums">
                    {formatBytes(r.fileSize)}
                </span>
            ),
        },
        {
            key: 'report',
            header: 'Laporan Terkait',
            className: 'w-44',
            cell: (r: AdminUploadedFileRow) =>
                r.reportRSId ? (
                    <Link
                        href={`/laporan/${r.reportRSId}`}
                        className="font-mono text-[12px] text-[var(--accent)] underline-offset-4 hover:underline"
                    >
                        {r.reportNumber ?? r.reportRSId.slice(0, 8)}
                    </Link>
                ) : (
                    <Dash />
                ),
        },
        {
            key: 'uploader',
            header: 'Pengunggah',
            cell: (r: AdminUploadedFileRow) => (
                <div className="text-[12.5px]">
                    <p className="font-medium text-foreground">
                        {r.uploaderName ?? 'Pengguna'}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground">
                        {r.uploaderEmail ?? r.uploaderId.slice(0, 8)}
                    </p>
                </div>
            ),
        },
        {
            key: 'createdAt',
            header: 'Waktu Unggah',
            className: 'w-40',
            cell: (r: AdminUploadedFileRow) => (
                <div className="font-mono text-[12px] tabular-nums">
                    <span className="text-foreground">
                        {formatDate(r.createdAt)}
                    </span>
                    <span className="ml-1.5 text-muted-foreground">
                        {formatTime(r.createdAt)}
                    </span>
                </div>
            ),
        },
        {
            key: 'actions',
            header: 'Tindakan',
            align: 'right' as const,
            className: 'w-44',
            cell: (r: AdminUploadedFileRow) => (
                <UploadedFileRowActions
                    row={{
                        id: r.id,
                        fileName: r.fileName,
                        fileType: r.fileType,
                        fileSize: r.fileSize,
                        filePath: r.filePath,
                        href: r.href,
                        reportRSId: r.reportRSId,
                        reportNumber: r.reportNumber,
                        reportPEId: r.reportPEId,
                        uploaderId: r.uploaderId,
                        uploaderName: r.uploaderName,
                        uploaderEmail: r.uploaderEmail,
                        createdAtLabel: `${formatDate(r.createdAt)} ${formatTime(r.createdAt)}`,
                    }}
                />
            ),
        },
    ];

    return (
        <PageBody>
            <PageHeader
                title="Berkas Unggahan Sistem"
                context="Daftar terpusat seluruh lampiran laporan (PDF & gambar) yang lolos Magic Byte Validator — akses khusus Administrator."
                aside={
                    <Badge
                        variant="outline"
                        className="gap-1.5 border-[var(--positive)]/40 bg-[var(--pill-positive-bg)] text-[var(--positive)]"
                    >
                        <ShieldCheck className="size-3.5" />
                        Admin Only · Magic Byte Verified
                    </Badge>
                }
            />

            <PageContent className="space-y-6">
                <StatRow className="grid-cols-2 lg:grid-cols-4">
                    <Stat
                        label="Total Berkas"
                        value={summary.allCount}
                        hint="Seluruh lampiran tersimpan"
                        icon={FolderOpen}
                        signal="neutral"
                    />
                    <Stat
                        label="Total Penyimpanan"
                        value={formatBytes(summary.totalBytes)}
                        hint="Pemakaian direktori uploads/"
                        icon={HardDrive}
                        signal="neutral"
                    />
                    <Stat
                        label="Berkas Gambar"
                        value={summary.imageCount}
                        hint="JPG, PNG, WEBP terverifikasi"
                        icon={ImageIcon}
                        signal="good"
                    />
                    <Stat
                        label="Dokumen PDF"
                        value={summary.pdfCount}
                        hint="Lampiran PDF terproteksi CSP"
                        icon={FileText}
                        signal="neutral"
                    />
                </StatRow>

                <Panel
                    padded
                    title="Inventaris Berkas Terunggah"
                    aside={
                        <span className="font-mono text-[11.5px] text-muted-foreground tabular-nums">
                            {total} berkas cocok
                        </span>
                    }
                >
                    <AutoFilterForm
                        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                        debounceMs={300}
                    >
                        <InputGroup className="max-w-md">
                            <InputGroupAddon>
                                <Search className="size-4 text-muted-foreground" />
                            </InputGroupAddon>
                            <InputGroupInput
                                name="q"
                                defaultValue={q}
                                placeholder="Cari nama berkas, nomor laporan, pengunggah…"
                                aria-label="Cari berkas"
                            />
                        </InputGroup>

                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                name="kind"
                                defaultValue={kind ?? ''}
                                aria-label="Filter tipe berkas"
                                className="h-[var(--control-height)] rounded-[var(--radius-control)] border border-border bg-[var(--raised)] px-3 text-[13px] text-foreground"
                            >
                                <option value="">Semua Tipe Berkas</option>
                                <option value="image">Gambar (JPG / PNG / WEBP)</option>
                                <option value="pdf">Dokumen PDF</option>
                            </select>

                            {(q || kind) && (
                                <Link href="/admin/berkas">
                                    <Button type="button" variant="ghost" size="sm">
                                        Reset
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </AutoFilterForm>

                    <DataTable
                        columns={columns}
                        rows={rows}
                        empty="Belum ada berkas yang diunggah atau cocok dengan filter."
                    />

                    <div className="mt-4">
                        <Pager
                            info={{ page, perPage, total }}
                            buildHref={buildHref}
                            label="berkas"
                        />
                    </div>
                </Panel>
            </PageContent>
        </PageBody>
    );
}
