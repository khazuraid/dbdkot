import type { RedisOptions } from 'bullmq';

/**
 * BullMQ 6 describes the Redis connection itself (it no longer accepts raw
 * ioredis options), so this is the single place producers and consumers agree.
 */
export function redisConnection(): RedisOptions {
    const url = process.env.REDIS_URL;

    if (!url) {
        throw new Error('REDIS_URL is not set');
    }

    return {
        url,
        // BullMQ blocks on BRPOPLPUSH; a retry cap would abort that.
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
    };
}

export const QUEUE_NAMES = {
    assign: 'report-assignment',
    whatsappDispatch: 'whatsapp-dispatch',
    sla: 'pe-task-reminder',
    clusterDetector: 'cluster-detector',
    foggingScheduler: 'fogging-scheduler',
    notify: 'notification',
    export: 'export',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
