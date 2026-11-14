'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
    AlertTriangle,
    Check,
    Loader2,
    MapPin,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    parseBoundaryGeoJson,
    type BoundaryGeoJson,
} from '@/lib/geo/boundary-schema';
import type { BoundaryCandidate } from '@/lib/geo/boundary';
import { BoundaryPreview } from '@/components/admin/kelurahan-zone-panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { fieldProps } from '@/components/shell/form-field';
import { useActionSettled } from '@/components/shell/use-action-settled';
import { cn } from '@/lib/utils';

export type FormState = {
    ok: boolean;
    error?: string;
    fields?: Record<string, string>;
};

type Value =
    | string
    | number
    | boolean
    | string[]
    | BoundaryGeoJson
    | null
    | undefined;

export type FieldSpec = {
    /** A disabled control that still submits, for a locked identity field. */
    disabled?: boolean;
    name: string;
    label: string;
    kind:
        | 'text'
        | 'textarea'
        | 'number'
        | 'select'
        | 'checkbox'
        | 'list'
        | 'boundary';
    required?: boolean;
    hint?: string;
    placeholder?: string;
    /** For `select` and selectable `list`. */
    options?: { value: string; label: string; hint?: string }[];
    /** Step for `number` inputs (e.g. `"any"` for coordinates). */
    step?: string;
    /** Full row span in the two-column grid, for a textarea or a long list. */
    wide?: boolean;
    /** Only render this field when another field matches `value`. */
    visibleWhen?: { field: string; value: string };
};

type Row = { id: string } & Record<string, Value>;

/**
 * The form half of a master-data screen, and only the form: rows, their
 * open/edit links and the empty state are server-rendered by
 * `MasterTableView`, because a ColumnSpec carries a render function and a
 * function cannot be passed from a server component to a client one.
 *
 * The write goes through the server action given by the page; this component
 * never decides permission. `useActionState` gives per-field errors back, and
 * after a successful write the route is refreshed so the ledger re-renders
 * from the database — the row you just saved appears because it exists, not
 * because it was appended locally.
 */
