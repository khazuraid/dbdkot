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
    // Next injects inline bootstrap and flight-data scripts, so a nonce or
    // hash cannot be precomputed here. `unsafe-inline` for scripts is what
    // remains; it is paired with everything below to keep it from being the
    // only line of defence (a compromise would need an injection point first).
    {
        key: 'Content-Security-Policy',
        value: [
            "default-src 'self'",
            `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
            // Styles stay inline: Tailwind and React both emit style attributes.
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' data: blob:",
            "font-src 'self' data: https://fonts.gstatic.com",
            // No third-party origin may be reached, including for exfiltration.
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            'upgrade-insecure-requests',
        ].join('; '),
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
