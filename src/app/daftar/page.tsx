import { Suspense } from 'react';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { institutions } from '@/db/schema';
import { getPortalBranding } from '@/lib/branding';
import { FadeIn } from '@/components/shell/fade-in';
import { AuthCardHeader } from '@/components/auth/auth-ui';
import { Skeleton } from '@/components/ui/skeleton';
import { RegisterForm } from './register-form';

export const instant = false;

export const metadata: Metadata = {
    title: 'Ajukan akun',
};

async function DaftarFormSection() {
    await connection();
    const db = getDb();
    const [instList, branding] = await Promise.all([
        db
            .select({
                id: institutions.id,
                name: institutions.name,
                type: institutions.type,
                city: institutions.city,
            })
            .from(institutions)
            .where(eq(institutions.isActive, true))
            .orderBy(institutions.name),
        getPortalBranding(),
    ]);

    return (
        <RegisterForm
            institutions={instList}
            institutionName={branding.institutionName}
        />
    );
}

export default function DaftarPage() {
    return (
        <FadeIn className="w-full">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
                <AuthCardHeader
                    icon="register"
                    eyebrow="Permohonan Akun"
                    title="Ajukan Akun Instansi"
                    description="Pilih peran fasilitas (Puskesmas, RS, atau Dinkes). Kode OTP akan dikirimkan ke email untuk verifikasi awal."
                />
                <div className="px-6 py-5">
                    <Suspense
                        fallback={
                            <div className="space-y-4 py-2" aria-busy="true">
                                <div className="grid grid-cols-3 gap-2">
                                    <Skeleton className="h-16 rounded-xl" />
                                    <Skeleton className="h-16 rounded-xl" />
                                    <Skeleton className="h-16 rounded-xl" />
                                </div>
                                <Skeleton className="h-10 w-full rounded-xl" />
                                <Skeleton className="h-10 w-full rounded-xl" />
                                <Skeleton className="h-10 w-full rounded-xl" />
                                <Skeleton className="h-10 w-full rounded-xl" />
                            </div>
                        }
                    >
                        <DaftarFormSection />
                    </Suspense>
                </div>
            </div>
        </FadeIn>
    );
}