export function MasterTable<T extends Row>({
    singular,
    rows,
    fields,
    saveAction,
    deleteAction,
    editId,
    deleteId,
}: {
    singular: string;
    /** Only used to seed the edit form: the row being changed is in the URL. */
    rows: T[];
    fields: FieldSpec[];
    saveAction: (state: FormState, formData: FormData) => Promise<FormState>;
    deleteAction: (id: string) => Promise<FormState>;
    /** `?tambah=1` opens a blank form; `?ubah=<id>` opens that row. */
    editId?: string | null;
    /** `?hapus=<id>` asks to confirm a delete. */
    deleteId?: string | null;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deletePending, setDeletePending] = useState(false);

    function close() {
        router.push(pathname, { scroll: false });
    }

    const editing =
        editId && editId !== 'tambah'
            ? (rows.find((r) => r.id === editId) ?? null)
            : null;
    const open = editId === 'tambah' || Boolean(editing);
    const deleting = deleteId ? rows.find((r) => r.id === deleteId) : null;

    async function confirmDelete() {
        if (!deleting || deletePending) return;
        setDeletePending(true);
        const result = await deleteAction(deleting.id);
        setDeletePending(false);
        if (!result.ok) {
            setDeleteError(result.error ?? `${singular} gagal dihapus.`);
            return;
        }
        toast.success(`${singular} dihapus.`);
        close();
        router.refresh();
    }

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={(next) => {
                    if (!next) close();
                }}
            >
                {open && (
                    <MasterFormDialog
                        key={editing?.id ?? 'tambah'}
                        singular={singular}
                        editing={editing}
                        fields={fields}
                        saveAction={saveAction}
                        onClose={close}
                    />
                )}
            </Dialog>

            <AlertDialog
                open={Boolean(deleting)}
                onOpenChange={(next) => {
                    if (!next) {
                        setDeleteError(null);
                        close();
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogMedia className="bg-[var(--pill-negative-bg)] text-[var(--negative)]">
                            <AlertTriangle className="size-5" aria-hidden />
                        </AlertDialogMedia>
                        <AlertDialogTitle>
                            Hapus {singular.toLowerCase()}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleting && typeof deleting.name === 'string' && (
                                <>
                                    <span className="font-medium text-foreground">
                                        {deleting.name}
                                    </span>{' '}
                                    akan dihapus permanen.{' '}
                                </>
                            )}
                            Tindakan ini tidak bisa dibatalkan. Data yang masih
                            dipakai di laporan tidak akan bisa dihapus.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {deleteError && (
                        <p
                            role="alert"
                            className="rounded-[var(--radius-control)] bg-[var(--pill-negative-bg)] px-3 py-2 text-[12px] text-[var(--pill-negative-ink)]"
                        >
                            {deleteError}
                        </p>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletePending}>
                            Batal
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={deletePending}
                            onClick={(event) => {
                                // Keep the dialog open so a refused delete can
                                // explain itself in place.
                                event.preventDefault();
                                void confirmDelete();
                            }}
                        >
                            {deletePending ? 'Menghapus…' : 'Hapus'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

/**
 * Mounted only while the dialog is open and keyed by target id, so reopening
 * or switching rows always starts with clean `useActionState` (no stale errors).
 */
function initialValuesFor<T extends Row>(
    fields: FieldSpec[],
    editing: T | null,
): Record<string, Value> {
    const init: Record<string, Value> = {};
    for (const f of fields) {
        const raw = editing?.[f.name];
        if (f.kind === 'checkbox') {
            init[f.name] = raw !== false;
        } else if (f.kind === 'list') {
            init[f.name] = Array.isArray(raw) ? raw : [];
        } else if (f.kind === 'boundary') {
            init[f.name] = parseBoundaryGeoJson(raw);
        } else {
            init[f.name] = raw === null || raw === undefined ? '' : String(raw);
        }
    }
    return init;
}

function MasterFormDialog<T extends Row>({
    singular,
    editing,
    fields,
    saveAction,
    onClose,
}: {
    singular: string;
    editing: T | null;
    fields: FieldSpec[];
    saveAction: (state: FormState, formData: FormData) => Promise<FormState>;
    onClose: () => void;
}) {
    const router = useRouter();
    const [state, action, pending] = useActionState(saveAction, { ok: true });
    const seenSettle = useRef(false);
    // Keep every field controlled so React 19's automatic form reset after an
    // action never wipes what the operator typed when validation fails.
    const [values, setValues] = useState<Record<string, Value>>(() =>
        initialValuesFor(fields, editing),
    );

    useActionSettled(state, () => {
        if (seenSettle.current) return;
        seenSettle.current = true;
        onClose();
        toast.success(`${singular} tersimpan.`);
        router.refresh();
    });

    useEffect(() => {
        if (!state.ok && state.error) {
            toast.error(state.error);
        }
    }, [state]);

    const spanAll = (field: FieldSpec) =>
        Boolean(
            field.wide ||
                field.kind === 'textarea' ||
                field.kind === 'list' ||
                field.kind === 'boundary' ||
                field.kind === 'checkbox' ||
                (fields.length > 4 && field.name === 'name'),
        );

    const visibleFields = fields.filter((field) => {
        if (!field.visibleWhen) return true;
        return (
            String(values[field.visibleWhen.field] ?? '') ===
            field.visibleWhen.value
        );
    });

    return (
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[640px]">
            <DialogHeader className="border-b border-[var(--rule)] bg-[var(--raised)]/45 px-5 py-4 pr-12">
                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            'inline-flex items-center rounded-[var(--radius-pill)] border px-2 py-0.5 text-[11px] font-medium',
                            editing
                                ? 'border-[var(--pill-info-border)] bg-[var(--pill-info-bg)] text-[var(--pill-info-ink)]'
                                : 'border-[var(--border)] bg-[var(--accent-soft)] text-[var(--accent)]',
                        )}
                    >
                        {editing ? 'Sunting data' : 'Entri baru'}
                    </span>
                </div>
                <DialogTitle className="text-[16px] font-semibold tracking-[-0.01em]">
                    {editing
                        ? `Ubah ${singular.toLowerCase()}`
                        : `Tambah ${singular.toLowerCase()}`}
                </DialogTitle>
                <DialogDescription className="text-[12.5px]">
                    {editing
                        ? 'Perubahan langsung berlaku setelah disimpan ke register.'
                        : 'Lengkapi kolom wajib bertanda bintang sebelum menyimpan.'}
                </DialogDescription>
            </DialogHeader>

            <form action={action} className="flex min-h-0 flex-col">
                {editing && (
                    <input type="hidden" name="id" value={editing.id} />
                )}

                <div className="grid max-h-[min(66dvh,540px)] grid-cols-1 gap-x-4 gap-y-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
                    {visibleFields.map((field) => {
                        const id = `f-${field.name}`;
                        const error = state.fields?.[field.name];
                        const value = values[field.name];
                        return (
                            <ModalField
                                key={field.name}
                                id={id}
                                label={field.label}
                                hint={field.hint}
                                error={error}
                                required={field.required}
                                className={
                                    spanAll(field) ? 'sm:col-span-2' : undefined
                                }
                            >
                                <FieldControl
                                    field={field}
                                    id={id}
                                    error={error}
                                    value={value}
                                    allValues={values}
                                    onChange={(next) =>
                                        setValues((prev) => ({
                                            ...prev,
                                            [field.name]: next,
                                        }))
                                    }
                                />
                            </ModalField>
                        );
                    })}

                    {state.error && (
                        <p
                            role="alert"
                            className="rounded-[var(--radius-control)] border border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] px-3 py-2 text-[12px] text-[var(--pill-negative-ink)] sm:col-span-2"
                        >
                            {state.error}
                        </p>
                    )}
                </div>

                <DialogFooter className="mx-0 mb-0 rounded-b-[var(--radius-card)] border-t border-[var(--rule)] bg-[var(--raised)]/65 px-5 py-3.5">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Batal
                    </Button>
                    <Button type="submit" disabled={pending}>
                        {pending ? 'Menyimpan…' : 'Simpan'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
}

function ModalField({
    id,
    label,
    hint,
    error,
    required,
    className,
    children,
}: {
    id: string;
    label: string;
    hint?: string;
    error?: string;
    required?: boolean;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={cn('min-w-0 space-y-1.5', className)}>
            <Label
                htmlFor={id}
                className="flex items-center gap-1 text-[12.5px] font-medium text-foreground"
            >
                {label}
                {required && (
                    <span aria-hidden className="text-[var(--negative)]">
                        *
                    </span>
                )}
            </Label>
            {children}
            {hint && !error && (
                <p id={`${id}-hint`} className="text-[11.5px] text-faint">
                    {hint}
                </p>
            )}
            {error && (
                <p
                    id={`${id}-error`}
                    role="alert"
                    className="text-[12px] font-medium text-[var(--negative)]"
                >
                    {error}
                </p>
            )}
        </div>
    );
}

/** Renders the control for one field; controlled so a failed submit keeps user input. */
function FieldControl({
    field,
    id,
    error,
    value,
    allValues,
    onChange,
}: {
    field: FieldSpec;
    id: string;
    error?: string;
    value: Value;
    allValues: Record<string, Value>;
    onChange: (next: Value) => void;
}) {
    const base = fieldProps(id, error, field.hint);
    const strValue = value === null || value === undefined ? '' : String(value);

    if (field.kind === 'textarea') {
        return (
            <Textarea
                {...base}
                name={field.name}
                value={strValue}
                onChange={(e) => onChange(e.target.value)}
                placeholder={field.placeholder}
            />
        );
    }

    if (field.kind === 'list') {
        return <ListField field={field} id={id} error={error} initial={value} />;
    }

    if (field.kind === 'boundary') {
        return (
            <BoundaryField
                name={field.name}
                value={parseBoundaryGeoJson(value)}
                suggestedQuery={[
                    allValues.name,
                    allValues.kecamatan,
                    allValues.kota,
                ]
                    .filter((v) => typeof v === 'string' && v.trim().length > 0)
                    .join(', ')}
                onChange={onChange}
            />
        );
    }

    if (field.kind === 'select') {
        return (
            <Select
                name={field.name}
                value={strValue || undefined}
                required={field.required}
                onValueChange={onChange}
            >
                <SelectTrigger
                    {...base}
                    className="w-full"
                    aria-label={field.label}
                >
                    <SelectValue placeholder={field.placeholder ?? 'Pilih…'} />
                </SelectTrigger>
                <SelectContent>
                    {field.options?.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        );
    }

    if (field.kind === 'checkbox') {
        return (
            <label
                htmlFor={id}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/40 px-3.5 py-2.5 text-[13px] transition-colors hover:bg-[var(--raised)]/70"
            >
                <span className="font-medium text-foreground">
                    {field.placeholder ?? 'Aktif'}
                </span>
                {/* An unchecked checkbox sends nothing, and the parser reads a
                    missing value as "on" — so the row could never be turned
                    off. The hidden input goes FIRST: FormData keeps both, and
                    fromEntries takes the last one, so the checkbox's "on" wins
                    when it is checked and "off" stands when it is not. */}
                <input type="hidden" name={field.name} value="off" />
                <input
                    {...base}
                    type="checkbox"
                    name={field.name}
                    checked={Boolean(value)}
                    onChange={(e) => onChange(e.target.checked)}
                    className="size-4 rounded border-input accent-[var(--accent)]"
                />
            </label>
        );
    }

    return (
        <Input
            {...base}
            type={field.kind === 'number' ? 'number' : 'text'}
            step={field.step ?? (field.kind === 'number' ? 'any' : undefined)}
            name={field.name}
            value={strValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            disabled={field.disabled}
        />
    );
}

function ListField({
    field,
    id,
    error,
    initial,
}: {
    field: FieldSpec;
    id: string;
    error?: string;
    initial: Value;
}) {
    const initialList = Array.isArray(initial) ? initial : [];
    const [raw, setRaw] = useState(() => initialList.join(', '));
    const [selected, setSelected] = useState<string[]>(() => initialList);
    const [query, setQuery] = useState('');
    const base = fieldProps(id, error, field.hint);

    if (field.options !== undefined) {
        const options = field.options;
        const known = new Set(options.map((o) => o.value.toLowerCase()));
        const selectedKeys = new Set(selected.map((s) => s.toLowerCase()));
        const q = query.trim().toLowerCase();
        const filtered = q
            ? options.filter(
                  (o) =>
                      o.label.toLowerCase().includes(q) ||
                      (o.hint?.toLowerCase().includes(q) ?? false),
              )
            : options;

        const toggle = (value: string) => {
            const key = value.toLowerCase();
            setSelected((prev) =>
                prev.some((v) => v.toLowerCase() === key)
                    ? prev.filter((v) => v.toLowerCase() !== key)
                    : [...prev, value],
            );
        };

        return (
            <div className="space-y-2.5">
                <input
                    type="hidden"
                    name={field.name}
                    value={selected.join(', ')}
                />

                {selected.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--rule)] bg-[var(--raised)]/45 px-2.5 py-2">
                        <span className="mr-1 font-mono text-[11px] font-medium text-muted-foreground">
                            {selected.length} dipilih
                        </span>
                        {selected.map((item) => {
                            const inMaster = known.has(item.toLowerCase());
                            return (
                                <Badge
                                    key={item}
                                    variant={inMaster ? 'secondary' : 'outline'}
                                    className="gap-1 pr-1"
                                >
                                    <span>
                                        {item}
                                        {!inMaster && ' (belum di master)'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => toggle(item)}
                                        aria-label={`Hapus ${item}`}
                                        className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                                    >
                                        <X className="size-3" aria-hidden />
                                    </button>
                                </Badge>
                            );
                        })}
                        <button
                            type="button"
                            onClick={() => setSelected([])}
                            className="ml-auto text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
                        >
                            Kosongkan
                        </button>
                    </div>
                )}

                {options.length === 0 ? (
                    <p className="rounded-[var(--radius-control)] border border-[var(--pill-warning-border)] bg-[var(--pill-warning-bg)] px-3 py-2 text-[12px] text-[var(--pill-warning-ink)]">
                        Belum ada kelurahan terdaftar. Tambahkan data di menu
                        Kelurahan agar dapat dipilih di sini.
                    </p>
                ) : (
                    <div className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)]">
                        <div className="flex items-center gap-2 border-b border-[var(--rule)] bg-[var(--raised)]/40 px-2.5 py-1.5">
                            <Search
                                className="size-3.5 shrink-0 text-muted-foreground"
                                aria-hidden
                            />
                            <input
                                id={id}
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={
                                    field.placeholder ??
                                    'Cari kelurahan atau kecamatan…'
                                }
                                aria-describedby={base['aria-describedby']}
                                className="h-7 w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
                            />
                        </div>
                        <ul className="max-h-[176px] divide-y divide-[var(--rule)] overflow-y-auto">
                            {filtered.length === 0 ? (
                                <li className="px-3 py-3 text-center text-[12px] text-muted-foreground">
                                    Tidak ada kelurahan yang cocok dengan “
                                    {query}”.
                                </li>
                            ) : (
                                filtered.map((opt) => {
                                    const checked = selectedKeys.has(
                                        opt.value.toLowerCase(),
                                    );
                                    return (
                                        <li key={`${opt.value}-${opt.hint ?? ''}`}>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggle(opt.value)
                                                }
                                                aria-pressed={checked}
                                                className={cn(
                                                    'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] transition-colors',
                                                    checked
                                                        ? 'bg-[var(--accent-soft)]/65 text-foreground'
                                                        : 'hover:bg-[var(--raised)]/60',
                                                )}
                                            >
                                                <span className="min-w-0">
                                                    <span className="block truncate font-medium">
                                                        {opt.label}
                                                    </span>
                                                    {opt.hint && (
                                                        <span className="block truncate text-[11.5px] text-muted-foreground">
                                                            {opt.hint}
                                                        </span>
                                                    )}
                                                </span>
                                                <span
                                                    aria-hidden
                                                    className={cn(
                                                        'grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors',
                                                        checked
                                                            ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
                                                            : 'border-[var(--border)] bg-[var(--surface)]',
                                                    )}
                                                >
                                                    {checked && (
                                                        <Check className="size-3" />
                                                    )}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })
                            )}
                        </ul>
                    </div>
                )}
            </div>
        );
    }

    const parsed = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    return (
        <div className="space-y-2">
            <Input
                {...base}
                name={field.name}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={field.placeholder}
            />
            {parsed.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--rule)] bg-[var(--raised)]/40 px-2.5 py-2">
                    <span className="mr-1 font-mono text-[11px] font-medium text-muted-foreground">
                        {parsed.length} wilayah
                    </span>
                    {parsed.slice(0, 12).map((k, idx) => (
                        <Badge key={`${k}-${idx}`} variant="secondary">
                            {k}
                        </Badge>
                    ))}
                    {parsed.length > 12 && (
                        <Badge variant="outline">+{parsed.length - 12}</Badge>
                    )}
                </div>
            )}
        </div>
    );
}

