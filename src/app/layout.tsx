import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { Providers } from '@/components/shell/providers';
import './globals.css';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
    display: 'swap',
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'WALI-EPI: Surveilans DBD',
    description:
        'Sistem surveilans dan penyelidikan epidemiologi Demam Berdarah Dengue lintas fasilitas kesehatan.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html
            lang="id"
            suppressHydrationWarning
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
            <body className="flex min-h-full flex-col">
                <Providers>{children}</Providers>
                <Toaster
                    position="bottom-right"
                    closeButton
                    toastOptions={{
                        classNames: {
                            toast: 'rounded-[var(--radius-card)] border border-border bg-surface text-foreground text-[13.5px] shadow-[var(--elev-pop)]',
                        },
                    }}
                />
            </body>
        </html>
    );
}
