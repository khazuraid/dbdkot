'use client';

import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import {
    createColumnHelper,
    FlexRender,
    rowSortingFeature,
    tableFeatures,
    useTable,
    type CellData,
    type RowData,
    type TableFeatures,
} from '@tanstack/react-table';
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ClipboardCopy,
    ExternalLink,
    Eye,
    FilePlus2,
    MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dash } from '@/components/shell/data-table';
import { Empty } from '@/components/shell/page';
import { StatusText } from '@/components/shell/status-text';
import { Button } from '@/components/ui/button';
import { SpringSheet } from '@/components/ui/drawer';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    CASE_TYPE_LABEL,
    STATUS_LABEL,
    STATUS_TONE,
    type ReportListRow,
    type ReportStatus,
} from '@/lib/domain/report-labels';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

type StageKey = 'all' | 'kdrs' | 'pe' | 'fogging' | 'closed';

const STAGE_TABS: {
    key: StageKey;
    label: string;
    statuses: readonly ReportStatus[] | null;
}[] = [
    { key: 'all', label: 'Semua', statuses: null },
    {
        key: 'kdrs',
        label: 'KDRS',
        statuses: [
            'DRAFT',
            'SUBMITTED',
            'CROSS_BORDER_PENDING',
            'ARCHIVED_CROSS_BORDER',
            'PUSKESMAS_REJECTED',
            'REJECTED',
        ],
    },
    {
        key: 'pe',
        label: 'PE 72 Jam',
        statuses: [
            'ASSIGNED',
            'ASSIGNED_ACCEPTED',
            'PE_IN_PROGRESS',
            'PE_COMPLETED',
            'VERIFIED',
        ],
    },
    {
        key: 'fogging',
        label: 'Fogging',
        statuses: [
            'FOGGING_REQUIRED',
            'SIKLUS_1_DONE',
            'SIKLUS_2_SCHEDULED',
            'SIKLUS_2_DONE',
        ],
    },
    { key: 'closed', label: 'Selesai', statuses: ['CLOSED'] },
];

