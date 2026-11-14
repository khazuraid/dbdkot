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
}: {
    rows: T[];
    columns: Column<T>[];
    empty: ReactNode;
    caption?: string;
    minWidth?: number;
    rowClassName?: (row: T) => string | undefined;
}) {
    if (rows.length === 0) return <Empty>{empty}</Empty>;

    return (
        <div className="w-full overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-xs">
            <Table
                className="ledger caption-bottom"
                style={{ minWidth: `${minWidth}px` }}
            >
                {caption && <caption className="sr-only">{caption}</caption>}
                <TableHeader>
                    <TableRow className="border-b border-[var(--border)] bg-[var(--raised)]/60 hover:bg-[var(--raised)]/60">
                        {columns.map((c) => (
                            <TableHead
                                key={c.key}
                                scope="col"
                                className={cn(
                                    'h-9 font-semibold text-muted-foreground',
                                    c.align === 'right' && 'text-right',
                                    c.className,
                                )}
                            >
                                {c.header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow
                            key={row.id}
                            className={cn(
                                'border-b border-[var(--rule)] transition-colors hover:bg-[var(--raised)]/40',
                                rowClassName?.(row),
                            )}
                        >
                            {columns.map((c) => (
                                <TableCell
                                    key={c.key}
                                    className={cn(
                                        'py-2.5',
                                        c.align === 'right' && 'num',
                                        c.className,
                                    )}
                                >
                                    {c.cell(row)}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
