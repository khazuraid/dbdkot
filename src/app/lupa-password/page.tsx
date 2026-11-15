import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { FadeIn } from '@/components/shell/fade-in';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
} from '@/components/ui/card';
import { LupaPasswordForm } from './lupa-password-form';

export const instant = false;

export const metadata: Metadata = {
    title: 'Lupa Kata Sandi: WALI-EPI',
};

export default async function LupaPasswordPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user) redirect('/dasbor');

    return (
        <FadeIn className="w-full">
            <Card className="gap-0 py-0">
                <CardHeader className="gap-1.5 border-b border-[var(--rule)] px-6 py-5">
                    <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">
                        Atur ulang kata sandi
                    </h2>
                    <CardDescription className="text-[13px] leading-relaxed">
                        Masukkan alamat email instansi Anda untuk menerima kode verifikasi OTP
                        dan membuat kata sandi baru.
                    </CardDescription>
                </CardHeader>

                <CardContent className="px-6 py-5">
                    <LupaPasswordForm />
                </CardContent>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--rule)] bg-[var(--raised)]/45 px-6 py-3.5 text-[12.5px] text-muted-foreground">
                    <span>Sudah ingat kata sandi?</span>
                    <Link
                        href="/masuk"
                        className="font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
                    >
                        Kembali masuk
                    </Link>
                </div>
            </Card>
        </FadeIn>
    );
}
