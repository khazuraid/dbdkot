import Link from 'next/link';
import {
    Activity,
    ArrowLeft,
    LockKeyhole,
    MailCheck,
    ShieldCheck,
} from 'lucide-react';
import { AuthTabNav } from '@/components/auth/auth-ui';
import { getPortalBranding, type PortalBranding } from '@/lib/branding';

const CHAIN = [
    {
        step: '01',
        actor: 'Rumah Sakit',
        desc: 'Mencatat kasus klinis dan meneruskan laporan ke domisili pasien.',
    },
    {
        step: '02',
        actor: 'Puskesmas',
        desc: 'Menerima penugasan wilayah dan menjalankan Penyelidikan Epidemiologi.',
    },
    {
        step: '03',
        actor: 'Dinas Kesehatan',
        desc: 'Memverifikasi hasil PE dan memantau klaster sebaran secara real-time.',
    },
];

const SECURITY_PILLS = [
    { icon: LockKeyhole, label: 'PII AES-256-GCM' },
    { icon: MailCheck, label: 'Verifikasi OTP Email' },
    { icon: ShieldCheck, label: 'Proteksi Brute-Force' },
];

/**
 * Synchronized clinical split-screen shell for /masuk, /daftar, and /lupa-password.
 */
export async function AuthShell({ children }: { children: React.ReactNode }) {
    const branding = await getPortalBranding();

    return (
        <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[var(--ground)]">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_15%_10%,var(--accent-soft),transparent_65%)] opacity-45 dark:opacity-20"
            />

            <main className="relative mx-auto grid w-full max-w-[1120px] flex-1 grid-cols-1 items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_460px] lg:gap-14 lg:py-12">
                <section
                    aria-label="Ringkasan platform surveilans"
                    className="hidden space-y-8 pr-2 lg:block"
                >
                    <div className="flex items-center justify-between gap-4">
                        <AuthMark branding={branding} />
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)]/80 px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <ArrowLeft className="size-3.5" />
                            <span>Beranda Publik</span>
                        </Link>
                    </div>

                    <div className="space-y-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-2.5 py-1 font-mono text-[10.5px] font-semibold tracking-wider text-[var(--accent)] uppercase">
                            Portal Surveilans · {branding.institutionName}
                        </span>
                        <h1 className="max-w-[19ch] text-[34px] leading-[1.14] font-semibold tracking-[-0.03em] text-foreground">
                            Surveilans DBD terhubung dari bangsal hingga lapangan.
                        </h1>
                        <p className="max-w-[46ch] text-[14.5px] leading-relaxed text-muted-foreground">
                            {branding.title} menyatukan pelaporan kasus Rumah Sakit,
                            penugasan Puskesmas per kelurahan, serta verifikasi
                            Penyelidikan Epidemiologi oleh {branding.institutionName}.
                        </p>
                    </div>

                    <ol className="space-y-2.5 border-l-2 border-[var(--accent)]/25 pl-4">
                        {CHAIN.map((c) => (
                            <li
                                key={c.step}
                                className="rounded-xl border border-[var(--border)]/80 bg-[var(--surface)]/80 px-4 py-3 backdrop-blur-xs"
                            >
                                <div className="flex items-baseline gap-2.5">
                                    <span
                                        data-numeric
                                        className="font-mono text-[11px] font-semibold text-[var(--accent)] tabular-nums"
                                    >
                                        {c.step}
                                    </span>
                                    <span className="text-[13.5px] font-semibold text-foreground">
                                        {c.actor}
                                    </span>
                                </div>
                                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                                    {c.desc}
                                </p>
                            </li>
                        ))}
                    </ol>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        {SECURITY_PILLS.map((pill) => {
                            const Icon = pill.icon;
                            return (
                                <span
                                    key={pill.label}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground"
                                >
                                    <Icon className="size-3.5 text-[var(--accent)]" />
                                    {pill.label}
                                </span>
                            );
                        })}
                    </div>
                </section>

                <section className="mx-auto w-full max-w-[460px]">
                    <div className="mb-5 flex items-center justify-between gap-3 lg:hidden">
                        <AuthMark branding={branding} />
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="size-3.5" />
                            <span>Beranda</span>
                        </Link>
                    </div>

                    <AuthTabNav />
                    {children}
                </section>
            </main>

            <footer className="relative border-t border-[var(--rule)] bg-[var(--surface)]/50 px-4 py-3.5 text-center text-[12px] text-muted-foreground sm:px-6">
                {branding.title} · {branding.footerText}
            </footer>
        </div>
    );
}

export function AuthMark({
    branding,
}: {
    branding?: Pick<PortalBranding, 'title' | 'tagline' | 'logoUrl'>;
}) {
    const title = branding?.title || 'WALI-EPI';
    const tagline = branding?.tagline || 'Surveilans DBD';
    const logoUrl = branding?.logoUrl ?? null;
    return (
        <Link href="/" className="inline-flex items-center gap-2.5 group">
            <span className="grid size-9 place-items-center overflow-hidden rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] shadow-xs transition-transform group-hover:scale-[1.03]">
                {logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        src={logoUrl}
                        alt={title}
                        className="size-9 object-contain"
                    />
                ) : (
                    <Activity className="size-[18px]" strokeWidth={2} />
                )}
            </span>
            <span className="flex flex-col leading-none">
                <span className="text-[14px] font-semibold tracking-tight text-foreground">
                    {title}
                </span>
                <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                    {tagline}
                </span>
            </span>
        </Link>
    );
}
