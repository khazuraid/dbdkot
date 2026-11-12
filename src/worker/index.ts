import { Worker, type Job } from 'bullmq';
import { QUEUE_NAMES, redisConnection } from '@/lib/queue/connection';
import type { AssignJob, ExportJob, NotifyJob, SlaJob } from '@/lib/queue';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { reportsRS } from '@/db/schema';
import {
    assignReportByKelurahan,
    findOverdueReportIds,
    findUnassignedReportIds,
} from '@/lib/domain/assignment';
import { insertNotifications } from '@/lib/domain/notify';
import { buildReportExport } from '@/lib/domain/export';

/**
 * Worker process. Started with `npm run worker`, never inside the Next server:
 * a long job must not occupy a web request, and a restart of the web app must
 * not kill in-flight work.
 */

async function handleAssign(job: Job<AssignJob>) {
    if (typeof job.data?.reportId !== 'string' || !job.data.reportId) {
        throw new Error('assign job missing reportId');
    }

    const result = await assignReportByKelurahan(job.data.reportId);

    // `assigned` is only true when this call performed the UPDATE, so two
    // workers racing the same report cannot both notify.
    if (result.assigned) {
        await insertNotifications(
            { kind: 'INSTITUTION', institutionId: result.puskesmasId },
            {
                title: 'Laporan baru ditugaskan',
                message: `Laporan ${job.data.reportId} menunggu verifikasi Puskesmas.`,
                type: 'ASSIGNMENT',
                entityType: 'REPORT_RS',
                entityId: job.data.reportId,
            },
        );
    }

    return result;
}

async function handleSla(job: Job<SlaJob>) {
    // Two shapes share this queue: the delayed per-report reminder enqueued at
    // creation, and the nightly sweep whose job carries no report id.
    const ids = job.data.reportId
        ? [job.data.reportId]
        : await findOverdueReportIds();
    let reminded = 0;

    for (const reportId of ids) {
        // The sweep re-reads the row: a report accepted since the job was
        // queued must not produce a breach notice.
        const [row] = await getDb()
            .select({
                status: reportsRS.status,
                reviewedAt: reportsRS.puskesmasReviewedAt,
                assignedPuskesmasId: reportsRS.assignedPuskesmasId,
            })
            .from(reportsRS)
            .where(eq(reportsRS.id, reportId))
            .limit(1);

        if (!row || row.status !== 'ASSIGNED' || row.reviewedAt) {
            continue;
        }

        // The unique index (notifications_sla_once_per_day) is the arbiter: the
        // delayed job and the nightly sweep may both reach here at once, and
        // the loser's insert is dropped rather than double-notified.
        if (row.assignedPuskesmasId) {
            await insertNotifications(
                { kind: 'INSTITUTION', institutionId: row.assignedPuskesmasId },
                {
                    title: 'Laporan belum ditinjau',
                    message: `Laporan ${reportId} melewati tenggat 4 hari.`,
                    type: 'SLA_BREACH',
                    entityType: 'REPORT_RS',
                    entityId: reportId,
                },
            );
        }

        await insertNotifications(
            { kind: 'ROLE', role: 'DINKES' },
            {
                title: 'Laporan melewati SLA 4 hari',
                message: `Laporan ${reportId} belum ditindaklanjuti Puskesmas.`,
                type: 'SLA_BREACH',
                entityType: 'REPORT_RS',
                entityId: reportId,
            },
        );

        reminded += 1;
    }

    return { reminded };
}

/**
 * Second nightly pass: reports that were committed to the database but whose
 * assignment job never reached Redis (Redis was down, worker restarted). The
 * enqueue is retried here, which is what makes F10 recoverable instead of a
 * silent dead end.
 */
async function handleReconcile() {
    const ids = await findUnassignedReportIds();
    let requeued = 0;

    for (const reportId of ids) {
        // Deterministic jobId means an already-queued job is not duplicated.
        const result = await assignReportByKelurahan(reportId);

        if (result.assigned) {
            requeued += 1;
            continue;
        }

        if (result.reason === 'NO_MATCH') {
            // Nothing can be done automatically. The reporting hospital needs
            // to know its case is not with anyone yet, and Dinkes is the party
            // that can fix the coverage list.
            const [row] = await getDb()
                .select({
                    institutionId: reportsRS.institutionId,
                    reportNumber: reportsRS.reportNumber,
                })
                .from(reportsRS)
                .where(eq(reportsRS.id, reportId))
                .limit(1);

            await insertNotifications(
                { kind: 'ROLE', role: 'DINKES' },
                {
                    title: 'Laporan belum dapat ditugaskan',
                    message: `Laporan ${row?.reportNumber ?? reportId} tidak menemukan puskesmas untuk kelurahannya.`,
                    type: 'ASSIGNMENT_FAILED',
                    entityType: 'REPORT_RS',
                    entityId: reportId,
                },
            );

            if (row?.institutionId) {
                await insertNotifications(
                    { kind: 'INSTITUTION', institutionId: row.institutionId },
                    {
                        title: 'Laporan belum diteruskan',
                        message: `Laporan ${row.reportNumber} belum punya puskesmas tujuan; Dinas Kesehatan sudah diberi tahu.`,
                        type: 'ASSIGNMENT_FAILED',
                        entityType: 'REPORT_RS',
                        entityId: reportId,
                    },
                );
            }
        }
    }

    console.log(
        JSON.stringify({
            level: 'info',
            msg: 'reconcile done',
            checked: ids.length,
            requeued,
        }),
    );

    return { checked: ids.length, requeued };
}

