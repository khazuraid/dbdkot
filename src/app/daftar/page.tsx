import { Suspense } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { institutions } from '@/db/schema';
import { FadeIn } from '@/components/shell/fade-in';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RegisterForm } from './register-form';

export const instant = false;

export const metadata: Metadata = {
    title: 'Ajukan akun: WALI-EPI',
};

const REVIEW = ['Verifikasi OTP', 'Ditinjau Dinkes', 'Akun Aktif'];

async function DaftarFormSection() {
    await connection();
    const db = getDb();
    const instList = await db
        .select({
            id: institutions.id,
            name: institutions.name,
            type: institutions.type,
            city: institutions.city,
        })
        .from(institutions)
        .where(eq(institutions.isActive, true))
        .orderBy(institutions.name);

    return <RegisterForm institutions={instList} />;
}

export default function DaftarPage() {
    return (
        <FadeIn className="w-full">
            <Card className="gap-0 py-0">
                <CardHeader className="gap-1.5 border-b border-[var(--rule)] px-6 py-5">
                    <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">
                        Ajukan akun instansi
                    </h2>
                    <CardDescription className="text-[13px] leading-relaxed">
                        Pilih peran instansi (Dinas Kesehatan, Rumah Sakit, atau Puskesmas).
                        Permohonan diverifikasi via kode OTP email lalu ditinjau administrator.
                    </CardDescription>
                </CardHeader>

                <CardContent className="px-6 py-5">
                    <Suspense
                        fallback={
                            <div className="space-y-4">
                                <Skeleton className="h-9 w-full" />
                                <Skeleton className="h-9 w-full" />
                                <Skeleton className="h-9 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        }
                    >
                        <DaftarFormSection />
                    </Suspense>
                </CardContent>

                <div className="space-y-3 border-t border-[var(--rule)] bg-[var(--raised)]/45 px-6 py-3.5">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
                        <span className="font-medium text-foreground">
                            Alur aktivasi:
                        </span>
                        {REVIEW.map((step, i) => (
                            <span
                                key={step}
                                className="inline-flex items-center gap-1"
                            >
                                <span
                                    data-numeric
                                    className="font-mono text-[11px] font-semibold text-[var(--accent)]"
                                >
                                    0{i + 1}
                                </span>
                                <span>{step}</span>
                            </span>
                        ))}
                    </p>
                    <p className="text-[12.5px] text-muted-foreground">
                        Sudah punya akun aktif?{' '}
                        <Link
                            href="/masuk"
                            className="font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
                        >
                            Masuk di sini
                        </Link>
                    </p>
                </div>
            </Card>
        </FadeIn>
    );
}
