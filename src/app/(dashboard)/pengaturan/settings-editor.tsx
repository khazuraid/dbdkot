'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    deleteSettingAction,
    saveSettingAction,
} from '@/app/(dashboard)/actions';
import { useActionSettled } from '@/components/shell/use-action-settled';

export type SettingRow = {
    id: string;
    key: string;
    value: string;
    type: string;
    category: string | null;
    description: string | null;
    isPublic: boolean;
};

const TYPES = ['string', 'number', 'boolean', 'json'] as const;

/**
 * The settings form, in one dialog shared by create and edit. The value column
 * is what most people come to change; the key identifies the setting, the
 * category groups it, and `isPublic` decides whether a non-admin may read it.
 * The dialog closes only on a stored result, so a rejected form keeps its
 * values.
 */
function SettingDialog({
    row,
    categories,
    open,
    onOpenChange,
}: {
    row: SettingRow | null;
    categories: string[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const router = useRouter();
    const [state, action, pending] = useActionState(saveSettingAction, {
        ok: true,
    });
    // Seeded once from the row; the caller keys this dialog by row id, so a
    // different row remounts it with its own values instead of an effect
    // rewriting state after the fact.
    const [keyValue, setKeyValue] = useState(row?.key ?? '');
    const [val, setVal] = useState(row?.value ?? '');
    const [category, setCategory] = useState(row?.category ?? '');
    const [description, setDescription] = useState(row?.description ?? '');
    const [type, setType] = useState(row?.type ?? 'string');
    const [isPublic, setIsPublic] = useState(row?.isPublic ?? false);

    // The-server-did-it pattern: on a stored result, close and refresh. The
    // dialog closes only on success, so a rejected form keeps its values.
    useActionSettled(state, () => {
        onOpenChange(false);
        router.refresh();
    });

    useEffect(() => {
        if (!state.ok && state.error) toast.error(state.error);
    }, [state]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle className="text-[15px]">
                        {row ? 'Ubah pengaturan' : 'Tambah pengaturan'}
                    </DialogTitle>
                    <DialogDescription className="text-[12px]">
                        Kunci biasanya dirujuk kode — periksa sebelum mengubah
                        yang sudah ada.
                    </DialogDescription>
                </DialogHeader>

                <form action={action} className="grid gap-3">
                    {row && <input type="hidden" name="id" value={row.id} />}
                    <input type="hidden" name="type" value={type} />

                    <div className="grid gap-1.5">
                        <Label htmlFor="s-key" className="text-[12.5px]">
                            Kunci
                        </Label>
                        <Input
                            id="s-key"
                            name="key"
                            value={keyValue}
                            onChange={(e) => setKeyValue(e.target.value)}
                            placeholder="sla.jam_verifikasi"
                            required
                        />
                    </div>

                    <div className="grid gap-1.5">
                        <Label htmlFor="s-value" className="text-[12.5px]">
                            Nilai
                        </Label>
                        <Input
                            id="s-value"
                            name="value"
                            value={val}
                            onChange={(e) => setVal(e.target.value)}
                            required
                        />
                    </div>

                    <div className="grid gap-1.5">
                        <Label htmlFor="s-category" className="text-[12.5px]">
                            Kategori
                        </Label>
                        <Input
                            id="s-category"
                            name="category"
                            list="setting-categories"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="SLA"
                        />
                        <datalist id="setting-categories">
                            {categories.map((c) => (
                                <option key={c} value={c} />
                            ))}
                        </datalist>
                    </div>

                    <div className="grid gap-1.5">
                        <Label htmlFor="s-desc" className="text-[12.5px]">
                            Keterangan
                        </Label>
                        <Textarea
                            id="s-desc"
                            name="description"
                            rows={2}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2">
                        <span className="text-[12.5px] font-medium">Tipe</span>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger
                                className="w-[130px]"
                                aria-label="Tipe pengaturan"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TYPES.map((t) => (
                                    <SelectItem key={t} value={t}>
                                        {t}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <label className="flex items-center gap-2.5 rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2">
                        <input
                            type="checkbox"
                            name="isPublic"
                            checked={isPublic}
                            onChange={(e) => setIsPublic(e.target.checked)}
                            className="size-4 accent-[var(--accent)]"
                        />
                        <span className="text-[12.5px]">
                            Boleh dibaca non-admin
                        </span>
                    </label>

                    {state.error && (
                        <p className="text-[12px] text-[var(--negative)]">
                            {state.error}
                        </p>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={pending}
                            onClick={() => onOpenChange(false)}
                        >
                            Batal
                        </Button>
                        <Button type="submit" disabled={pending}>
                            Simpan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** One row's writes: open the edit dialog, or confirm a delete. */
export function SettingRowActions({
    row,
    categories,
}: {
    row: SettingRow;
    categories: string[];
}) {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [deleting, setDeleting] = useState(false);

    async function confirmDelete() {
        const result = await deleteSettingAction(row.id);
        if (!result.ok) {
            toast.error(result.error ?? 'Gagal menghapus.');
            return;
        }
        toast.success('Pengaturan dihapus.');
        setDeleting(false);
        router.refresh();
    }

    return (
        <div className="flex shrink-0 items-center gap-1">
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Ubah ${row.key}`}
                onClick={() => setEditing(true)}
            >
                <Pencil />
            </Button>
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Hapus ${row.key}`}
                className="text-muted-foreground hover:text-[var(--negative)]"
                onClick={() => setDeleting(true)}
            >
                <Trash2 />
            </Button>

            {editing && (
                <SettingDialog
                    key={row.id}
                    row={row}
                    categories={categories}
                    open={editing}
                    onOpenChange={setEditing}
                />
            )}

            <AlertDialog open={deleting} onOpenChange={setDeleting}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus pengaturan?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="font-mono">{row.key}</span> akan
                            hilang. Kode yang membacanya akan memakai nilai
                            bawaan.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete}>
                            Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

/** The create button, for the page header. Admin only. */
export function CreateSettingButton({ categories }: { categories: string[] }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button size="sm" onClick={() => setOpen(true)}>
                <Plus /> Tambah pengaturan
            </Button>
            {open && (
                <SettingDialog
                    row={null}
                    categories={categories}
                    open={open}
                    onOpenChange={setOpen}
                />
            )}
        </>
    );
}
