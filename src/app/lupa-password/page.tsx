import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { FadeIn } from '@/components/shell/fade-in';
import { AuthCardHeader } from '@/components/auth/auth-ui';
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
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
                <AuthCardHeader
                    icon="reset"
                    eyebrow="Pemulihan Akun"
                    title="Atur Ulang Kata Sandi"
                    description="Masukkan alamat email instansi terdaftar untuk menerima kode verifikasi OTP 6-digit dan membuat kata sandi baru."
                />
                <div className="px-6 py-5">
                    <LupaPasswordForm />
                </div>
            </div>
        </FadeIn>
    );
}