/* eslint-disable @typescript-eslint/no-unused-vars */
declare module '@tanstack/table-core' {
    interface ColumnMeta<
        TFeatures extends TableFeatures,
        TData extends RowData,
        TValue extends CellData,
    > {
        align?: 'right';
    }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

const features = tableFeatures({ rowSortingFeature });
const helper = createColumnHelper<typeof features, ReportListRow>();

/**
 * Shared report ledger table using the unified `.ledger` stylesheet,
 * hairline borders, horizontal overflow guard, StatusText badges, and
 * keyboard-accessible column sorting.
 */
export function ReportTable({
    rows,
    empty,
    onSelectRow,
    selectedId,
    showStatusTabs = false,
}: {
    rows: ReportListRow[];
    empty: string;
    onSelectRow?: (id: string) => void;
    selectedId?: string;
    /** Show sliding active-pill status stage filter bar above the table. */
    showStatusTabs?: boolean;
}) {
    const reduce = Boolean(useReducedMotion());
    const pillId = `status-pill-${useId()}`;
    const [stage, setStage] = useState<StageKey>('all');
    const [hasInteracted, setHasInteracted] = useState(false);
    const [previewRow, setPreviewRow] = useState<ReportListRow | null>(null);
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const stageCounts = useMemo(() => {
        const counts: Record<StageKey, number> = {
            all: rows.length,
            kdrs: 0,
            pe: 0,
            fogging: 0,
            closed: 0,
        };
        for (const row of rows) {
            for (const tab of STAGE_TABS) {
                if (tab.statuses && tab.statuses.includes(row.status)) {
                    counts[tab.key] += 1;
                    break;
                }
            }
        }
        return counts;
    }, [rows]);

    const filteredRows = useMemo(() => {
        if (!showStatusTabs || stage === 'all') return rows;
        const activeTab = STAGE_TABS.find((t) => t.key === stage);
        if (!activeTab?.statuses) return rows;
        return rows.filter((row) => activeTab.statuses!.includes(row.status));
    }, [rows, showStatusTabs, stage]);

    function selectStage(next: StageKey) {
        if (next === stage) return;
        setHasInteracted(true);
        setStage(next);
    }

    function handleTabKeyDown(
        e: KeyboardEvent<HTMLButtonElement>,
        idx: number,
    ) {
        let nextIdx: number | null = null;
        if (e.key === 'ArrowRight') nextIdx = (idx + 1) % STAGE_TABS.length;
        else if (e.key === 'ArrowLeft')
            nextIdx = (idx - 1 + STAGE_TABS.length) % STAGE_TABS.length;
        else if (e.key === 'Home') nextIdx = 0;
        else if (e.key === 'End') nextIdx = STAGE_TABS.length - 1;

        if (nextIdx !== null) {
            e.preventDefault();
            selectStage(STAGE_TABS[nextIdx]!.key);
            tabRefs.current[nextIdx]?.focus();
        }
    }

    const columns = helper.columns([
        helper.accessor('reportNumber', {
            header: 'No. laporan',
            cell: (c) => (
                <Link
                    href={`/laporan/${c.row.original.id}`}
                    className="font-mono text-[13px] font-medium text-[var(--accent)] underline-offset-4 hover:underline"
                >
                    {c.getValue()}
                </Link>
            ),
        }),
        helper.accessor('caseType', {
            header: 'Kasus',
            cell: (c) => (
                <span className="font-medium">
                    {CASE_TYPE_LABEL[c.getValue()] ?? c.getValue()}
                </span>
            ),
        }),
        helper.accessor('sourceType', {
            header: 'Sumber',
            cell: (c) => {
                const src = c.getValue();
                const isPuskesmas =
                    src === 'PUSKESMAS_POLI' || src === 'PUSKESMAS';
                return (
                    <span
                        className={cn(
                            'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium tracking-tight',
                            isPuskesmas
                                ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-600/20 ring-inset dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-500/30'
                                : 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20 ring-inset dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-500/30',
                        )}
                    >
                        {isPuskesmas ? 'Puskesmas' : 'Rumah Sakit'}
                    </span>
                );
            },
        }),
        helper.accessor((r) => r.kelurahan ?? r.kecamatan ?? '', {
            id: 'wilayah',
            header: 'Wilayah',
            cell: (c) => {
                const { kelurahan, kecamatan } = c.row.original;
                const place = [kelurahan, kecamatan].filter(Boolean).join(', ');
                return place ? (
                    <span className="text-muted-foreground">{place}</span>
                ) : (
                    <Dash />
                );
            },
        }),
        helper.accessor('age', {
            header: 'Umur',
            meta: { align: 'right' },
            cell: (c) => `${c.getValue()} th`,
        }),
        helper.accessor('gender', {
            header: 'JK',
            meta: { align: 'right' },
        }),
        helper.accessor('status', {
            header: 'Status',
            cell: (c) => {
                const status = c.getValue();
                return (
                    <StatusText tone={STATUS_TONE[status] ?? 'neutral'}>
                        {STATUS_LABEL[status] ?? status}
                    </StatusText>
                );
            },
        }),
        helper.accessor('createdAt', {
            header: 'Masuk',
            meta: { align: 'right' },
            cell: (c) => (
                <span className="text-muted-foreground">
                    {formatDate(c.getValue())}
                </span>
            ),
        }),
        helper.display({
            id: 'actions',
            header: '',
            meta: { align: 'right' },
            cell: (c) => {
                const row = c.row.original;
                return (
                    <div
                        className="inline-flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                                if (onSelectRow) onSelectRow(row.id);
                                else setPreviewRow(row);
                            }}
                            className="h-7 px-2 text-[12px] text-[var(--accent)] hover:bg-[var(--active)] hover:text-[var(--accent)]"
                        >
                            Pratinjau
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label={`Aksi kasus ${row.reportNumber}`}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <MoreHorizontal
                                        className="size-3.5"
                                        aria-hidden
                                    />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                sideOffset={6}
                                className="w-48"
                            >
                                <DropdownMenuItem
                                    onSelect={() => {
                                        if (onSelectRow) onSelectRow(row.id);
                                        else setPreviewRow(row);
                                    }}
                                >
                                    <Eye className="size-3.5" aria-hidden />
                                    Pratinjau cepat (Drawer)
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onSelect={() =>
                                        router.push(`/laporan/${row.id}`)
                                    }
                                >
                                    <ExternalLink
                                        className="size-3.5"
                                        aria-hidden
                                    />
                                    Buka detail KDRS / PE
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onSelect={() =>
                                        router.push(
                                            `/pe/baru?reportId=${row.id}`,
                                        )
                                    }
                                >
                                    <FilePlus2
                                        className="size-3.5"
                                        aria-hidden
                                    />
                                    Form PE lapangan
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onSelect={() => {
                                        void navigator.clipboard
                                            ?.writeText(row.reportNumber)
                                            .then(() =>
                                                toast.success(
                                                    `${row.reportNumber} disalin`,
                                                ),
                                            );
                                    }}
                                >
                                    <ClipboardCopy
                                        className="size-3.5"
                                        aria-hidden
                                    />
                                    Salin no. laporan
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            },
        }),
    ]);

    const router = useRouter();
    const table = useTable({
        features,
        columns,
        data: filteredRows,
        getRowId: (row) => row.id,
    });

    if (rows.length === 0) {
        return <Empty>{empty}</Empty>;
    }

