'use client';

import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * Client-side providers for the authenticated shell.
 *
 * The query client is created lazily inside state: building it at module scope
 * would share one cache between every request the server renders.
 */
export function Providers({ children }: { children: React.ReactNode }) {
    const [client] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // The server already renders the first paint; a refetch
                        // on mount would double every list request.
                        refetchOnMount: false,
                        staleTime: 30_000,
                        retry: 1,
                    },
                },
            }),
    );

    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
        >
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        </ThemeProvider>
    );
}
