import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export function fieldProps(id: string, error?: string, hint?: string) {
    return {
        id,
        'aria-invalid': error ? (true as const) : undefined,
        'aria-describedby': error
            ? `${id}-error`
            : hint
              ? `${id}-hint`
              : undefined,
    };
}

export function FormField({
    id,
    label,
    hint,
    error,
    required,
    className,
    children,
}: {
    id: string;
    label: string;
    hint?: string;
    error?: string;
    required?: boolean;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div
            className={cn(
                'grid gap-x-4 gap-y-1.5 sm:grid-cols-[176px_minmax(0,1fr)]',
                className,
            )}
        >
            <Label
                htmlFor={id}
                className="flex min-h-[var(--control-height)] items-center gap-1 text-[13px] font-medium text-muted-foreground"
            >
                {label}
                {required && (
                    <span aria-hidden className="text-[var(--negative)]">
                        *
                    </span>
                )}
            </Label>
            <div className="min-w-0">
                {children}
                {hint && !error && (
                    <p
                        id={`${id}-hint`}
                        className="mt-1.5 text-[12px] text-faint"
                    >
                        {hint}
                    </p>
                )}
                {error && (
                    <p
                        id={`${id}-error`}
                        role="alert"
                        className="mt-1.5 text-[12px] font-medium text-[var(--negative)]"
                    >
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
}
