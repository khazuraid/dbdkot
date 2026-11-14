import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';
import { auth } from '@/lib/auth';
import { FadeIn } from '@/components/shell/fade-in';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
} from '@/components/ui/card';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
    title: 'Masuk: WALI-EPI',
};

export const instant = false;

export default async function MasukPage({
    searchParams,
}: {
    searchParams: Promise<{ error?: string }>;
}) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user) redirect('/dasbor');

    const { error } = await searchParams;

    return (
        <FadeIn className="w-full">
            <Card className="gap-0 py-0">
                <CardHeader className="gap-1.5 border-b border-[var(--rule)] px-6 py-5">
                    <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">
                        Masuk ke ruang kerja
                    </h2>
                    <CardDescription className="text-[13px] leading-relaxed">
                        Gunakan akun instansi terdaftar untuk mengakses data
                        pelaporan dan penyelidikan epidemiologi.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 px-6 py-5">
                    {error === 'disabled' && (
                        <div
                            role="alert"
                            className="flex items-start gap-2.5 rounded-[var(--radius-control)] border border-[var(--pill-negative-border)] bg-[var(--pill-negative-bg)] px-3.5 py-2.5 text-[13px] text-[var(--pill-negative-ink)]"
                        >
                            <ShieldCheck
                                className="mt-0.5 size-4 shrink-0"
                                aria-hidden
                            />
                            <span>
                                Akun Anda sedang dinonaktifkan. Hubungi
                                administrator Dinas Kesehatan untuk mengaktifkan
                                kembali akses.
                            </span>
                        </div>
                    )}

                    <LoginForm />
                </CardContent>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--rule)] bg-[var(--raised)]/45 px-6 py-3.5 text-[12.5px] text-muted-foreground">
                    <span>Belum memiliki akses staf?</span>
                    <Link
                        href="/daftar"
                        className="font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
                    >
                        Ajukan akun
                    </Link>
                </div>
            </Card>
        </FadeIn>
    );
}
