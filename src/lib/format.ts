const numberFormat = new Intl.NumberFormat('id-ID');

export function formatNumber(value: number): string {
    return numberFormat.format(value);
}

const dateFormat = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });

export function formatDate(value: Date | string): string {
    return dateFormat.format(
        typeof value === 'string' ? new Date(value) : value,
    );
}

const timeFormat = new Intl.DateTimeFormat('id-ID', { timeStyle: 'short' });

/** Clock time, for a column that already carries the date. */
export function formatTime(value: Date | string): string {
    return timeFormat.format(
        typeof value === 'string' ? new Date(value) : value,
    );
}