async function handleNotify(job: Job<NotifyJob>) {
    const count = await insertNotifications(
        { kind: 'USER', userId: job.data.userId },
        {
            title: job.data.title,
            message: job.data.message,
            type: job.data.type,
            entityType: job.data.entityType,
            entityId: job.data.entityId,
        },
    );

    return { delivered: count };
}

async function handleExport(job: Job<ExportJob>) {
    // Heavy aggregation and XLSX writing stay off the request path. The actor
    // comes from the job, but only so the scope can be applied — a job with no
    // resolved actor is refused rather than silently exporting everything.
    const { role, requestedBy, institutionId } = job.data;

    if (!requestedBy || !role) {
        throw new Error('export job missing actor');
    }

    const actor = { userId: requestedBy, role, institutionId, email: '' };
    const { rows } = await buildReportExport(
        actor,
        job.data.kind,
        job.data.filters,
    );

    return { rows: rows.length };
}

function startWorker(name: string, handler: (job: Job) => Promise<unknown>) {
    const worker = new Worker(name, handler, {
        connection: redisConnection(),
        concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
        // A job that exceeds this is killed and retried rather than pinning a
        // slot forever (a hung DB connection would otherwise stall the queue).
        lockDuration: 60_000,
    });

    worker.on('stalled', (jobId) => {
        console.error(
            JSON.stringify({
                level: 'error',
                queue: name,
                jobId,
                msg: 'job stalled (lock expired), will be retried',
            }),
        );
    });

    worker.on('failed', (job, error) => {
        console.error(
            JSON.stringify({
                level: 'error',
                queue: name,
                jobId: job?.id,
                attempt: job?.attemptsMade,
                error: error.message,
                at: new Date().toISOString(),
            }),
        );
    });

    worker.on('error', (error) => {
        console.error(
            JSON.stringify({
                level: 'error',
                queue: name,
                error: error.message,
            }),
        );
    });

    return worker;
}

async function scheduleRecurring() {
    const { getQueue } = await import('@/lib/queue');
    const queue = getQueue(QUEUE_NAMES.sla);

    // Daily sweep at 06:00 Jakarta time (UTC+7 -> 23:00 UTC previous day).
    await queue.upsertJobScheduler(
        'sla-sweep',
        { pattern: '0 23 * * *' },
        { name: 'sla-sweep', data: {} },
    );

    // Assignment reconcile, 30 minutes after the SLA sweep.
    await getQueue(QUEUE_NAMES.assign).upsertJobScheduler(
        'assign-reconcile',
        { pattern: '30 23 * * *' },
        { name: 'assign-reconcile', data: {} },
    );
}

async function main() {
    const workers = [
        // One Worker per queue: BullMQ dispatches by job name, and two Workers
        // on the same queue would double the concurrency for that queue only.
        startWorker(QUEUE_NAMES.assign, (job) =>
            job.name === 'assign-reconcile'
                ? handleReconcile()
                : handleAssign(job),
        ),
        startWorker(QUEUE_NAMES.sla, handleSla),
        startWorker(QUEUE_NAMES.notify, handleNotify),
        startWorker(QUEUE_NAMES.export, handleExport),
    ];

    await scheduleRecurring();

    console.log(
        JSON.stringify({
            level: 'info',
            msg: 'worker started',
            queues: Object.values(QUEUE_NAMES),
            concurrency: process.env.WORKER_CONCURRENCY ?? 5,
        }),
    );

    // Drain in-flight jobs before exiting so a deploy does not lose work.
    const shutdown = async (signal: string) => {
        console.log(
            JSON.stringify({
                level: 'info',
                msg: `received ${signal}, draining`,
            }),
        );
        await Promise.all(workers.map((w) => w.close()));
        process.exit(0);
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
}

void main();
