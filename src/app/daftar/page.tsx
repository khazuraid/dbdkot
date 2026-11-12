import Link from 'next/link';
import type { Metadata } from 'next';
import { RegisterForm } from './register-form';

export const metadata: Metadata = {
    title: 'Ajukan akun — WALI-EPI',
};

/** What happens after the form is sent. Three steps, so it is a sequence. */
const REVIEW = [
    {
        step: 'Diajukan',
        detail:
            'Akun tersimpan dengan status menunggu. Belum bisa dipakai masuk.',
    },
    {
        step: 'Ditinjau',
        detail:
            'Administrator Dinas Kesehatan menetapkan peran dan institusi akhir.',
    },
    {
        step: 'Disetujui',
        detail:
            'Setelah disetujui, akun bisa dipakai masuk dengan email yang sama.',
    },
];

export default function DaftarPage() {
    return (
        <div className="flex flex-1 flex-col">
            <div className="grid items-start gap-x-16 gap-y-12 pt-10 md:pt-16 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:pt-24">
                <div>
                    <h1 className="text-[24px] font-medium tracking-[-0.02em]">
                        Ajukan akun
                    </h1>
                    <p className="mt-1.5 max-w-[52ch] text-[14px] leading-6 text-muted-foreground">
                        Untuk staf fasilitas kesehatan yang belum punya akun.
                        Setelah diajukan, akun ditinjau administrator Dinas
                        Kesehatan sebelum bisa dipakai.
                    </p>

                    <RegisterForm />

                    <p className="mt-6 text-[12px] text-muted-foreground">
                        Sudah punya akun?{' '}
                        <Link
                            href="/masuk"
                            className="underline decoration-[var(--control)] underline-offset-4 hover:text-foreground"
                        >
                            Masuk
                        </Link>
                    </p>
                </div>

                <section aria-labelledby="tinjau" className="hidden lg:block">
                    <h2
                        id="tinjau"
                        className="text-[12px] text-muted-foreground"
                    >
                        Setelah diajukan
                    </h2>
                    <ol className="mt-4">
                        {REVIEW.map((item, i) => (
                            <li
                                key={item.step}
                                className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 py-4"
                            >
                                <div className="flex flex-col items-center">
                                    <span
                                        aria-hidden
                                        className="grid size-6 shrink-0 place-items-center rounded-full border border-[var(--control)] text-[11px] tabular-nums text-muted-foreground"
                                    >
                                        {i + 1}
                                    </span>
                                    {i < REVIEW.length - 1 && (
                                        <span
                                            aria-hidden
                                            className="mt-1 w-px flex-1 bg-[var(--rule)]"
                                        />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[14px] font-medium">
                                        {item.step}
                                    </p>
                                    <p className="mt-1 max-w-[46ch] text-[13px] leading-5 text-muted-foreground">
                                        {item.detail}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>

                    <p className="mt-2 max-w-[52ch] border-t border-border pt-4 text-[12px] leading-5 text-muted-foreground">
                        Selama menunggu, login akan ditolak. Itu bukan kesalahan
                        password — akun memang belum aktif.
                    </p>
                </section>
            </div>
        </div>
    );
}
