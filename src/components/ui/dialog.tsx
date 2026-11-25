'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { Button } from '@/components/ui/button';
import { XIcon } from 'lucide-react';

// Tracks the most recent pointer interaction so centered modals can subtly bias
// transform-origin toward their triggering button without shifting off-center.
let lastTriggerPoint: { x: number; y: number; at: number } | null = null;
let trackingAttached = false;

function ensureTriggerTracking() {
    if (trackingAttached || typeof window === 'undefined') return;
    trackingAttached = true;
    window.addEventListener(
        'pointerdown',
        (e) => {
            lastTriggerPoint = { x: e.clientX, y: e.clientY, at: Date.now() };
        },
        { capture: true, passive: true },
    );
}

export function getTriggerTransformOrigin(): string | undefined {
    if (
        typeof window === 'undefined' ||
        !lastTriggerPoint ||
        Date.now() - lastTriggerPoint.at > 800
    ) {
        return undefined;
    }
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const ox = Math.min(
        76,
        Math.max(24, Math.round((lastTriggerPoint.x / vw) * 100)),
    );
    const oy = Math.min(
        76,
        Math.max(24, Math.round((lastTriggerPoint.y / vh) * 100)),
    );
    return `${ox}% ${oy}%`;
}

function Dialog({
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
    ensureTriggerTracking();
    return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
    return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
    return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
    return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
    return (
        <DialogPrimitive.Overlay
            data-slot="dialog-overlay"
            className={cn(
                'data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 fixed inset-0 isolate z-50 bg-[var(--text)]/28 duration-150 supports-backdrop-filter:backdrop-blur-[2px]',
                className,
            )}
            {...props}
        />
    );
}

function DialogContent({
    className,
    children,
    showCloseButton = true,
    style,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean;
}) {
    const [transformOrigin] = React.useState<string | undefined>(() =>
        getTriggerTransformOrigin(),
    );

    return (
        <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
                data-slot="dialog-content"
                style={transformOrigin ? { transformOrigin, ...style } : style}
                className={cn(
                    'fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 text-[13px] text-popover-foreground shadow-[var(--elev-pop)] outline-none sm:max-w-sm',
                    className,
                )}
                {...props}
            >
                {children}
                {showCloseButton && (
                    <DialogPrimitive.Close data-slot="dialog-close" asChild>
                        <Button
                            variant="ghost"
                            className="absolute top-3.5 right-3.5 text-muted-foreground hover:text-foreground"
                            size="icon-sm"
                        >
                            <XIcon />
                            <span className="sr-only">Tutup</span>
                        </Button>
                    </DialogPrimitive.Close>
                )}
            </DialogPrimitive.Content>
        </DialogPortal>
    );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="dialog-header"
            className={cn('flex flex-col gap-2', className)}
            {...props}
        />
    );
}

function DialogFooter({
    className,
    showCloseButton = false,
    children,
    ...props
}: React.ComponentProps<'div'> & {
    showCloseButton?: boolean;
}) {
    return (
        <div
            data-slot="dialog-footer"
            className={cn(
                '-mx-5 -mb-5 flex flex-col-reverse gap-2 rounded-b-[var(--radius-card)] border-t border-[var(--rule)] bg-[var(--raised)]/65 px-5 py-3.5 sm:flex-row sm:justify-end',
                className,
            )}
            {...props}
        >
            {children}
            {showCloseButton && (
                <DialogPrimitive.Close asChild>
                    <Button variant="outline">Close</Button>
                </DialogPrimitive.Close>
            )}
        </div>
    );
}

function DialogTitle({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title
            data-slot="dialog-title"
            className={cn(
                'font-heading text-base leading-none font-medium',
                className,
            )}
            {...props}
        />
    );
}

function DialogDescription({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description
            data-slot="dialog-description"
            className={cn(
                'text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
                className,
            )}
            {...props}
        />
    );
}

export {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
};
