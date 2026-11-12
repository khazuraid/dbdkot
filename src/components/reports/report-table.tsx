'use client';

import Link from 'next/link';
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
    CASE_TYPE_LABEL,
    STATUS_LABEL,
    type ReportListRow,
} from '@/lib/domain/report-labels';
import { formatDate } from '@/lib/format';

/**
 * Alignment is carried on the column, not on each `cell` render, so the header
 * and its body cells can never disagree about which side the numbers sit on.
 */
// The type parameters must match the interface being merged, though only its
// members are ever read here.
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
 * One report table for every screen that lists reports. Rules and alignment:
 * hairline rows, no zebra, numbers right, tabular figures — the operator scans
 * a column of digits, and proportional numerals make that slower.
 *
 * Sorting is the reason this is a client component: it is a view concern, so
 * it reorders the rows already on screen rather than re-querying. The page
 * stays server-paginated, which is what keeps a page a URL.
 */
export function ReportTable({
    rows,
    empty,
}: {
    rows: ReportListRow[];
    empty: string;
}) {
    const columns = helper.columns([
        helper.accessor('reportNumber', {
            header: 'No. laporan',
            cell: (c) => (
                <Link href={`/laporan/${c.row.original.id}`} className="underline">
                    {c.getValue()}
                </Link>
            ),
        }),
        helper.accessor('caseType', {
            header: 'Kasus',
            cell: (c) => CASE_TYPE_LABEL[c.getValue()] ?? c.getValue(),
        }),
        helper.accessor((r) => r.kelurahan ?? r.kecamatan ?? '', {
            id: 'wilayah',
            header: 'Wilayah',
            cell: (c) => {
                const { kelurahan, kecamatan } = c.row.original;
                return (
                    <span className="text-muted-foreground">
                        {[kelurahan, kecamatan].filter(Boolean).join(', ') ||
                            '—'}
                    </span>
                );
            },
        }),
        helper.accessor('age', {
            header: 'Umur',
            meta: { align: 'right' },
        }),
        helper.accessor('gender', {
            header: 'JK',
            meta: { align: 'right' },
        }),
        helper.accessor('status', {
            header: 'Status',
            cell: (c) => STATUS_LABEL[c.getValue()],
        }),
        helper.accessor('createdAt', {
            header: 'Masuk',
            meta: { align: 'right' },
            // `Date` objects sort by value; the formatted string would sort
            // alphabetically, which on `id-ID` is neither chronological nor
            // stable across locales.
            cell: (c) => (
                <span className="text-muted-foreground">
                    {formatDate(c.getValue())}
                </span>
            ),
        }),
    ]);

    // Column defs are rebuilt when `rows` changes, which invalidates the row
    // models; passing a fresh `[]` for empty rows would do the same on every
    // render, so the response is used as-is.
    const table = useTable({ features, columns, data: rows });

    return (
        <table className="w-full border-collapse text-[14px]">
            <thead>
                {table.getHeaderGroups().map((group) => (
                    <tr
                        key={group.id}
                        className="border-y border-border text-left text-[12px] text-muted-foreground"
                    >
                        {group.headers.map((header) => {
                            const sort = header.column.getIsSorted();
                            const align =
                                header.column.columnDef.meta?.align ===
                                'right'
                                    ? 'text-right'
                                    : undefined;

                            return (
                                <th
                                    key={header.id}
                                    scope="col"
                                    aria-sort={ariaSort(sort)}
                                    className={`py-2 font-normal ${align ?? ''}`}
                                >
                                    <button
                                        type="button"
                                        onClick={header.column.getToggleSortingHandler()}
                                        className="inline-flex items-center gap-1"
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
            <tbody className="divide-y divide-border">
                {table.getRowModel().rows.map((row) => (
                    <tr
                        key={row.id}
                        className="h-[var(--row-height)] hover:bg-[var(--raised)]"
                    >
                        {row.getAllCells().map((cell) => (
                            <td
                                key={cell.id}
                                data-numeric={
                                    cell.column.columnDef.meta?.align ===
                                    'right'
                                        ? true
                                        : undefined
                                }
                                className={`py-2 ${
                                    cell.column.columnDef.meta?.align ===
                                    'right'
                                        ? 'text-right'
                                        : ''
                                }`}
                            >
                                <FlexRender
                                    cell={cell}
                                />
                            </td>
                        ))}
                    </tr>
                ))}
                {rows.length === 0 && (
                    <tr>
                        <td
                            colSpan={columns.length}
                            className="py-10 text-center text-muted-foreground"
                        >
                            {empty}
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    );
}

/** The one place a sort is not inherited from the caller. */
function ariaSort(state: false | 'asc' | 'desc') {
    if (state === 'asc') return 'ascending' as const;
    if (state === 'desc') return 'descending' as const;
    return 'none' as const;
}

function SortMark({ state }: { state: false | 'asc' | 'desc' }) {
    if (!state) return null;
    return (
        <span aria-hidden className="text-[10px]">
            {state === 'asc' ? '▲' : '▼'}
        </span>
    );
}
