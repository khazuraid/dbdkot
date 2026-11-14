import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Slot } from 'radix-ui';

const buttonVariants = cva(
    "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-transparent bg-clip-padding text-[13.5px] font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default:
                    'bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(14_26_24/0.12)] hover:bg-primary/90',
                outline:
                    'border-[var(--control)] bg-[var(--surface)] text-foreground hover:bg-[var(--raised)] hover:text-foreground aria-expanded:bg-[var(--raised)] aria-expanded:text-foreground',
                secondary:
                    'border-[var(--border)] bg-[var(--raised)] text-foreground hover:bg-[var(--active)] aria-expanded:bg-[var(--active)]',
                ghost: 'text-muted-foreground hover:bg-[var(--raised)] hover:text-foreground aria-expanded:bg-[var(--raised)] aria-expanded:text-foreground',
                destructive:
                    'border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)] hover:brightness-95 focus-visible:border-destructive/50 focus-visible:ring-destructive/25',
                link: 'text-[var(--accent)] underline-offset-4 hover:underline',
            },
            size: {
                default: 'h-[var(--control-height)] px-3.5',
                xs: "h-7 gap-1 rounded-[var(--radius-control)] px-2 text-[12px] [&_svg:not([class*='size-'])]:size-3",
                sm: "h-8 gap-1.5 rounded-[var(--radius-control)] px-3 text-[12.5px] [&_svg:not([class*='size-'])]:size-3.5",
                lg: 'h-10 rounded-[var(--radius-control)] px-4 text-[14px]',
                icon: 'size-[var(--control-height)]',
                'icon-xs':
                    "size-7 rounded-[var(--radius-control)] [&_svg:not([class*='size-'])]:size-3",
                'icon-sm': 'size-8 rounded-[var(--radius-control)]',
                'icon-lg': 'size-10 rounded-[var(--radius-control)]',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

function Button({
    className,
    variant = 'default',
    size = 'default',
    asChild = false,
    ...props
}: React.ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    }) {
    const Comp = asChild ? Slot.Root : 'button';

    return (
        <Comp
            data-slot="button"
            data-variant={variant}
            data-size={size}
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };
