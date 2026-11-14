import { Check } from 'lucide-react';
import type { ReportStatus } from '@/lib/domain/report-labels';
import { cn } from '@/lib/utils';

const STAGES = [
    { key: 'REPORTED', label: 'Lapor RS' },
    { key: 'ASSIGNED', label: 'Tugas 24j' },
    { key: 'ACCEPTED', label: 'Diterima' },
    { key: 'PE', label: 'PE 72j' },
    { key: 'VERIFIED', label: 'Verifikasi' },
    { key: 'DONE', label: 'Tindak Lanjut' },
] as const;

function resolveStageIndex(status: ReportStatus): number {
    switch (status) {
        case 'DRAFT':
        case 'SUBMITTED':
        case 'CROSS_BORDER_PENDING':
            return 0;
        case 'ASSIGNED':
        case 'PUSKESMAS_REJECTED':
            return 1;
        case 'ASSIGNED_ACCEPTED':
        case 'PE_IN_PROGRESS':
            return 2;
        case 'PE_COMPLETED':
            return 3;
        case 'VERIFIED':
        case 'FOGGING_REQUIRED':
        case 'SIKLUS_1_DONE':
        case 'SIKLUS_2_SCHEDULED':
            return 4;
        case 'SIKLUS_2_DONE':
        case 'CLOSED':
        case 'ARCHIVED_CROSS_BORDER':
            return 5;
        case 'REJECTED':
            return 4;
    }
}

export function StatusStepper({ status }: { status: ReportStatus }) {
    const activeIndex = resolveStageIndex(status);
    const isRejected =
        status === 'REJECTED' || status === 'PUSKESMAS_REJECTED';

    return (
        <ol
            aria-label="Tahapan kasus DBD"
            className="grid grid-cols-3 gap-2 sm:grid-cols-6"
        >
            {STAGES.map((stage, idx) => {
                const done = idx < activeIndex;
                const current = idx === activeIndex;
                return (
                    <li
                        key={stage.key}
                        className={cn(
                            'flex items-center gap-2 rounded-[var(--radius-control)] border px-2.5 py-2 text-[12px]',
                            done &&
                                'border-[var(--pill-positive-border)] bg-[var(--pill-positive-bg)] text-[var(--pill-positive-ink)]',
                            current &&
                                !isRejected &&
                                'border-[var(--accent)] bg-[var(--accent-soft)] font-semibold text-[var(--accent)]',
                            current &&
                                isRejected &&
                                'border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] font-semibold text-[var(--pill-negative-ink)]',
                            !done &&
                                !current &&
                                'border-[var(--rule)] bg-[var(--raised)]/35 text-muted-foreground',
                        )}
                    >
                        <span
                            aria-hidden
                            className={cn(
                                'grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold',
                                done
                                    ? 'bg-[var(--positive)] text-white'
                                    : current
                                      ? isRejected
                                          ? 'bg-[var(--negative)] text-white'
                                          : 'bg-[var(--accent)] text-[var(--accent-ink)]'
                                      : 'bg-[var(--border)] text-muted-foreground',
                            )}
                        >
                            {done ? <Check className="size-3" /> : idx + 1}
                        </span>
                        <span className="truncate">{stage.label}</span>
                    </li>
                );
            })}
        </ol>
    );
}
