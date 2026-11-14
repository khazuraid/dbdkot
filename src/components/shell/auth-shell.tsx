import Link from 'next/link';
import { Activity } from 'lucide-react';

const CHAIN = [
    {
        step: '01',
        actor: 'Rumah Sakit',
        desc: 'Mencatat laporan kasus klinis dan mengirim ke wilayah domisili pasien.',
    },
    {
        step: '02',
        actor: 'Puskesmas',
        desc: 'Menerima penugasan wilayah dan menjalankan Penyelidikan Epidemiologi.',
    },
    {
        step: '03',
        actor: 'Dinas Kesehatan',
        desc: 'Memverifikasi hasil PE dan memantau pola sebaran secara real-time.',
    },
];

/**
 * Split-screen clinical layout for authentication routes.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-dvh flex-col bg-[var(--ground)]">
            <main className="mx-auto grid w-full max-w-[1040px] flex-1 grid-cols-1 items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_420px] lg:gap-12">
                <section
                    aria-label="Ringkasan platform surveilans"
                    className="hidden space-y-8 pr-4 lg:block"
                >
                    <AuthMark />

                    <div className="space-y-3">
                        <h1 className="max-w-[18ch] text-[34px] leading-[1.15] font-semibold tracking-[-0.03em] text-foreground">
                            Surveilans DBD terhubung dari bangsal hingga lapangan.
                        </h1>
                        <p className="max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground">
                            WALI-EPI menyatukan pelaporan kasus Rumah Sakit,
                            penugasan Puskesmas berdasarkan kelurahan, serta
                            verifikasi Penyelidikan Epidemiologi oleh Dinas
                            Kesehatan.
                        </p>
                    </div>

                    <ol className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                        {CHAIN.map((item) => (
                            <li
                                key={item.step}
                                className="grid grid-cols-[36px_1fr] items-baseline gap-3 py-3.5"
                            >
                                <span
                                    data-numeric
                                    className="font-mono text-[12px] font-semibold text-[var(--accent)]"
                                >
                                    {item.step}
                                </span>
                                <div>
                                    <p className="text-[13.5px] font-semibold text-foreground">
                                        {item.actor}
                                    </p>
                                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                                        {item.desc}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </section>

                <div className="mx-auto w-full max-w-[420px] space-y-5">
                    <div className="lg:hidden">
                        <AuthMark />
                    </div>
                    {children}
                </div>
            </main>
        </div>
    );
}

export function AuthMark() {
    return (
        <Link
            href="/masuk"
            className="inline-flex items-center gap-2.5"
            aria-label="WALI-EPI, halaman masuk"
        >
            <span
                aria-hidden
                className="grid size-8 place-items-center rounded-[8px] bg-[var(--accent)] text-[var(--accent-ink)]"
            >
                <Activity className="size-4" strokeWidth={2.2} />
            </span>
            <span>
                <span className="block text-[15px] leading-tight font-semibold tracking-[-0.01em] text-foreground">
                    WALI-EPI
                </span>
                <span className="block text-[11.5px] text-muted-foreground">
                    Sistem Surveilans Demam Berdarah
                </span>
            </span>
        </Link>
    );
}
