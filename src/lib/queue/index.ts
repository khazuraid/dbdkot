import { Queue } from 'bullmq';
import { QUEUE_NAMES, redisConnection, type QueueName } from './connection';

/**
 * Producers used by the Next.js app. Lazily instantiated so `next build` (which
 * imports route modules) never needs a live Redis, exactly like getDb().
 */
const globalForQueues = globalThis as unknown as {
    queues?: Map<QueueName, Queue>;
};

function registry(): Map<QueueName, Queue> {
    globalForQueues.queues ??= new Map();
    return globalForQueues.queues;
}

export function getQueue(name: QueueName): Queue {
    const queues = registry();
    let queue = queues.get(name);

    if (!queue) {
        queue = new Queue(name, {
            connection: redisConnection(),
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5_000 },
                removeOnComplete: { age: 24 * 3600, count: 1_000 },
                removeOnFail: { age: 7 * 24 * 3600 },
            },
        });
        queues.set(name, queue);
    }

    return queue;
}

export type AssignJob = { reportId: string };
/** Report id is absent on the nightly sweep, present on the per-report reminder. */
export type SlaJob = { reportId?: string };
export type NotifyJob = {
    userId: string;
    title: string;
    message: string;
    type: string;
    entityType?: string;
    entityId?: string;
};
export type ExportJob = {
    kind: 'reports-rs' | 'reports-pe' | 'dashboard';
    requestedBy: string;
    /** Resolved from the session at enqueue time; the worker never re-derives it. */
    role: 'ADMIN' | 'DINKES' | 'PUSKESMAS' | 'RUMAH_SAKIT';
    institutionId: string | null;
    filters: Record<string, unknown>;
};

export async function enqueueAssign(reportId: string) {
    // Deterministic jobId: re-enqueuing the same report must not double-assign.
    return getQueue(QUEUE_NAMES.assign).add(
        'assign',
        { reportId } satisfies AssignJob,
        { jobId: `assign-${reportId}` },
    );
}

export async function enqueueSla(reportId: string) {
    return getQueue(QUEUE_NAMES.sla).add(
        'sla-reminder',
        { reportId } satisfies SlaJob,
        // The SLA is 4 days; run then, not immediately.
        { delay: 4 * 24 * 3600 * 1000, jobId: `sla-${reportId}` },
    );
}

export async function enqueueNotification(job: NotifyJob) {
    return getQueue(QUEUE_NAMES.notify).add('notify', job);
}

export async function enqueueExport(job: ExportJob) {
    return getQueue(QUEUE_NAMES.export).add('export', job);
}
