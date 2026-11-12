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
