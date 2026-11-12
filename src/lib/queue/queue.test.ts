import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Queue, Worker, type Job } from 'bullmq';
import { RedisMemoryServer } from 'redis-memory-server';
import { QUEUE_NAMES, redisConnection } from './connection';

/**
 * Exercises the real queue path against a real Redis (spawned for the test).
 * The point is to prove enqueue -> worker -> handler wiring and jobId
 * de-duplication, not to re-test BullMQ itself.
 */
let server: RedisMemoryServer;
let queue: Queue;
let worker: Worker;

beforeAll(async () => {
    server = await RedisMemoryServer.create();
    process.env.REDIS_URL = `redis://${await server.getHost()}:${await server.getPort()}`;

    queue = new Queue('test-queue', { connection: redisConnection() });
}, 120_000);

afterAll(async () => {
    await worker?.close();
    await queue?.close();
    await server?.stop();
});

describe('redis connection', () => {
    it('builds options from REDIS_URL', () => {
        const opts = redisConnection();
        expect(opts.url).toContain('redis://');
        expect(opts.maxRetriesPerRequest).toBeNull();
    });

    it('refuses to build without REDIS_URL', () => {
        const saved = process.env.REDIS_URL;
        delete process.env.REDIS_URL;
        expect(() => redisConnection()).toThrow('REDIS_URL');
        process.env.REDIS_URL = saved;
    });

    it('declares the four queues the worker consumes', () => {
        expect(Object.values(QUEUE_NAMES)).toEqual([
            'report-assignment',
            'pe-task-reminder',
            'notification',
            'export',
        ]);
    });
});

describe('job round trip', () => {
    it('processes a job and returns the handler result', async () => {
        const seen: string[] = [];

        worker = new Worker(
            'test-queue',
            async (job: Job) => {
                seen.push(job.name);
                return { ok: true };
            },
            { connection: redisConnection() },
        );

        await queue.add('assign', { reportId: 'r-1' });

        const deadline = Date.now() + 10_000;
        while (seen.length === 0 && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 100));
        }

        expect(seen).toEqual(['assign']);
    }, 20_000);

    it('collapses duplicate jobIds so a report cannot be assigned twice', async () => {
        const q = new Queue('dedupe-queue', { connection: redisConnection() });

        await q.add('assign', { reportId: 'r-2' }, { jobId: 'assign-r-2' });
        await q.add('assign', { reportId: 'r-2' }, { jobId: 'assign-r-2' });

        const counts = await q.getJobCounts('waiting', 'delayed', 'active');
        expect((counts.waiting ?? 0) + (counts.delayed ?? 0)).toBe(1);

        await q.close();
    }, 20_000);
});
