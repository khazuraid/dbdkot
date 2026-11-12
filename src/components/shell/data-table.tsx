import { Empty } from './page';

export type Column<T> = {
    key: string;
    header: React.ReactNode;
    /** Numbers, dates and counts right-align so the digits line up. */
    align?: 'right';
    className?: string;
    cell: (row: T) => React.ReactNode;
};

/**
 * One table for every read-only list. Before this, nine pages carried a copy of
 * the same <table> with the same thead classes, and the copies had already
 * drifted apart (two had a status column the others lost).
 *
 * Rules from the app-screens study: no zebra, no header band, numbers right,
 * hairline rows only. On a phone the table scrolls inside its own frame rather
 * than pushing the page sideways.
 */
export function DataTable<T extends { id: string }>({
    rows,
    columns,
    empty,
    caption,
}: {
    rows: T[];
    columns: Column<T>[];
    empty: React.ReactNode;
    caption?: string;
}) {
    if (rows.length === 0) return <Empty>{empty}</Empty>;

    return (
        <div className="-mx-4 overflow-x-auto md:mx-0">
            <table className="w-full min-w-[560px] border-collapse text-[14px] md:min-w-0">
                {caption && <caption className="sr-only">{caption}</caption>}
                <thead>
                    <tr className="border-b border-border text-[12px] text-muted-foreground">
                        {columns.map((c) => (
                            <th
                                key={c.key}
                                scope="col"
                                className={[
                                    'whitespace-nowrap px-3 py-2 font-normal first:pl-0 last:pr-0',
                                    c.align === 'right' ? 'text-right' : 'text-left',
                                ].join(' ')}
                            >
                                {c.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr
                            key={row.id}
                            className="h-[var(--row-height)] border-b border-[var(--rule)] transition-colors last:border-0 hover:bg-[var(--raised)]"
                        >
                            {columns.map((c) => (
                                <td
                                    key={c.key}
                                    className={[
                                        'px-3 py-2 align-middle first:pl-0 last:pr-0',
                                        c.align === 'right'
                                            ? 'text-right tabular-nums'
                                            : '',
                                        c.className ?? '',
                                    ].join(' ')}
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

/** A missing value is a grey dash, never an empty cell or a "0". */
export function Dash() {
    return (
        <span className="text-[var(--faint)]" aria-label="tidak ada data">
            —
        </span>
    );
}
