'use client';

import { motion, useReducedMotion } from 'motion/react';

/**
 * The one entrance animation in the app: a section settling into place.
 *
 * Deliberately the only one. This is an operator tool that is scanned, not
 * browsed, and motion on every row would slow that down. When the OS asks for
 * reduced motion the element renders at rest — the content is never hidden
 * behind an animation that will not play.
 */
export function FadeIn({
    children,
    delay = 0,
}: {
    children: React.ReactNode;
    delay?: number;
}) {
    const reduced = useReducedMotion();

    if (reduced) return <>{children}</>;

    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay, ease: 'easeOut' }}
        >
            {children}
        </motion.div>
    );
}
