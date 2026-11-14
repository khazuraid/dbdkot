'use client';

import React, {
    useCallback,
    useEffect,
    useRef,
    useTransition,
    type FormHTMLAttributes,
    type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AutoFilterForm({
    children,
    action,
    className,
    debounceMs = 350,
    resetPageOnFilter = true,
    showIndicator = true,
    ...props
}: FormHTMLAttributes<HTMLFormElement> & {
    debounceMs?: number;
    resetPageOnFilter?: boolean;
    showIndicator?: boolean;
    children: ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();
    const formRef = useRef<HTMLFormElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const submitFilter = useCallback(() => {
        const form = formRef.current;
        if (!form) return;

        const formData = new FormData(form);
        const params = new URLSearchParams();

        for (const [key, value] of formData.entries()) {
            const strVal = typeof value === 'string' ? value.trim() : '';
            if (strVal !== '') {
                params.set(key, strVal);
            }
        }

        if (resetPageOnFilter) {
            params.delete('page');
        }

        const targetAction = typeof action === 'string' ? action : pathname;
        const q = params.toString();
        const nextUrl = q ? `${targetAction}?${q}` : targetAction;

        startTransition(() => {
            router.push(nextUrl, { scroll: false });
        });
    }, [action, pathname, resetPageOnFilter, router]);

    // Instantly apply on select, checkbox, or radio change
    const handleChange = (e: React.ChangeEvent<HTMLFormElement>) => {
        const target = e.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();
        const type = (target as HTMLInputElement).type?.toLowerCase();

        if (tagName === 'select' || type === 'checkbox' || type === 'radio') {
            if (timerRef.current) clearTimeout(timerRef.current);
            submitFilter();
        }
    };

    // Debounced apply on text or search input
    const handleInput = (e: React.FormEvent<HTMLFormElement>) => {
        const target = e.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();
        const type = (target as HTMLInputElement).type?.toLowerCase();

        if (tagName === 'input' && (type === 'search' || type === 'text')) {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                submitFilter();
            }, debounceMs);
        }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (timerRef.current) clearTimeout(timerRef.current);
        submitFilter();
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return (
        <form
            ref={formRef}
            action={action ?? pathname}
            method="get"
            onChange={handleChange}
            onInput={handleInput}
            onSubmit={handleSubmit}
            className={cn('relative', className)}
            {...props}
        >
            {children}
            {showIndicator && isPending && (
                <div
                    aria-live="polite"
                    className="pointer-events-none absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md bg-[var(--surface)]/90 px-2 py-0.5 text-[11px] font-medium text-[var(--accent)] shadow-xs backdrop-blur-xs"
                >
                    <Loader2 className="size-3 animate-spin" />
                    <span>Menyaring…</span>
                </div>
            )}
        </form>
    );
}