function BoundaryField({
    name,
    value,
    suggestedQuery,
    onChange,
}: {
    name: string;
    value: BoundaryGeoJson | null;
    suggestedQuery: string;
    onChange: (next: BoundaryGeoJson | null) => void;
}) {
    const [query, setQuery] = useState(suggestedQuery);
    const [loading, setLoading] = useState(false);
    const [candidates, setCandidates] = useState<BoundaryCandidate[]>([]);
    const [error, setError] = useState<string | null>(null);

    async function lookup() {
        const q = (query.trim() || suggestedQuery).trim();
        if (q.length < 2) {
            setError('Isi nama kelurahan atau kata kunci kota lebih dulu.');
            return;
        }
        setQuery(q);
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/geo/boundary?q=${encodeURIComponent(q)}`,
            );
            const data = (await res.json()) as {
                candidates?: BoundaryCandidate[];
                error?: string;
            };
            if (!res.ok) {
                setError(data.error ?? 'Gagal mencari batas wilayah.');
                return;
            }
            const list = data.candidates ?? [];
            setCandidates(list);
            if (list.length === 0) {
                setError(
                    'Poligon batas wilayah belum ditemukan di OpenStreetMap. Coba sertakan nama kota.',
                );
                return;
            }
            onChange(list[0].geojson);
        } catch {
            setError('Gagal menghubungi server pencarian peta.');
        } finally {
            setLoading(false);
        }
    }

    const serialized = value ? JSON.stringify(value) : '';

    return (
        <div className="space-y-2.5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]/35 p-3">
            <input type="hidden" name={name} value={serialized} />

            <div className="flex flex-wrap items-center gap-2">
                <Input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={suggestedQuery || 'Kesambi, Kota Cirebon'}
                    className="min-w-[180px] flex-1 bg-[var(--surface)]"
                    aria-label="Kata kunci batas wilayah"
                />
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={lookup}
                >
                    {loading ? (
                        <>
                            <Loader2
                                className="size-3.5 animate-spin"
                                aria-hidden
                            />
                            Mencari…
                        </>
                    ) : (
                        <>
                            <Search className="size-3.5" aria-hidden />
                            Cari zonasi
                        </>
                    )}
                </Button>
                {value && (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                            onChange(null);
                            setCandidates([]);
                        }}
                        className="text-muted-foreground hover:text-[var(--negative)]"
                    >
                        <Trash2 className="size-3.5" aria-hidden /> Hapus
                    </Button>
                )}
            </div>

            {error && (
                <p className="text-[12px] text-[var(--warning)]">{error}</p>
            )}

            {candidates.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                    {candidates.map((c) => {
                        const selected =
                            serialized === JSON.stringify(c.geojson);
                        return (
                            <button
                                key={c.placeId}
                                type="button"
                                onClick={() => onChange(c.geojson)}
                                className={cn(
                                    'inline-flex max-w-full items-center gap-1 rounded-[var(--radius-pill)] border px-2 py-0.5 text-[11.5px] transition-colors',
                                    selected
                                        ? 'border-[#dc2626] bg-[#dc2626]/10 font-medium text-[#b91c1c] dark:text-[#fca5a5]'
                                        : 'border-[var(--border)] bg-[var(--surface)] text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <MapPin className="size-3 shrink-0" aria-hidden />
                                <span className="max-w-[260px] truncate">
                                    {c.displayName}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {value ? (
                <BoundaryPreview boundary={value} height={185} />
            ) : (
                <p className="text-[12px] text-muted-foreground">
                    Belum ada batas wilayah. Klik{' '}
                    <span className="font-medium text-foreground">
                        Cari zonasi
                    </span>{' '}
                    untuk mengambil garis poligon kelurahan dari OpenStreetMap.
                </p>
            )}
        </div>
    );
}
