import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { getDb } from '@/db';
import { account, session, user, verification } from '@/db/schema';
import { ROLES } from './roles';

export const auth = betterAuth({
    // Without this, better-auth falls back to an internal default: sessions
    // signed with one value become invalid the moment the fallback shifts, and
    // a known default lets anyone forge a cookie in production. Passed
    // explicitly so the value is owned by the deployment, not the library.
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
        provider: 'pg',
        schema: { user, session, account, verification },
    }),
    // The app has no self-registration screen: an administrator creates every
    // account. Leaving sign-up reachable meant anyone could POST
    // /api/auth/sign-up/email and mint a live session in a PUSKESMAS tenant.
    emailAndPassword: {
        enabled: true,
        disableSignUp: true,
        minPasswordLength: 10,
        requireEmailVerification: false,
    },
    // Rejects cross-site POSTs with a valid-looking Origin; the cookie is
    // SameSite anyway, but auth endpoints are the one place worth both.
    trustedOrigins: [process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'],
    rateLimit: {
        enabled: true,
        window: 60,
        max: 20,
        customRules: {
            // Credential stuffing: sign-in gets a much tighter budget than
            // the read endpoints a page refresh hits.
            '/sign-in/email': { window: 60, max: 5 },
        },
    },
    user: {
        additionalFields: {
            role: {
                type: [...ROLES],
                required: false,
                defaultValue: 'PUSKESMAS',
                // Server-owned: registration must never pick its own role (C1).
                input: false,
            },
            institutionId: {
                type: 'string',
                required: false,
                input: false,
            },
            isActive: {
                type: 'boolean',
                required: false,
                defaultValue: true,
                input: false,
            },
        },
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
    },
    advanced: {
        // IDs come from the Drizzle schema's uuid().defaultRandom(), so
        // better-auth must generate a UUID, not its default 32-char string.
        database: { generateId: 'uuid' },
    },
    plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
