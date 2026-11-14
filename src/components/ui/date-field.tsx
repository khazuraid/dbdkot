'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { DayPicker, type DayPickerLocale } from 'react-day-picker';
import { id } from 'react-day-picker/locale';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import 'react-day-picker/style.css';

/**
 * A calendar field for the clinical dates. A `<input type="date">` makes the
 * operator read a date from a format they did not choose and type it back;
 * a month grid makes the day a pick, and the picked day is echoed as text so
 * the value is legible without opening the calendar.
 *
 * The input is a `<button>`, not a text box: the value can only be set from
 * the calendar, so it cannot be typed into a state that no picker produces.
 */
export function DateField({
    id: fieldId,
    value,
    onChange,
    className,
    placeholder = 'Pilih tanggal',
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
}: {
    id: string;
    value?: string;
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
    'aria-invalid'?: true;
    'aria-describedby'?: string;
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const selected =
        typeof value === 'string' && value ? parseISODate(value) : undefined;

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    return (
        <div ref={rootRef} className={cn('relative mt-1', className)}>
            {/* `aria-invalid` is not permitted on `role=button`, so the error
                reaches assistive tech through the description instead. */}
            <button
                id={fieldId}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-describedby={ariaDescribedBy}
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    'flex h-[var(--control-height)] w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border bg-[var(--surface)] px-3 text-left text-[13.5px] transition-colors outline-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/25',
                    ariaInvalid
                        ? 'border-[var(--negative)] ring-2 ring-[var(--negative)]/20'
                        : 'border-[var(--control)]',
                )}
            >
                <span className="truncate">
                    {selected ? (
                        formatDate(selected)
                    ) : (
                        <span className="text-faint">{placeholder}</span>
                    )}
                </span>
                <Calendar
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                />
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="Pilih tanggal"
                    className="absolute left-0 z-30 mt-1.5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-[var(--elev-pop)]"
                >
                    {/* The shipped `id` locale is complete at runtime, but its
                        declaration is typed against react-day-picker's own
                        date-fns copy and does not structurally match the one
                        this app resolves. */}
                    <DayPicker
                        mode="single"
                        locale={id as Partial<DayPickerLocale>}
                        selected={selected}
                        defaultMonth={selected}
                        onSelect={(day) => {
                            onChange(toISODate(day));
                            setOpen(false);
                        }}
                    />
                    {selected && (
                        <div className="mt-1 flex justify-end border-t border-[var(--rule)] pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    onChange('');
                                    setOpen(false);
                                }}
                                className="inline-flex items-center gap-1 rounded-[var(--radius-control)] px-2 py-1 text-[12px] text-muted-foreground hover:bg-[var(--raised)] hover:text-foreground"
                            >
                                <X className="size-3" aria-hidden /> Kosongkan
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * `YYYY-MM-DD` read as a local date. `new Date('2024-05-01')` is UTC midnight,
 * which is the previous day west of Greenwich — the calendar and the echoed
 * text would disagree about which day was picked.
 */
function parseISODate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

/** The `YYYY-MM-DD` the form schema and the server expect. */
function toISODate(day: Date | undefined): string {
    if (!day) return '';

    const month = String(day.getMonth() + 1).padStart(2, '0');
    const date = String(day.getDate()).padStart(2, '0');
    return `${day.getFullYear()}-${month}-${date}`;
}
