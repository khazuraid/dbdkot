import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Masuk — WALI-EPI',
};

// `searchParams` carries the redirect reason, so the shell cannot be
// prerendered; same opt-out as every other route that reads request data.
export const instant = false;

/**
 * The layout redirects a disabled account here with `?error=disabled`; saying
 * nothing would leave the person retrying a password that is not the problem.
 */
export default async function MasukPage({
    searchParams,
}: {
    searchParams: Promise<{ error?: string }>;
}) {
    const { error } = await searchParams;

    return (
        <div>
            <h1 className="text-[24px] font-medium tracking-tight">Masuk</h1>
            <p className="mt-1 text-[14px] text-muted-foreground">
                Sistem surveilans DBD. Gunakan akun yang sudah disetujui Dinas
                Kesehatan.
            </p>

            {error === 'disabled' && (
                <p
                    role="alert"
                    className="mt-4 rounded-[var(--radius-control)] border border-[var(--negative)]/30 bg-[var(--negative)]/5 px-3 py-2 text-[13px] text-[var(--negative)]"
                >
                    Akun ini dinonaktifkan. Hubungi administrator Dinas
                    Kesehatan.
                </p>
            )}

            <form
                className="mt-8 space-y-4"
                action="/api/auth/sign-in/email"
                method="post"
            >
                <div className="space-y-1.5">
                    <label htmlFor="email" className="text-[13px] font-medium">
                        Email
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="username"
                        required
                        className="h-9 w-full rounded-[var(--radius-control)] border border-input bg-card px-3 text-[14px] outline-none focus-visible:border-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--text)]/15"
                    />
                </div>

                <div className="space-y-1.5">
                    <label
                        htmlFor="password"
                        className="text-[13px] font-medium"
                    >
                        Password
                    </label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        className="h-9 w-full rounded-[var(--radius-control)] border border-input bg-card px-3 text-[14px] outline-none focus-visible:border-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--text)]/15"
                    />
                </div>

                <button
                    type="submit"
                    className="h-9 w-full rounded-[var(--radius-control)] bg-primary text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                    Masuk
                </button>
            </form>

            <p className="mt-6 text-[12px] text-muted-foreground">
                Belum punya akun?{' '}
                <Link href="/daftar" className="underline">
                    Ajukan akun
                </Link>{' '}
                dan tunggu persetujuan administrator.
            </p>
        </div>
    );
}
