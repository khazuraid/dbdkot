import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { getDb } from '@/db';
import { account, session, user, verification } from '@/db/schema';
import { ROLES } from './roles';

export const auth = betterAuth({
    database: drizzleAdapter(getDb(), {
        provider: 'pg',
        schema: { user, session, account, verification },
    }),
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 10,
        requireEmailVerification: false,
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
