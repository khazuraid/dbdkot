import Link from 'next/link';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RootNotFound() {
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--ground)] p-4 text-center">
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
                <div className="flex size-12 items-center justify-center rounded-full bg-[var(--raised)] text-muted-foreground">
                    <FileQuestion className="size-6" aria-hidden />
                </div>
                <div className="space-y-1.5">
                    <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                        Halaman Tidak Ditemukan
                    </h1>
                    <p className="text-[13px] text-muted-foreground">
                        Tautan atau berkas surveilans DBD yang Anda cari tidak tersedia atau telah dipindahkan.
                    </p>
                </div>
                <div className="pt-2">
                    <Button asChild size="sm">
                        <Link href="/dasbor">
                            <ArrowLeft className="mr-1.5 size-3.5" data-icon="inline-start" />
                            Kembali ke Dasbor
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
