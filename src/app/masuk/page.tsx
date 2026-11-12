import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';
import { auth } from '@/lib/auth';
import { FadeIn } from '@/components/shell/fade-in';
import { AuthMark } from '@/components/shell/auth-shell';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
    title: 'Masuk — WALI-EPI',
};

// The session check reads cookies, so the shell cannot be prerendered; same
// opt-out as every other route that reads request data.
export const instant = false;

/** The reporting chain from README, compressed to one line under the card. */
const CHAIN = ['Rumah sakit', 'Puskesmas', 'PE', 'Dinkes'];

export default async function MasukPage() {
    // A live session that lands here is already past this screen.
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user) redirect('/dasbor');

    return (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
            <FadeIn className="w-full max-w-[400px]">
                {/*
                 * The stock Card draws `ring-1`, which compiles into the
                 * shadow stack and is read as a floating panel. The sheet
                 * separates surfaces with a 1px edge and no shadow at rest,
                 * so the ring is cleared and a border takes its place.
                 */}
                <Card className="gap-0 rounded-xl border border-border py-0 [--tw-ring-shadow:none] [--tw-ring-color:transparent] shadow-none">
                    <CardHeader className="gap-1.5 border-b border-border px-6 py-5">
                        <AuthMark />
                        <h1 className="mt-3 text-[20px] font-medium tracking-[-0.01em]">
                            Masuk
                        </h1>
                        <CardDescription className="text-[13px] leading-5">
                            Sistem surveilans DBD. Gunakan akun yang sudah
                            disetujui Dinas Kesehatan.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="px-6 pt-5 pb-4">
                        <LoginForm />
                    </CardContent>

                    <Separator />

                    <div className="px-6 py-4">
                        <p className="flex items-start gap-2 text-[12px] leading-5 text-muted-foreground">
                            <ShieldCheck
                                aria-hidden
                                className="mt-0.5 size-3.5 shrink-0"
                                strokeWidth={1.5}
                            />
                            <span>
                                Belum punya akun?{' '}
                                <Link
                                    href="/daftar"
                                    className="text-foreground underline decoration-[var(--control)] underline-offset-4 hover:decoration-foreground"
                                >
                                    Ajukan akun
                                </Link>{' '}
                                — ditinjau administrator sebelum bisa dipakai.
                            </span>
                        </p>
                    </div>
                    <div className="border-t border-border px-6 py-3.5">
                        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-muted-foreground">
                            <span className="text-foreground">Alur:</span>
                            {CHAIN.map((step, i) => (
                                <span key={step} className="flex items-center gap-1.5">
                                    {i > 0 && (
                                        <span aria-hidden className="opacity-40">
                                            →
                                        </span>
                                    )}
                                    {step}
                                </span>
                            ))}
                        </p>
                    </div>
                </Card>
            </FadeIn>
        </div>
    );
}
