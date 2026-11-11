import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * The prototype shipped no security headers at all (§3.3). CSP is the load
 * bearing one here: attachments used to be served `inline` with a
 * client-controlled extension, which is stored XSS via SVG/HTML.
 */
const securityHeaders = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(self)',
    },
    {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
    },
    // Next injects inline bootstrap scripts; dev additionally needs eval.
    {
        key: 'Content-Security-Policy',
        value: [
            "default-src 'self'",
            `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
        ].join('; '),
    },
];

const nextConfig: NextConfig = {
    cacheComponents: true,
    partialPrefetching: true,
    poweredByHeader: false,
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
