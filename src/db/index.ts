import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
    sql?: ReturnType<typeof postgres>;
    db?: ReturnType<typeof drizzle<typeof schema>>;
};

/**
 * Lazy so that merely importing this module (e.g. while Next collects page data
 * during `next build`, or in a unit test) never opens a connection or requires
 * DATABASE_URL. Missing config surfaces on first real query instead.
 */
export function getDb() {
    if (!globalForDb.db) {
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
            throw new Error('DATABASE_URL is not set');
        }

        globalForDb.sql ??= postgres(connectionString, {
            max: process.env.NODE_ENV === 'production' ? 10 : 1,
            prepare: false,
        });

        globalForDb.db = drizzle(globalForDb.sql, { schema });
    }

    return globalForDb.db;
}

export type DB = ReturnType<typeof getDb>;
