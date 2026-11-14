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
export type SlaJob = {
    reportId?: string;
    phase?: 'ASSIGN_WARNING_6H' | 'ASSIGN_BREACH_24H' | 'PE_WARNING_48H' | 'PE_BREACH_72H';
};
export type WhatsAppDispatchJob = {
    recipientPhone: string;
    recipientRole?: string | null;
    institutionId?: string | null;
    reportRSId?: string | null;
    eventKind:
        | 'ASSIGNMENT'
        | 'SLA_WARNING_6H'
        | 'SLA_ESCALATION_24H'
        | 'PE_SLA_WARNING'
        | 'FOGGING_REQUIRED'
        | 'FOGGING_H_MINUS_1'
        | 'FOGGING_DAY_0'
        | 'CROSS_BORDER'
        | 'TEST';
    message: string;
};
export type ClusterDetectorJob = { reportId: string };
export type FoggingSchedulerJob = {
    reportRSId: string;
    cycleNumber: 2;
    phase: 'H_MINUS_1' | 'DAY_0';
};
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
    // 18h warning (6h remaining before 24h deadline) + 24h breach escalation.
    await getQueue(QUEUE_NAMES.sla).add(
        'sla-assign-warning-6h',
        { reportId, phase: 'ASSIGN_WARNING_6H' } satisfies SlaJob,
        { delay: 18 * 3600 * 1000, jobId: `sla-warn-6h-${reportId}` },
    );
    return getQueue(QUEUE_NAMES.sla).add(
        'sla-reminder',
        { reportId, phase: 'ASSIGN_BREACH_24H' } satisfies SlaJob,
        { delay: 24 * 3600 * 1000, jobId: `sla-${reportId}` },
    );
}

export async function enqueuePeSla(reportId: string) {
    return getQueue(QUEUE_NAMES.sla).add(
        'sla-pe-72h',
        { reportId, phase: 'PE_BREACH_72H' } satisfies SlaJob,
        { delay: 72 * 3600 * 1000, jobId: `sla-pe-${reportId}` },
    );
}

export async function enqueueWhatsAppDispatch(job: WhatsAppDispatchJob) {
    return getQueue(QUEUE_NAMES.whatsappDispatch).add('whatsapp-dispatch', job);
}

export async function enqueueClusterDetector(reportId: string) {
    return getQueue(QUEUE_NAMES.clusterDetector).add(
        'cluster-detector',
        { reportId } satisfies ClusterDetectorJob,
        { jobId: `cluster-${reportId}` },
    );
}

export async function enqueueFoggingReminders(
    reportRSId: string,
    scheduledCycle2Date: Date,
) {
    const now = Date.now();
    const day0Delay = Math.max(0, scheduledCycle2Date.getTime() - now);
    const hMinus1Delay = Math.max(
        0,
        scheduledCycle2Date.getTime() - 24 * 3600 * 1000 - now,
    );

    await getQueue(QUEUE_NAMES.foggingScheduler).add(
        'fogging-h-minus-1',
        {
            reportRSId,
            cycleNumber: 2,
            phase: 'H_MINUS_1',
        } satisfies FoggingSchedulerJob,
        { delay: hMinus1Delay, jobId: `fogging-c2-hm1-${reportRSId}` },
    );

    return getQueue(QUEUE_NAMES.foggingScheduler).add(
        'fogging-day-0',
        {
            reportRSId,
            cycleNumber: 2,
            phase: 'DAY_0',
        } satisfies FoggingSchedulerJob,
        { delay: day0Delay, jobId: `fogging-c2-d0-${reportRSId}` },
    );
}

export async function enqueueNotification(job: NotifyJob) {
    return getQueue(QUEUE_NAMES.notify).add('notify', job);
}

export async function enqueueExport(job: ExportJob) {
    return getQueue(QUEUE_NAMES.export).add('export', job);
}
