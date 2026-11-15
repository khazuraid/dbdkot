import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { FadeIn } from '@/components/shell/fade-in';
import { AuthCardHeader } from '@/components/auth/auth-ui';
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
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
                <AuthCardHeader
                    icon="login"
                    eyebrow="Akses Terverifikasi"
                    title="Masuk Ruang Kerja"
                    description="Gunakan akun instansi kesehatan terdaftar untuk mengakses pelaporan dan penyelidikan epidemiologi."
                />
                <div className="px-6 py-5">
                    <LoginForm initialError={error} />
                </div>
            </div>
        </FadeIn>
    );
}
