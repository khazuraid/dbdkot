import Link from 'next/link';
import type { Metadata } from 'next';
import { RegisterForm } from './register-form';

export const metadata: Metadata = {
    title: 'Ajukan akun — WALI-EPI',
};

export default function DaftarPage() {
    return (
        <div>
            <h1 className="text-[24px] font-medium tracking-tight">
                Ajukan akun
            </h1>
            <p className="mt-1 max-w-[52ch] text-[14px] text-muted-foreground">
                Untuk staf fasilitas kesehatan yang belum punya akun. Setelah
                diajukan, akun ditinjau administrator Dinas Kesehatan sebelum
                bisa dipakai.
            </p>

            <RegisterForm />

            <p className="mt-6 text-[12px] text-muted-foreground">
                Sudah punya akun?{' '}
                <Link href="/masuk" className="underline">
                    Masuk
                </Link>
            </p>
        </div>
    );
}
