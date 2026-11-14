'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react';
import { Dash } from '@/components/shell/data-table';
import { Empty } from '@/components/shell/page';
import { StatusText } from '@/components/shell/status-text';
import {
    CASE_TYPE_LABEL,
    STATUS_LABEL,
    STATUS_TONE,
    type ReportListRow,
} from '@/lib/domain/report-labels';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

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
}: {
    rows: ReportListRow[];
    empty: string;
    onSelectRow?: (id: string) => void;
    selectedId?: string;
}) {
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
                const isPuskesmas = src === 'PUSKESMAS_POLI' || src === 'PUSKESMAS';
                return (
                    <span
                        className={cn(
                            'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium tracking-tight',
                            isPuskesmas
                                ? 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/20 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-500/30'
                                : 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-500/30',
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
                const place = [kelurahan, kecamatan]
                    .filter(Boolean)
                    .join(', ');
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
            cell: (c) => (
                <Link
                    href={`/laporan/${c.row.original.id}`}
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                >
                    <span>Detail</span>
                    <ChevronRight className="size-3.5" aria-hidden />
                </Link>
            ),
        }),
    ]);

    const router = useRouter();
    const table = useTable({ features, columns, data: rows });

    if (rows.length === 0) {
        return <Empty>{empty}</Empty>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="ledger min-w-[760px]">
                <thead>
                    {table.getHeaderGroups().map((group) => (
                        <tr key={group.id}>
                            {group.headers.map((header) => {
                                const sort = header.column.getIsSorted();
                                const right =
                                    header.column.columnDef.meta?.align ===
                                    'right';

                                return (
                                    <th
                                        key={header.id}
                                        scope="col"
                                        aria-sort={ariaSort(sort)}
                                        className={
                                            right ? 'text-right' : undefined
                                        }
                                    >
                                        <button
                                            type="button"
                                            onClick={header.column.getToggleSortingHandler()}
                                            className={cn(
                                                'inline-flex items-center gap-1 rounded-[4px] py-1 transition-colors hover:text-foreground',
                                                right && 'flex-row-reverse',
                                            )}
                                        >
                                            <FlexRender header={header} />
                                            <SortMark state={sort} />
                                        </button>
                                    </th>
                                );
                            })}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {table.getRowModel().rows.map((row) => {
                        const isSelected = selectedId === row.original.id;
                        return (
                            <tr
                                key={row.id}
                                onClick={(e) => {
                                    if ((e.target as HTMLElement).closest('a, button')) return;
                                    if (onSelectRow) {
                                        onSelectRow(row.original.id);
                                    } else {
                                        router.push(`/laporan/${row.original.id}`);
                                    }
                                }}
                                className={cn(
                                    'group cursor-pointer transition-colors hover:bg-[var(--raised)]/70',
                                    isSelected
                                        ? 'bg-[var(--active)] font-medium shadow-xs'
                                        : undefined,
                                )}
                            >
                                {row.getAllCells().map((cell) => (
                                    <td
                                        key={cell.id}
                                        className={
                                            cell.column.columnDef.meta?.align ===
                                            'right'
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
                </tbody>
            </table>
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
        return (
            <ArrowUp
                className="size-3 text-[var(--accent)]"
                aria-hidden
            />
        );
    }
    if (state === 'desc') {
        return (
            <ArrowDown
                className="size-3 text-[var(--accent)]"
                aria-hidden
            />
        );
    }
    return <ArrowUpDown className="size-3 opacity-40" aria-hidden />;
}
