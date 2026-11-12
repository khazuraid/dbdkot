import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Masuk — WALI-EPI',
};

// `searchParams` carries the redirect reason, so the shell cannot be
// prerendered; same opt-out as every other route that reads request data.
export const instant = false;

/** The reporting chain from README: RS melapor enters the system here. */
const CHAIN = [
    {
        step: 'Rumah sakit',
        detail: 'Melaporkan kasus DBD per kelurahan.',
    },
    {
        step: 'Puskesmas',
        detail: 'Menerima otomatis sesuai wilayah, lalu menerima atau menolak.',
    },
    {
        step: 'Penyelidikan epidemiologi',
        detail: 'Petugas PE menelusuri dan mencatat temuan lapangan.',
    },
    {
        step: 'Dinkes',
        detail: 'Memverifikasi laporan yang sudah dikerjakan PE.',
    },
];

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
        <div className="flex flex-1 flex-col">
            <div className="grid items-start gap-x-16 gap-y-12 pt-10 md:pt-16 lg:pt-24 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
                <div>
                    <h1 className="text-[24px] font-medium tracking-[-0.02em]">
                        Masuk
                    </h1>
                    <p className="mt-1.5 text-[14px] leading-6 text-muted-foreground">
                        Sistem surveilans DBD. Gunakan akun yang sudah disetujui
                        Dinas Kesehatan.
                    </p>

                    {error === 'disabled' && (
                        <p
                            role="alert"
                            className="mt-5 rounded-[var(--radius-control)] border border-[var(--negative)]/30 bg-[var(--negative)]/5 px-3 py-2 text-[13px] text-[var(--negative)]"
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
                            <label
                                htmlFor="email"
                                className="text-[13px] font-medium"
                            >
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
                        <Link
                            href="/daftar"
                            className="underline decoration-[var(--control)] underline-offset-4 hover:text-foreground"
                        >
                            Ajukan akun
                        </Link>{' '}
                        dan tunggu persetujuan administrator.
                    </p>
                </div>

                {/*
                 * The right half carries the report's actual path, not decoration.
                 * It closes the void the old centred column left, and tells a new
                 * operator which of the four roles they are signing in as.
                 */}
                <section aria-labelledby="alur" className="hidden lg:block">
                    <h2 id="alur" className="text-[12px] text-muted-foreground">
                        Alur laporan
                    </h2>
                    <ol className="mt-4">
                        {CHAIN.map((link, i) => (
                            <li
                                key={link.step}
                                className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 py-4"
                            >
                                <div className="flex flex-col items-center">
                                    <span
                                        aria-hidden
                                        className="grid size-6 shrink-0 place-items-center rounded-full border border-[var(--control)] text-[11px] text-muted-foreground tabular-nums"
                                    >
                                        {i + 1}
                                    </span>
                                    {i < CHAIN.length - 1 && (
                                        <span
                                            aria-hidden
                                            className="mt-1 w-px flex-1 bg-[var(--rule)]"
                                        />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[14px] font-medium">
                                        {link.step}
                                    </p>
                                    <p className="mt-1 max-w-[46ch] text-[13px] leading-5 text-muted-foreground">
                                        {link.detail}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>

                    <p className="mt-2 max-w-[52ch] border-t border-border pt-4 text-[12px] leading-5 text-muted-foreground">
                        Penugasan puskesmas mengikuti kelurahan pasien. Laporan
                        yang belum ditinjau dalam 4 hari ditandai lewat SLA.
                    </p>
                </section>
            </div>

            {/*
             * Closes the foot of the screen with the system's own rule, set as
             * a figure. One hue per line would be chrome colour, so the
             * numerals stay in ink and only the label is grey.
             */}
            <dl className="mt-16 grid gap-y-6 border-t border-border pt-6 sm:grid-cols-3 sm:gap-x-12 lg:mt-auto lg:pt-8">
                <div>
                    <dt className="text-[12px] text-muted-foreground">
                        Peran dalam alur
                    </dt>
                    <dd className="mt-1 text-[20px] font-medium tracking-[-0.01em] tabular-nums">
                        4
                    </dd>
                </div>
                <div>
                    <dt className="text-[12px] text-muted-foreground">
                        Batas tinjau puskesmas
                    </dt>
                    <dd className="mt-1 text-[20px] font-medium tracking-[-0.01em] tabular-nums">
                        4 hari
                    </dd>
                </div>
                <div>
                    <dt className="text-[12px] text-muted-foreground">
                        Penugasan wilayah
                    </dt>
                    <dd className="mt-1 text-[20px] font-medium tracking-[-0.01em]">
                        Otomatis
                    </dd>
                </div>
            </dl>
        </div>
    );
}
