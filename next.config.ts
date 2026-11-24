import type { NextConfig } from 'next';

/**
 * Static baseline security headers. Per-request Content-Security-Policy with
 * cryptographic nonces is applied in `src/proxy.ts`.
 */
const securityHeaders = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(self)',
    },
    {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
    },
];

const nextConfig: NextConfig = {
    cacheComponents: true,
    partialPrefetching: true,
    poweredByHeader: false,
    serverExternalPackages: ['@react-pdf/renderer'],
    turbopack: {
        rules: {
            '*.css': {
                loaders: ['@tailwindcss/turbopack'],
                as: '*.css',
            },
        },
    },
    // No `https://**` wildcard: image hosts are explicit.
    images: {
        remotePatterns: [],
    },
    // The container runs `node server.js` from a traced bundle; without this
    // `next build` writes only `.next/`, and the Dockerfile has nothing to copy.
    output: 'standalone',
    async headers() {
        return [
            {
                source: '/:path*',
                headers: securityHeaders,
            },
            {
                // User uploads must never be sniffed into a script or rendered inline.
                source: '/attachments/:path*',
                headers: [
                    { key: 'Content-Disposition', value: 'attachment' },
                    {
                        key: 'Content-Security-Policy',
                        value: "default-src 'none'; sandbox",
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
