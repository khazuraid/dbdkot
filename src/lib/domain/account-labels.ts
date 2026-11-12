type AccountRow = { status: string; isActive: boolean };

/**
 * One label for the three states, used by the roster and by anything that
 * reports on an account. `isActive` is folded in here rather than shown as a
 * fourth column: an approved-but-disabled account is a single state to an
 * operator, and two columns that can contradict each other only confuse.
 */
export function accountStatusLabel(row: AccountRow): string {
    if (row.status === 'PENDING') return 'Menunggu persetujuan';
    if (row.status === 'REJECTED') return 'Ditolak';
    return row.isActive ? 'Aktif' : 'Nonaktif';
}

export type StatusTone = 'neutral' | 'warn' | 'bad' | 'good';

export function statusTone(row: AccountRow): StatusTone {
    if (row.status === 'PENDING') return 'warn';
    if (row.status === 'REJECTED') return 'bad';
    return row.isActive ? 'good' : 'neutral';
}
