import Link from 'next/link';
import { requireActor } from '@/lib/session';
import {
    STATUSES,
    STATUS_LABEL,
    listReports,
    type ReportStatus,
} from '@/lib/domain/reports';
import { formatNumber } from '@/lib/format';
import { PageBody, PageHeader } from '@/components/shell/page';
import { LiveData } from '@/components/shell/live-data';
import { ReportTable } from '@/components/reports/report-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
        <PageBody>
            <PageHeader
                aside={<LiveData since={renderedAt} />}
                title="Laporan"
                context={`${formatNumber(total)} laporan${status ? `, ${STATUS_LABEL[status]}` : ''}`}
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
                    <Label
                        htmlFor="status"
                        className="text-[12px] font-medium text-muted-foreground"
                    >
                        Status
                    </Label>
                    <select
                        id="status"
                        name="status"
                        defaultValue={status ?? ''}
                        className="h-9 rounded-[var(--radius-control)] border border-[var(--control)] bg-card px-2 text-[14px]"
                    >
                        <option value="">Semua</option>
                        {STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {STATUS_LABEL[s]}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="min-w-0 flex-1 space-y-1.5 sm:flex-none">
                    <Label
                        htmlFor="search"
                        className="text-[12px] font-medium text-muted-foreground"
                    >
                        Cari
                    </Label>
                    <Input
                        id="search"
                        name="search"
                        defaultValue={search ?? ''}
                        placeholder="No. laporan atau kelurahan"
                        className="h-9 w-full sm:w-64"
                    />
                </div>

                <Button type="submit" variant="outline" className="h-9 px-3">
                    Terapkan
                </Button>

                {(status || search) && (
                    <Link
                        href="/laporan"
                        className="pb-2 text-[13px] text-muted-foreground underline decoration-[var(--control)] underline-offset-4 hover:text-foreground"
                    >
                        Reset
                    </Link>
                )}
            </form>

            <div className="mt-6">
                <ReportTable
                    rows={rows}
                    empty="Tidak ada laporan yang cocok dengan filter ini."
                />
            </div>

            {lastPage > 1 && (
                <nav
                    aria-label="Navigasi halaman"
                    className="mt-6 flex items-center justify-between border-t border-border pt-3 text-[13px]"
                >
                    <PageLink
                        page={page - 1}
                        disabled={page <= 1}
                        status={status}
                        search={search}
                    >
                        Sebelumnya
                    </PageLink>
                    <span className="tabular-nums text-muted-foreground">
                        Halaman {page} dari {lastPage}
                    </span>
                    <PageLink
                        page={page + 1}
                        disabled={page >= lastPage}
                        status={status}
                        search={search}
                    >
                        Berikutnya
                    </PageLink>
                </nav>
            )}
        </PageBody>
    );
}

function PageLink({
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
            <span aria-disabled className="text-muted-foreground/60">
                {children}
            </span>
        );
    }

    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    if (page > 1) params.set('page', String(page));

    return (
        <Link
            href={`/laporan?${params}`}
            className="underline decoration-[var(--control)] underline-offset-4 hover:decoration-[var(--text)]"
        >
            {children}
        </Link>
    );
}
