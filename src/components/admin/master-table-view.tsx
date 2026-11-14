import Link from 'next/link';
import { FolderOpen, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Row = { id: string } & Record<string, unknown>;

export type TableColumn<T> = {
    key: string;
    header: string;
    align?: 'right';
    className?: string;
    /** Already-rendered text or markup. This is a server component, so a
     *  page can compute it here directly instead of passing a function
     *  across the server → client boundary (which React refuses). */
    cell: (row: T) => React.ReactNode;
};

/**
 * The ledger half of a master-data screen. Only the form needs React state,
 * so only the form is a client component (`MasterTable`); the rows and their
 * open/edit links are rendered here, on the server, from plain data.
 *
 * Open/edit/delete are links and query strings, not callbacks: `?tambah=1`
 * opens a blank form, `?ubah=<id>` opens that row, `?hapus=<id>` asks for the
 * confirmation. The URL is the state, so a dialog survives a refresh and can
 * be linked to.
 */
export function MasterTableView<T extends Row>({
    singular,
    pathname,
    rows,
    columns,
    empty,
}: {
    singular: string;
    pathname: string;
    rows: T[];
    columns: TableColumn<T>[];
    empty: React.ReactNode;
}) {
    if (rows.length === 0) {
        return (
            <div className="flex flex-col items-center px-4 py-12 text-center">
                <span
                    aria-hidden
                    className="grid size-10 place-items-center rounded-[10px] border border-[var(--border)] bg-[var(--raised)] text-muted-foreground"
                >
                    <FolderOpen className="size-4" strokeWidth={1.75} />
                </span>
                <p className="mx-auto mt-3 max-w-[46ch] text-[13px] text-muted-foreground">
                    {empty}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-4">
                    <Link href={`${pathname}?tambah=1`} scroll={false}>
                        <PlusIcon /> Tambah {singular.toLowerCase()}
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="ledger min-w-[720px]">
                <thead>
                    <tr>
                        {columns.map((c) => (
                            <th
                                key={c.key}
                                scope="col"
                                className={
                                    c.align === 'right'
                                        ? 'text-right'
                                        : undefined
                                }
                            >
                                {c.header}
                            </th>
                        ))}
                        <th scope="col" className="text-right">
                            Aksi
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.id} data-row>
                            {columns.map((c) => (
                                <td
                                    key={c.key}
                                    className={
                                        c.align === 'right'
                                            ? 'num'
                                            : c.className
                                    }
                                >
                                    {c.cell(row)}
                                </td>
                            ))}
                            <td>
                                <div className="flex justify-end gap-1">
                                    <Button
                                        asChild
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-muted-foreground hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                                    >
                                        <Link
                                            href={`${pathname}?ubah=${row.id}`}
                                            scroll={false}
                                            title={`Ubah ${String(row.name ?? row.id)}`}
                                            aria-label={`Ubah ${String(row.name ?? row.id)}`}
                                        >
                                            <PencilIcon className="size-3.5" />
                                        </Link>
                                    </Button>
                                    <Button
                                        asChild
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-muted-foreground hover:bg-[var(--pill-negative-bg)] hover:text-[var(--negative)]"
                                    >
                                        <Link
                                            href={`${pathname}?hapus=${row.id}`}
                                            scroll={false}
                                            title={`Hapus ${String(row.name ?? row.id)}`}
                                            aria-label={`Hapus ${String(row.name ?? row.id)}`}
                                        >
                                            <Trash2Icon className="size-3.5" />
                                        </Link>
                                    </Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
