'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import {
    AlertCircle,
    ArrowLeft,
    Check,
    CheckCircle2,
    KeyRound,
    LogIn,
    UserPlus,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Synchronized navigation bar right above the auth card so /masuk, /daftar,
 * and /lupa-password share identical chrome and spatial rhythm.
 */
export function AuthTabNav() {
    const pathname = usePathname();
    const reduceMotion = useReducedMotion();

    if (pathname.startsWith('/lupa-password')) {
        return (
            <div className="mb-3 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)]/90 px-3.5 py-2 text-[12.5px] shadow-2xs">
                <Link
                    href="/masuk"
                    className="inline-flex items-center gap-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="size-3.5" />
                    <span>Kembali ke Halaman Masuk</span>
                </Link>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-[var(--accent)]">
                    <KeyRound className="size-3" />
                    Pemulihan
                </span>
            </div>
        );
    }

    const tabs = [
        { href: '/masuk', label: 'Masuk Akun', icon: LogIn },
        { href: '/daftar', label: 'Ajukan Akun', icon: UserPlus },
    ] as const;

    return (
        <nav
            aria-label="Navigasi autentikasi"
            className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-[var(--border)] bg-[var(--raised)]/80 p-1 shadow-2xs"
        >
            {tabs.map((tab) => {
                const active = pathname === tab.href;
                const Icon = tab.icon;
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                            'relative flex h-9 items-center justify-center gap-2 rounded-lg text-[13px] font-medium transition-colors',
                            active
                                ? 'text-foreground'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {active && (
                            <motion.span
                                layoutId={reduceMotion ? undefined : 'auth-tab-pill'}
                                transition={{
                                    type: 'spring',
                                    stiffness: 420,
                                    damping: 32,
                                }}
                                className="absolute inset-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-xs"
                            />
                        )}
                        <Icon
                            className={cn(
                                'relative z-10 size-3.5',
                                active ? 'text-[var(--accent)]' : 'text-muted-foreground',
                            )}
                        />
                        <span className="relative z-10">{tab.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}

const HEADER_ICONS = {
    login: LogIn,
    register: UserPlus,
    reset: KeyRound,
};

export function AuthCardHeader({
    icon,
    eyebrow,
    title,
    description,
}: {
    icon: keyof typeof HEADER_ICONS;
    eyebrow: string;
    title: string;
    description: string;
}) {
    const Icon = HEADER_ICONS[icon];
    return (
        <div className="border-b border-[var(--rule)] px-6 py-5">
            <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Icon className="size-5" />
                </div>
                <div className="min-w-0 space-y-1">
                    <p className="font-mono text-[10.5px] font-semibold tracking-[0.12em] text-[var(--accent)] uppercase">
                        {eyebrow}
                    </p>
                    <h2 className="text-[19px] leading-tight font-semibold tracking-[-0.02em] text-foreground">
                        {title}
                    </h2>
                </div>
            </div>
            <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
                {description}
            </p>
        </div>
    );
}

export function AuthSteps({
    steps,
    currentIndex,
}: {
    steps: string[];
    currentIndex: number;
}) {
    return (
        <ol
            aria-label="Tahapan proses"
            className="mb-5 grid gap-2"
            style={{
                gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
            }}
        >
            {steps.map((label, idx) => {
                const done = idx < currentIndex;
                const active = idx === currentIndex;
                return (
                    <li key={label} className="min-w-0 space-y-1.5">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--raised)]">
                            <div
                                className={cn(
                                    'h-full rounded-full transition-all duration-300',
                                    done
                                        ? 'w-full bg-[var(--positive)]'
                                        : active
                                          ? 'w-full bg-[var(--accent)]'
                                          : 'w-0 bg-transparent',
                                )}
                            />
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-medium">
                            {done ? (
                                <CheckCircle2 className="size-3 shrink-0 text-[var(--positive)]" />
                            ) : (
                                <span
                                    className={cn(
                                        'font-mono tabular-nums',
                                        active
                                            ? 'text-[var(--accent)]'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    0{idx + 1}
                                </span>
                            )}
                            <span
                                className={cn(
                                    'truncate',
                                    active || done
                                        ? 'text-foreground'
                                        : 'text-muted-foreground',
                                )}
                            >
                                {label}
                            </span>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

export function AuthErrorAlert({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[var(--pill-negative-ink)]"
        >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{message}</span>
        </div>
    );
}

export function PasswordRequirements({ password }: { password: string }) {
    const hasLength = password.length >= 7;
    const hasSymbol = /[^a-zA-Z0-9]/.test(password);

    const rules = [
        { ok: hasLength, text: 'Minimal 7 karakter' },
        { ok: hasSymbol, text: 'Minimal 1 simbol (@, #, $, !, %, &)' },
    ];

    return (
        <ul className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {rules.map((r) => (
                <li
                    key={r.text}
                    className={cn(
                        'flex items-center gap-1.5 text-[11.5px] transition-colors',
                        r.ok ? 'text-[var(--positive)]' : 'text-muted-foreground',
                    )}
                >
                    <span
                        className={cn(
                            'flex size-3.5 shrink-0 items-center justify-center rounded-full border',
                            r.ok
                                ? 'border-[var(--positive)] bg-[var(--positive)] text-white'
                                : 'border-border bg-transparent',
                        )}
                    >
                        {r.ok && <Check className="size-2.5 stroke-[2.5]" />}
                    </span>
                    <span>{r.text}</span>
                </li>
            ))}
        </ul>
    );
}

export function OtpCodeInput({
    id,
    value,
    onChange,
    disabled,
    invalid,
}: {
    id: string;
    value: string;
    onChange: (next: string) => void;
    disabled?: boolean;
    invalid?: boolean;
}) {
    return (
        <Input
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            disabled={disabled}
            aria-invalid={invalid}
            className="h-12 bg-[var(--ground)] text-center font-mono text-[22px] font-semibold tracking-[0.42em] tabular-nums placeholder:tracking-[0.42em] placeholder:text-muted-foreground/40"
            autoFocus
        />
    );
}

export function AuthCardFooter({ children }: { children: ReactNode }) {
    return (
        <div className="space-y-2.5 border-t border-[var(--rule)] bg-[var(--raised)]/50 px-6 py-4 text-[12.5px] text-muted-foreground">
            {children}
        </div>
    );
}
