import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { Providers } from '@/components/shell/providers';
import { getPortalBranding } from '@/lib/branding';
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

export async function generateMetadata(): Promise<Metadata> {
    const branding = await getPortalBranding();
    return {
        title: {
            default: `${branding.title}: ${branding.tagline}`,
            template: `%s · ${branding.title}`,
        },
        description:
            branding.footerText ||
            'Sistem surveilans dan penyelidikan epidemiologi Demam Berdarah Dengue lintas fasilitas kesehatan.',
        ...(branding.faviconUrl
            ? { icons: { icon: branding.faviconUrl } }
            : {}),
    };
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    interactiveWidget: 'resizes-content',
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#ffffff' },
        { media: '(prefers-color-scheme: dark)', color: '#09090b' },
    ],
};

// Per-request CSP nonce (src/proxy.ts) requires dynamic rendering on all routes.
export const instant = false;

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const nonce = (await headers()).get('x-nonce') ?? undefined;

    return (
        <html
            lang="id"
            suppressHydrationWarning
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
            <body className="flex min-h-full flex-col">
                <Providers nonce={nonce}>{children}</Providers>
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
