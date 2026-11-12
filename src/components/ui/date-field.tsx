'use client';

import { useState } from 'react';
import { DayPicker, type DayPickerLocale } from 'react-day-picker';
import { id } from 'react-day-picker/locale';
import { formatDate } from '@/lib/format';
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
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedBy,
}: {
    id: string;
    value?: string;
    onChange: (value: string) => void;
    'aria-invalid'?: true;
    'aria-describedby'?: string;
}) {
    const [open, setOpen] = useState(false);
    const selected =
        typeof value === 'string' && value ? parseISODate(value) : undefined;

    return (
        <div className="relative mt-1">
            {/* `aria-invalid` is not permitted on `role=button`, so the error
                reaches assistive tech through the description instead. */}
            <button
                id={fieldId}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-describedby={ariaDescribedBy}
                onClick={() => setOpen((v) => !v)}
                className={`h-9 w-full rounded-[var(--radius-control)] border bg-card px-3 text-left text-[14px] ${
                    ariaInvalid
                        ? 'border-[var(--negative)]'
                        : 'border-[var(--control)]'
                }`}
            >
                {selected ? (
                    formatDate(selected)
                ) : (
                    <span className="text-muted-foreground">
                        Pilih tanggal
                    </span>
                )}
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="Pilih tanggal"
                    className="absolute z-20 mt-1 rounded-[var(--radius-control)] border border-[var(--control)] bg-card p-2 shadow-lg"
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
