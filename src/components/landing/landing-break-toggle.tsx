'use client';

import { useRouter } from 'next/navigation';
import {
    LANDING_BREAK_MODES,
    type LandingBreakMode,
} from './landing-break-fixtures';

export function LandingBreakToggle({ mode }: { mode: LandingBreakMode }) {
    const router = useRouter();

    function select(next: LandingBreakMode) {
        const url = next === 'live' ? '/' : `/?data=${next}`;
        router.replace(url, { scroll: false });
    }

    return (
        <div
            role="group"
            aria-label="Break-UI data fixture toggle (dev only)"
            className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[40] flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-zinc-300 bg-zinc-100/95 p-0.5 font-sans text-[11px] text-zinc-700 shadow-sm backdrop-blur-sm md:bottom-3 dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-300"
        >
            {LANDING_BREAK_MODES.map((item) => {
                const active = item.id === mode;
                return (
                    <button
                        key={item.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => select(item.id)}
                        className={
                            active
                                ? 'cursor-pointer rounded-full bg-white px-2.5 py-1 font-medium text-zinc-950 shadow-2xs dark:bg-zinc-700 dark:text-white'
                                : 'cursor-pointer rounded-full px-2.5 py-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                        }
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}
