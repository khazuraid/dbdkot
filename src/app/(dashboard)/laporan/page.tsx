import Link from 'next/link';
import { requireActor } from '@/lib/session';
import {
    STATUSES,
    STATUS_LABEL,
    listReports,
    type ReportStatus,
} from '@/lib/domain/reports';
import { formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/shell/page';
import { LiveData } from '@/components/shell/live-data';
import { ReportTable } from '@/components/reports/report-table';

// Data pasien: rute ini harus dirender per permintaan, bukan dari shell statis.
export const instant = false;

type Search = { status?: string; search?: string; page?: string };

export default async function LaporanPage({
    searchParams,
}: {
    searchParams: Promise<Search>;
}) {
    const sp = await searchParams;
    const actor = await requireActor();

    const status = STATUSES.includes(sp.status as ReportStatus)
        ? (sp.status as ReportStatus)
        : undefined;
    const search = sp.search?.trim() || undefined;
    const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);

    const { rows, total, perPage } = await listReports(actor, {
        status,
        search,
        page,
    });
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    // Rendered on the server so the first paint already shows a real time.
    const renderedAt = new Date().toLocaleTimeString('id-ID', {
        timeStyle: 'short',
    });

    return (
        <div className="px-[var(--pad)] py-8">
            <PageHeader
                aside={<LiveData since={renderedAt} />}
                title="Laporan"
                context={`${formatNumber(total)} laporan${status ? ` · ${STATUS_LABEL[status]}` : ''}`}
                action={
                    actor.role === 'RUMAH_SAKIT'
                        ? { href: '/laporan/baru', label: 'Lapor kasus' }
                        : undefined
                }
            />

            {/* GET form: filters survive a reload and need no client JS. */}
            <form
                className="mt-6 flex flex-wrap items-end gap-2"
                action="/laporan"
            >
                <div className="space-y-1.5">
                    <label
                        htmlFor="status"
                        className="text-[12px] text-muted-foreground"
                    >
                        Status
                    </label>
                    <select
                        id="status"
                        name="status"
                        defaultValue={status ?? ''}
                        className="h-9 rounded-md border border-input bg-card px-2 text-[14px]"
                    >
                        <option value="">Semua</option>
                        {STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {STATUS_LABEL[s]}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1.5">
                    <label
                        htmlFor="search"
                        className="text-[12px] text-muted-foreground"
                    >
                        Cari
                    </label>
                    <input
                        id="search"
                        name="search"
                        defaultValue={search ?? ''}
                        placeholder="No. laporan atau kelurahan"
                        className="h-9 w-64 rounded-md border border-input bg-card px-3 text-[14px]"
                    />
                </div>

                <button
                    type="submit"
                    className="border-control h-9 rounded-md border px-3 text-[14px] hover:bg-[var(--raised)]"
                >
                    Terapkan
                </button>
            </form>

            <div className="mt-8">
                <ReportTable
                    rows={rows}
                    empty="Tidak ada laporan yang cocok."
                />
            </div>

            {lastPage > 1 && (
                <nav className="mt-6 flex items-center justify-between text-[13px]">
                    <Pager
                        page={page - 1}
                        disabled={page <= 1}
                        status={status}
                        search={search}
                    >
                        Sebelumnya
                    </Pager>
                    <span className="text-muted-foreground">
                        Halaman {page} dari {lastPage}
                    </span>
                    <Pager
                        page={page + 1}
                        disabled={page >= lastPage}
                        status={status}
                        search={search}
                    >
                        Berikutnya
                    </Pager>
                </nav>
            )}
        </div>
    );
}

function Pager({
    page,
    disabled,
    status,
    search,
    children,
}: {
    page: number;
    disabled: boolean;
    status?: string;
    search?: string;
    children: React.ReactNode;
}) {
    if (disabled) {
        return (
            <span className="px-1 py-1 text-muted-foreground/50">
                {children}
            </span>
        );
    }

    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    if (page > 1) params.set('page', String(page));

    return (
        <Link href={`/laporan?${params}`} className="px-1 py-1 underline">
            {children}
        </Link>
    );
}
