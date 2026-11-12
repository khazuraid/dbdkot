import { sql } from 'drizzle-orm';
import { getDb } from '@/db';

/**
 * Liveness and readiness for the container orchestrator.
 *
 * `/api/health` answers "is the process serving HTTP" and must not touch the
 * database: a slow query would mark a healthy container unhealthy and get it
 * restarted mid-request. `/api/health?ready=1` also checks the database, which
 * is what a deploy gate wants.
 *
 * Redis is deliberately not probed. The web app reads the database; only the
 * worker uses Redis, and it runs as a separate process. Failing the web app's
 * health check because the queue is down would take the site offline for a
 * problem the site does not have.
 *
 * No `requireActor`, no cookie read: a health check that needs a session is
 * useless to the thing making the request.
 *
 * No `export const dynamic`: this config rejects route segment config, and it
 * is unnecessary here — reading the request URL already opts the handler into
 * per-request rendering.
 */
export async function GET(request: Request) {
    const ready = new URL(request.url).searchParams.get('ready') === '1';

    if (!ready) {
        return Response.json({ status: 'ok' });
    }

    try {
        // A round trip, not just a pool check: the pool can accept a
        // connection while the server still refuses to answer.
        await getDb().execute(sql`select 1`);
        return Response.json({ status: 'ok', database: 'ok' });
    } catch (error) {
        // The reason is logged, not returned: a health endpoint is
        // unauthenticated, and a connection string in an error message is a
        // credential leak.
        console.error('health: database check failed', error);
        return Response.json(
            { status: 'error', database: 'unreachable' },
            { status: 503 },
        );
    }
}
