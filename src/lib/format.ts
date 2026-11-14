import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { TZDate } from '@date-fns/tz';

/**
 * Locale-specific numerals: `Intl` would do this too, but date-fns is already
 * a dependency for the date helpers below and this keeps one library for the
 * whole formatting layer.
 */
const numberFormat = new Intl.NumberFormat('id-ID');

export function formatNumber(value: number): string {
    return numberFormat.format(value);
}

/**
 * Schedules and audit stamps are WIB. The container runs in UTC, so without a
 * pinned zone every time would render seven hours early — the database
 * already buckets days in `Asia/Jakarta`, and the screen must agree with it.
 */
const ZONE = 'Asia/Jakarta';

/** "12 Nov 2026" — date-fns gives the same shape Intl did, pinned to id. */
export function formatDate(value: Date | string): string {
    return format(toDate(value), 'd MMM yyyy', { locale: idLocale });
}

/** Clock time, for a column that already carries the date. */
export function formatTime(value: Date | string): string {
    return format(toDate(value), 'HH.mm', { locale: idLocale });
}

function toDate(value: Date | string): Date {
    const date = typeof value === 'string' ? new Date(value) : value;
    // One malformed timestamp must not 500 a whole table.
    return Number.isNaN(date.getTime()) ? new Date(0) : new TZDate(date, ZONE);
}