    const headerGroups = table.getHeaderGroups();
    const sortKey =
        headerGroups[0]?.headers
            .map((h) => `${h.id}:${String(h.column.getIsSorted())}`)
            .join('|') ?? '';
    const tbodyKey = `${stage}|${sortKey}`;
    const visibleRows = table.getRowModel().rows;

    return (
        <div>
            {showStatusTabs ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
                    <div
                        role="tablist"
                        aria-label="Filter tahap status kasus"
                        className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--ground)] p-0.5"
                    >
                        {STAGE_TABS.map((tab, idx) => {
                            const isActive = stage === tab.key;
                            const count = stageCounts[tab.key];
                            return (
                                <button
                                    key={tab.key}
                                    ref={(node) => {
                                        tabRefs.current[idx] = node;
                                    }}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    tabIndex={isActive ? 0 : -1}
                                    onClick={() => selectStage(tab.key)}
                                    onKeyDown={(e) => handleTabKeyDown(e, idx)}
                                    className={cn(
                                        'relative inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] font-medium whitespace-nowrap transition-[color,transform] duration-150 ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:outline-none active:scale-[0.97]',
                                        isActive
                                            ? 'text-foreground'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {isActive ? (
                                        <motion.span
                                            layoutId={pillId}
                                            aria-hidden
                                            transition={
                                                reduce
                                                    ? { duration: 0 }
                                                    : {
                                                          duration: 0.2,
                                                          ease: EASE_OUT,
                                                      }
                                            }
                                            className="absolute inset-0 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgb(9_9_11/0.06)]"
                                        />
                                    ) : null}
                                    <span className="relative z-10">
                                        {tab.label}
                                    </span>
                                    <span
                                        className={cn(
                                            'relative z-10 font-mono text-[11px] tabular-nums',
                                            isActive
                                                ? 'text-[var(--accent)]'
                                                : 'text-muted-foreground/75',
                                        )}
                                    >
                                        {formatNumber(count)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <span className="font-mono text-[11.5px] text-muted-foreground tabular-nums">
                        {formatNumber(visibleRows.length)} dari{' '}
                        {formatNumber(rows.length)} baris
                    </span>
                </div>
            ) : null}

            {visibleRows.length === 0 ? (
                <motion.div
                    key={`empty-${stage}`}
                    initial={
                        reduce ? { opacity: 0 } : { opacity: 0, scale: 0.985 }
                    }
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                        duration: reduce ? 0.1 : 0.16,
                        ease: EASE_OUT,
                    }}
                    className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center"
                >
                    <p className="text-[13px] text-muted-foreground">
                        Tidak ada kasus pada tahap{' '}
                        <span className="font-medium text-foreground">
                            {STAGE_TABS.find((t) => t.key === stage)?.label}
                        </span>{' '}
                        di halaman ini.
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => selectStage('all')}
                    >
                        Tampilkan semua
                    </Button>
                </motion.div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="ledger min-w-[760px]">
                        <thead>
                            {headerGroups.map((group) => (
                                <tr key={group.id}>
                                    {group.headers.map((header) => {
                                        const sort =
                                            header.column.getIsSorted();
                                        const right =
                                            header.column.columnDef.meta
                                                ?.align === 'right';
                                        const toggleSort =
                                            header.column.getToggleSortingHandler();

                                        return (
                                            <th
                                                key={header.id}
                                                scope="col"
                                                aria-sort={ariaSort(sort)}
                                                className={
                                                    right
                                                        ? 'text-right'
                                                        : undefined
                                                }
                                            >
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        setHasInteracted(true);
                                                        toggleSort?.(e);
                                                    }}
                                                    className={cn(
                                                        'inline-flex cursor-pointer items-center gap-1 rounded-[4px] py-1 transition-[color,transform] duration-150 ease-[var(--ease-out)] hover:text-foreground active:scale-[0.97]',
                                                        right &&
                                                            'flex-row-reverse',
                                                    )}
                                                >
                                                    <FlexRender
                                                        header={header}
                                                    />
                                                    <SortMark state={sort} />
                                                </button>
                                            </th>
                                        );
                                    })}
                                </tr>
                            ))}
                        </thead>
                        <motion.tbody
                            key={tbodyKey}
                            initial={
                                hasInteracted
                                    ? {
                                          opacity: reduce ? 0.7 : 0.45,
                                          y: reduce ? 0 : 3,
                                      }
                                    : false
                            }
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: reduce ? 0.1 : 0.16,
                                ease: EASE_OUT,
                            }}
                        >
                            {visibleRows.map((row) => {
                                const isSelected =
                                    selectedId === row.original.id;
                                return (
                                    <tr
                                        key={row.id}
                                        onClick={(e) => {
                                            if (
                                                (
                                                    e.target as HTMLElement
                                                ).closest('a, button')
                                            )
                                                return;
                                            if (onSelectRow) {
                                                onSelectRow(row.original.id);
                                            } else {
                                                router.push(
                                                    `/laporan/${row.original.id}`,
                                                );
                                            }
                                        }}
                                        className={cn(
                                            'group cursor-pointer transition-colors duration-150 hover:bg-[var(--raised)]/70',
                                            isSelected
                                                ? 'bg-[var(--active)] font-medium shadow-xs'
                                                : undefined,
                                        )}
                                    >
                                        {row.getAllCells().map((cell) => (
                                            <td
                                                key={cell.id}
                                                className={
                                                    cell.column.columnDef.meta
                                                        ?.align === 'right'
                                                        ? 'num'
                                                        : undefined
                                                }
                                            >
                                                <FlexRender cell={cell} />
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </motion.tbody>
                    </table>
                </div>
            )}

            {/* Draggable spring-physics KDRS/PE quick-detail drawer */}
            <SpringSheet
                open={previewRow !== null}
                onOpenChange={(open) => {
                    if (!open) setPreviewRow(null);
                }}
                title={
                    previewRow
                        ? `Kasus ${previewRow.reportNumber}`
                        : 'Detail Kasus'
                }
                description={
                    previewRow
                        ? `${CASE_TYPE_LABEL[previewRow.caseType] ?? previewRow.caseType} · Geser ke bawah untuk menutup`
                        : undefined
                }
            >
                {previewRow ? (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--ground)] px-3.5 py-2.5">
                            <span className="text-[12px] text-muted-foreground">
                                Tahap &amp; Status Triage
                            </span>
                            <StatusText
                                tone={
                                    STATUS_TONE[previewRow.status] ?? 'neutral'
                                }
                            >
                                {STATUS_LABEL[previewRow.status] ??
                                    previewRow.status}
                            </StatusText>
                        </div>

                        <dl className="grid grid-cols-2 gap-3 text-[12.5px] sm:grid-cols-3">
                            <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3">
                                <dt className="text-[11px] text-muted-foreground">
                                    Sumber Laporan
                                </dt>
                                <dd className="mt-1 font-medium text-foreground">
                                    {previewRow.sourceType ===
                                        'PUSKESMAS_POLI' ||
                                    previewRow.sourceType === 'PUSKESMAS'
                                        ? 'Puskesmas'
                                        : 'Rumah Sakit'}
                                </dd>
                            </div>
                            <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3">
                                <dt className="text-[11px] text-muted-foreground">
                                    Pasien
                                </dt>
                                <dd className="mt-1 font-mono font-medium text-foreground tabular-nums">
                                    {previewRow.age} th · {previewRow.gender}
                                </dd>
                            </div>
                            <div className="col-span-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3 sm:col-span-1">
                                <dt className="text-[11px] text-muted-foreground">
                                    Tanggal Masuk
                                </dt>
                                <dd className="mt-1 font-mono font-medium text-foreground tabular-nums">
                                    {formatDate(previewRow.createdAt)}
                                </dd>
                            </div>
                            <div className="col-span-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-3 sm:col-span-3">
                                <dt className="text-[11px] text-muted-foreground">
                                    Wilayah Domisili
                                </dt>
                                <dd className="mt-1 font-medium text-foreground">
                                    {[
                                        previewRow.kelurahan,
                                        previewRow.kecamatan,
                                    ]
                                        .filter(Boolean)
                                        .join(', ') || 'Belum terpetakan'}
                                </dd>
                            </div>
                        </dl>

                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPreviewRow(null)}
                            >
                                Tutup
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                                <Link
                                    href={`/pe/baru?reportId=${previewRow.id}`}
                                >
                                    <FilePlus2
                                        className="size-3.5"
                                        aria-hidden
                                    />
                                    Form PE
                                </Link>
                            </Button>
                            <Button size="sm" asChild>
                                <Link href={`/laporan/${previewRow.id}`}>
                                    <ExternalLink
                                        className="size-3.5"
                                        aria-hidden
                                    />
                                    Buka detail KDRS / PE
                                </Link>
                            </Button>
                        </div>
                    </div>
                ) : null}
            </SpringSheet>
        </div>
    );
}

function ariaSort(state: false | 'asc' | 'desc') {
    if (state === 'asc') return 'ascending' as const;
    if (state === 'desc') return 'descending' as const;
    return 'none' as const;
}

function SortMark({ state }: { state: false | 'asc' | 'desc' }) {
    if (state === 'asc') {
        return <ArrowUp className="size-3 text-[var(--accent)]" aria-hidden />;
    }
    if (state === 'desc') {
        return (
            <ArrowDown className="size-3 text-[var(--accent)]" aria-hidden />
        );
    }
    return <ArrowUpDown className="size-3 opacity-40" aria-hidden />;
}
