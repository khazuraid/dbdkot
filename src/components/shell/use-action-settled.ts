'use client';

import { useEffect, useRef } from 'react';

/**
 * Runs `onSettled` once per successful server-action result, while it is still
 * mounted. A dialog close or a toast is a side effect, not state the render
 * derives from, so it belongs here rather than in the action itself.
 *
 * The ref keeps re-renders (a `router.refresh()` lands right after) from
 * firing the same success twice.
 */
export function useActionSettled(
    state: { ok: boolean },
    onSettled: () => void,
) {
    const seen = useRef(state);
    const run = useRef(onSettled);

    // Declared first so it runs before the settle check below on every render.
    useEffect(() => {
        run.current = onSettled;
    });

    useEffect(() => {
        if (seen.current === state) return;
        seen.current = state;
        if (state.ok) run.current();
    }, [state]);
}
