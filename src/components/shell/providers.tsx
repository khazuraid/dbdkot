'use client';

import { ThemeProvider } from 'next-themes';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useState } from 'react';

/**
 * Client-side providers for the application shell.
 */
export function Providers({
    children,
    nonce,
}: {
    children: React.ReactNode;
    nonce?: string;
}) {
    const [client] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        refetchOnMount: false,
                        staleTime: 30_000,
                        retry: 1,
                    },
                },
            }),
    );

    return (
        <NuqsAdapter>
            <ThemeProvider
                attribute="class"
                defaultTheme="light"
                enableSystem
                disableTransitionOnChange
                nonce={nonce}
            >
                <QueryClientProvider client={client}>
                    <MotionConfig reducedMotion="user">
                        {children}
                    </MotionConfig>
                </QueryClientProvider>
            </ThemeProvider>
        </NuqsAdapter>
    );
}
