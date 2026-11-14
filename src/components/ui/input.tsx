import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                'h-[var(--control-height)] w-full min-w-0 rounded-[var(--radius-control)] border border-[var(--control)] bg-[var(--surface)] px-3 py-1 text-[13.5px] text-foreground transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-[12px] file:font-medium file:text-foreground placeholder:text-faint focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[var(--raised)] disabled:opacity-60 aria-invalid:border-[var(--negative)] aria-invalid:ring-2 aria-invalid:ring-[var(--negative)]/20',
                className,
            )}
            {...props}
        />
    );
}

export { Input };
