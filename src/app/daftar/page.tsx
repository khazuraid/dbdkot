import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthMark } from '@/components/shell/auth-shell';
import { FadeIn } from '@/components/shell/fade-in';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
} from '@/components/ui/card';
import { RegisterForm } from './register-form';

export const metadata: Metadata = {
    title: 'Ajukan akun — WALI-EPI',
};

/** What happens after the form is sent. Three steps, so it is a sequence. */
const REVIEW = ['Diajukan', 'Ditinjau', 'Disetujui'];

export default function DaftarPage() {
    return (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
            <FadeIn className="w-full max-w-[440px]">
                <Card className="gap-0 rounded-xl border border-border py-0 [--tw-ring-shadow:none] [--tw-ring-color:transparent] shadow-none">
                    <CardHeader className="gap-1.5 border-b border-border px-6 py-5">
                        <AuthMark />
                        <h1 className="mt-3 text-[20px] font-medium tracking-[-0.01em]">
                            Ajukan akun
                        </h1>
                        <CardDescription className="text-[13px] leading-5">
                            Untuk staf fasilitas kesehatan yang belum punya
                            akun. Ditinjau administrator Dinas Kesehatan
                            sebelum bisa dipakai.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="px-6 pt-5 pb-5">
                        <RegisterForm />
                    </CardContent>

                    <div className="border-t border-border px-6 py-3.5">
                        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-muted-foreground">
                            <span className="text-foreground">Proses:</span>
                            {REVIEW.map((step, i) => (
                                <span
                                    key={step}
                                    className="flex items-center gap-1.5"
                                >
                                    {i > 0 && (
                                        <span aria-hidden className="opacity-40">
                                            →
                                        </span>
                                    )}
                                    {step}
                                </span>
                            ))}
                        </p>
                        <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
                            Sudah punya akun?{' '}
                            <Link
                                href="/masuk"
                                className="text-foreground underline decoration-[var(--control)] underline-offset-4 hover:decoration-foreground"
                            >
                                Masuk
                            </Link>
                        </p>
                    </div>
                </Card>
            </FadeIn>
        </div>
    );
}
