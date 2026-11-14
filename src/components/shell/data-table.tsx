import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Empty } from './page';

export type Column<T> = {
    key: string;
    header: ReactNode;
    cell: (row: T) => ReactNode;
    align?: 'right';
    className?: string;
};

/** A dash for "no value", in the faint tone so it never reads as data. */
export function Dash() {
    return (
        <span aria-label="tidak ada data" className="text-faint">
            -
        </span>
    );
}

/**
 * Shared ledger table for all operational list views.
 */
export function DataTable<T extends { id: string }>({
    rows,
    columns,
    empty,
    caption,
    minWidth = 720,
    rowClassName,
    maxHeight,
    className,
}: {
    rows: T[];
    columns: Column<T>[];
    empty: ReactNode;
    caption?: string;
    minWidth?: number;
    rowClassName?: (row: T) => string | undefined;
    maxHeight?: string | number;
    className?: string;
}) {
    if (rows.length === 0) return <Empty>{empty}</Empty>;

    return (
        <div
            className={cn(
                'relative w-full overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-xs',
                maxHeight && 'overflow-y-auto',
                className,
            )}
            style={maxHeight ? { maxHeight } : undefined}
        >
            <table
                className="ledger w-full caption-bottom text-sm"
                style={{ minWidth: `${minWidth}px` }}
            >
                {caption && <caption className="sr-only">{caption}</caption>}
                <thead className="sticky top-0 z-20 bg-[var(--surface)] shadow-[0_1px_0_0_var(--border)]">
                    <tr className="border-b border-[var(--border)] bg-[var(--raised)]/95 hover:bg-[var(--raised)]/95 backdrop-blur-xs">
                        {columns.map((c) => (
                            <th
                                key={c.key}
                                scope="col"
                                className={cn(
                                    'h-10 px-3.5 py-2 text-left text-[11px] font-bold tracking-wider text-muted-foreground uppercase bg-inherit select-none',
                                    c.align === 'right' && 'text-right',
                                    c.className,
                                )}
                            >
                                {c.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rule)]">
                    {rows.map((row) => (
                        <tr
                            key={row.id}
                            className={cn(
                                'border-b border-[var(--rule)] transition-colors hover:bg-[var(--raised)]/40',
                                rowClassName?.(row),
                            )}
                        >
                            {columns.map((c) => (
                                <td
                                    key={c.key}
                                    className={cn(
                                        'px-3.5 py-2.5 align-middle text-sm',
                                        c.align === 'right' && 'text-right num',
                                        c.className,
                                    )}
                                >
                                    {c.cell(row)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
