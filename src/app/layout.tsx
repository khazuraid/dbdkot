import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { Providers } from '@/components/shell/providers';
import './globals.css';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: 'WALI-EPI — SiLapor DBD',
    description: 'Sistem surveilans Demam Berdarah Dengue',
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
                {/* Alert region, not a dialog: it must not steal focus, and it
                    must announce itself to a screen reader on its own. */}
                <Toaster
                    position="bottom-right"
                    closeButton
                    toastOptions={{
                        classNames: {
                            toast: 'rounded-[var(--radius-card)] border border-border text-[13px]',
                        },
                    }}
                />
            </body>
        </html>
    );
}
