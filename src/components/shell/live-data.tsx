'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
    /** Milliseconds between refreshes. Minimum enforced: see MIN_INTERVAL. */
    intervalMs?: number;
    /** Shown as the "terakhir diperbarui" stamp; pass a server-rendered time. */
    since: string;
};

// Below this, refreshes pile up faster than a query round trip and every
// refresh re-renders the whole route: a 1s poll on a dashboard costs more
// than it informs.
const MIN_INTERVAL = 5_000;

/**
 * Refreshes the current route's server components in place, without a full page
 * load and without losing scroll position or client state. Data itself stays
 * server-rendered — this only re-requests it.
 *
 * Pauses while the tab is hidden: polling a screen nobody is looking at is
 * wasted database load, and it resumes with an immediate refresh on return.
 */
export function LiveData({ intervalMs = 15_000, since }: Props) {
    const router = useRouter();
    const [enabled, setEnabled] = useState(true);
    const [updatedAt, setUpdatedAt] = useState(since);
    const interval = Math.max(MIN_INTERVAL, intervalMs);

    useEffect(() => {
        const onVisibility = () => setEnabled(!document.hidden);
        document.addEventListener('visibilitychange', onVisibility);

        return () =>
            document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    useEffect(() => {
        if (!enabled) return;

        let timer: ReturnType<typeof setTimeout>;

        const tick = () => {
            router.refresh();
            setUpdatedAt(
                new Date().toLocaleTimeString('id-ID', { timeStyle: 'short' }),
            );
            timer = setTimeout(tick, interval);
        };

        timer = setTimeout(tick, interval);

        return () => clearTimeout(timer);
    }, [enabled, interval, router]);

    return (
        <p className="text-[12px] text-muted-foreground" aria-live="polite">
            Diperbarui {updatedAt}
            {enabled ? '' : ' · jeda (tab tidak aktif)'}
        </p>
    );
}
