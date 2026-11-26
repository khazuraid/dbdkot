'use client';

import * as React from 'react';
import {
    animate,
    AnimatePresence,
    motion,
    useDragControls,
    useMotionValue,
    useReducedMotion,
    useTransform,
    type AnimationPlaybackControls,
    type PanInfo,
} from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawer as DrawerPrimitive } from 'vaul';

function Drawer({
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
    return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
    return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
    return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
    return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({
    className,
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
    return (
        <DrawerPrimitive.Overlay
            data-slot="drawer-overlay"
            className={cn(
                'data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs',
                className,
            )}
            {...props}
        />
    );
}

function DrawerContent({
    className,
    children,
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
    return (
        <DrawerPortal data-slot="drawer-portal">
            <DrawerOverlay />
            <DrawerPrimitive.Content
                data-slot="drawer-content"
                className={cn(
                    'group/drawer-content fixed z-50 flex h-auto flex-col bg-popover text-sm text-popover-foreground data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[85dvh] data-[vaul-drawer-direction=bottom]:rounded-t-xl data-[vaul-drawer-direction=bottom]:border-t data-[vaul-drawer-direction=bottom]:pb-[env(safe-area-inset-bottom,0px)] data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:rounded-r-xl data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:rounded-l-xl data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[85dvh] data-[vaul-drawer-direction=top]:rounded-b-xl data-[vaul-drawer-direction=top]:border-b data-[vaul-drawer-direction=left]:sm:max-w-sm data-[vaul-drawer-direction=right]:sm:max-w-sm',
                    className,
                )}
                {...props}
            >
                <div className="mx-auto hidden w-full shrink-0 cursor-grab touch-none items-center justify-center py-3 group-data-[vaul-drawer-direction=bottom]/drawer-content:flex active:cursor-grabbing">
                    <span
                        aria-hidden
                        className="h-1 w-12 rounded-full bg-muted-foreground/30"
                    />
                </div>
                {children}
            </DrawerPrimitive.Content>
        </DrawerPortal>
    );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="drawer-header"
            className={cn(
                'flex flex-col gap-0.5 p-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center group-data-[vaul-drawer-direction=top]/drawer-content:text-center md:gap-0.5 md:text-left',
                className,
            )}
            {...props}
        />
    );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="drawer-footer"
            className={cn('mt-auto flex flex-col gap-2 p-4', className)}
            {...props}
        />
    );
}

function DrawerTitle({
    className,
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
    return (
        <DrawerPrimitive.Title
            data-slot="drawer-title"
            className={cn(
                'font-heading text-base font-medium text-foreground',
                className,
            )}
            {...props}
        />
    );
}

function DrawerDescription({
    className,
    ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
    return (
        <DrawerPrimitive.Description
            data-slot="drawer-description"
            className={cn('text-sm text-muted-foreground', className)}
            {...props}
        />
    );
}

/**
 * Apple momentum projection (WWDC "Designing Fluid Interfaces"):
 * projects resting position from release velocity so fast flicks commit naturally.
 */
function projectMomentum(velocityPxPerSec: number, decelerationRate = 0.996) {
    return (
        ((velocityPxPerSec / 1000) * decelerationRate) / (1 - decelerationRate)
    );
}

/**
 * Interruptible spring-physics swipe-to-dismiss bottom sheet.
 * - Track phase: 1:1 `useMotionValue(y)` with linked scrim opacity (`useTransform`).
 * - Release phase: velocity-projected dismiss vs. velocity-seeded spring snap-back.
 * - `contained`: anchors inside a `relative overflow-hidden` container (e.g. map canvas).
 */
function SpringSheet({
    open,
    onOpenChange,
    title,
    description,
    contained = false,
    className,
    children,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    contained?: boolean;
    className?: string;
    children: React.ReactNode;
}) {
    const reduce = Boolean(useReducedMotion());
    const dragControls = useDragControls();
    const sheetRef = React.useRef<HTMLDivElement>(null);
    const animRef = React.useRef<AnimationPlaybackControls | null>(null);
    const [sheetHeight, setSheetHeight] = React.useState(380);
    const y = useMotionValue(0);
    const backdropOpacity = useTransform(
        y,
        [0, Math.max(sheetHeight, 160)],
        [1, 0],
        { clamp: true },
    );

    React.useEffect(() => {
        if (!open) return;
        animRef.current?.stop();
        y.set(0);
        const measure = () => {
            const h = sheetRef.current?.getBoundingClientRect().height;
            if (h && h > 0) setSheetHeight(h);
        };
        measure();
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onOpenChange(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onOpenChange, y]);

    function dismissWithVelocity(velocity = 0) {
        animRef.current?.stop();
        if (reduce) {
            onOpenChange(false);
            return;
        }
        const target = Math.max(sheetHeight, 260) + 32;
        animRef.current = animate(y, target, {
            type: 'spring',
            duration: 0.32,
            bounce: 0,
            velocity,
        });
        onOpenChange(false);
    }

    function handleDragEnd(
        _: MouseEvent | TouchEvent | PointerEvent,
        info: PanInfo,
    ) {
        const currentY = y.get();
        const projectedY = currentY + projectMomentum(info.velocity.y);
        const distanceThreshold = Math.max(sheetHeight * 0.38, 96);

        if (projectedY > distanceThreshold || info.velocity.y > 550) {
            dismissWithVelocity(info.velocity.y);
        } else {
            animRef.current?.stop();
            animRef.current = animate(y, 0, {
                type: 'spring',
                duration: reduce ? 0.14 : 0.38,
                bounce: reduce ? 0 : 0.18,
                velocity: info.velocity.y,
            });
        }
    }

    return (
        <AnimatePresence>
            {open ? (
                <div
                    className={cn(
                        contained
                            ? 'absolute inset-0 z-[480]'
                            : 'fixed inset-0 z-50',
                        'flex items-end justify-center',
                    )}
                    role="dialog"
                    aria-modal={!contained}
                    aria-label={title}
                >
                    {/* Scrim linked 1:1 to drag progress */}
                    <motion.div
                        aria-hidden
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{
                            duration: reduce ? 0.12 : 0.2,
                            ease: [0.23, 1, 0.32, 1],
                        }}
                        onClick={() => onOpenChange(false)}
                        className="absolute inset-0 bg-[var(--text)]/30 backdrop-blur-[2px]"
                        style={{ opacity: backdropOpacity }}
                    />

                    {/* Draggable spring sheet */}
                    <motion.div
                        ref={sheetRef}
                        data-translucent="true"
                        initial={
                            reduce
                                ? { opacity: 0 }
                                : { y: '100%', opacity: 0.98 }
                        }
                        animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
                        exit={
                            reduce
                                ? { opacity: 0 }
                                : { y: '100%', opacity: 0.96 }
                        }
                        transition={
                            reduce
                                ? { duration: 0.14, ease: 'easeOut' }
                                : { type: 'spring', duration: 0.38, bounce: 0 }
                        }
                        style={{ y }}
                        drag={reduce ? false : 'y'}
                        dragControls={dragControls}
                        dragListener={false}
                        dragConstraints={{ top: 0 }}
                        dragElastic={{ top: 0.18, bottom: 0.45 }}
                        dragMomentum={false}
                        onPointerDownCapture={() => {
                            // Interruptible: catching a snapping sheet stops in-flight spring
                            animRef.current?.stop();
                        }}
                        onDragEnd={handleDragEnd}
                        className={cn(
                            'relative z-10 flex w-full flex-col overflow-hidden rounded-t-[16px] border border-b-0 border-[var(--border)] bg-[var(--surface)]/95 text-foreground shadow-[var(--elev-pop)] backdrop-blur-md',
                            contained
                                ? 'max-h-[85%] max-w-full'
                                : 'max-h-[86dvh] max-w-2xl',
                            className,
                        )}
                    >
                        {/* >=44px drag handle + header grip zone */}
                        <div
                            onPointerDown={(e) => {
                                if (
                                    (e.target as HTMLElement).closest(
                                        'button, a, input, select',
                                    )
                                ) {
                                    return;
                                }
                                animRef.current?.stop();
                                dragControls.start(e);
                            }}
                            className="flex shrink-0 cursor-grab touch-pan-x flex-col border-b border-[var(--border)] px-4 pt-2 pb-3 select-none active:cursor-grabbing"
                        >
                            <div className="mx-auto flex h-5 w-20 items-center justify-center">
                                <span
                                    aria-hidden
                                    className="h-1 w-10 rounded-full bg-muted-foreground/35"
                                />
                            </div>
                            <div className="mt-1 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="truncate text-[14px] font-semibold text-foreground">
                                        {title}
                                    </h3>
                                    {description ? (
                                        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                                            {description}
                                        </p>
                                    ) : null}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onOpenChange(false)}
                                    aria-label="Tutup panel"
                                    className="relative grid size-8 shrink-0 cursor-pointer place-items-center rounded-[var(--radius-control)] text-muted-foreground transition-[color,background-color,transform] duration-150 ease-[var(--ease-out)] before:absolute before:-inset-1.5 before:content-[''] hover:bg-[var(--raised)] hover:text-foreground active:scale-[0.95]"
                                >
                                    <X
                                        className="size-4"
                                        strokeWidth={1.75}
                                        aria-hidden
                                    />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-3.5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                            {children}
                        </div>
                    </motion.div>
                </div>
            ) : null}
        </AnimatePresence>
    );
}

export {
    Drawer,
    DrawerPortal,
    DrawerOverlay,
    DrawerTrigger,
    DrawerClose,
    DrawerContent,
    DrawerHeader,
    DrawerFooter,
    DrawerTitle,
    DrawerDescription,
    SpringSheet,
};
