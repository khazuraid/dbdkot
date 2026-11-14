import { Worker, type Job } from 'bullmq';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { QUEUE_NAMES, redisConnection } from '@/lib/queue/connection';
import type {
    AssignJob,
    ClusterDetectorJob,
    ExportJob,
    FoggingSchedulerJob,
    NotifyJob,
    SlaJob,
    WhatsAppDispatchJob,
} from '@/lib/queue';
import { and, desc, eq, gte, inArray, isNotNull, ne } from 'drizzle-orm';
import { getDb } from '@/db';
import { foggingCycles, reportsRS, users } from '@/db/schema';
import {
    assignReportByKelurahan,
    findOverdueReportIds,
    findUnassignedReportIds,
} from '@/lib/domain/assignment';
import { insertNotifications } from '@/lib/domain/notify';
import { buildReportExport, type ExportRow } from '@/lib/domain/export';
import { findSpatialClusterMatches } from '@/lib/spatial-cluster';
import { dispatchWhatsApp } from '@/lib/whatsapp';
import { enqueueWhatsAppDispatch } from '@/lib/queue';

/**
 * Worker process. Started with `npm run worker`, never inside the Next server.
 */

async function handleAssign(job: Job<AssignJob>) {
    if (typeof job.data?.reportId !== 'string' || !job.data.reportId) {
        throw new Error('assign job missing reportId');
    }

    const result = await assignReportByKelurahan(job.data.reportId);

    if (result.assigned) {
        await insertNotifications(
            { kind: 'INSTITUTION', institutionId: result.puskesmasId },
            {
                title: 'Laporan baru ditugaskan',
                message: `Laporan ${job.data.reportId} menunggu verifikasi Puskesmas (SLA 24 jam).`,
                type: 'ASSIGNMENT',
                entityType: 'REPORT_RS',
                entityId: job.data.reportId,
            },
        );

        const officers = await getDb()
            .select({
                phone: users.whatsappPhone,
                optIn: users.whatsappOptIn,
            })
            .from(users)
            .where(
                and(
                    eq(users.institutionId, result.puskesmasId),
                    eq(users.role, 'PUSKESMAS'),
                    eq(users.isActive, true),
                ),
            );

        for (const officer of officers) {
            if (officer.optIn && officer.phone) {
                await enqueueWhatsAppDispatch({
                    recipientPhone: officer.phone,
                    recipientRole: 'PUSKESMAS',
                    reportRSId: job.data.reportId,
                    eventKind: 'ASSIGNMENT',
                    message: `[WALI-EPI] Kasus DBD baru ditugaskan ke Puskesmas Anda (ID: ${job.data.reportId}). Mohon verifikasi sebelum batas SLA 24 jam.`,
                });
            }
        }
    }

    return result;
}

async function handleSla(job: Job<SlaJob>) {
    const phase = job.data.phase ?? 'ASSIGN_BREACH_24H';

    if (phase === 'PE_BREACH_72H' && job.data.reportId) {
        const [row] = await getDb()
            .select({
                reportNumber: reportsRS.reportNumber,
                status: reportsRS.status,
                assignedPuskesmasId: reportsRS.assignedPuskesmasId,
            })
            .from(reportsRS)
            .where(eq(reportsRS.id, job.data.reportId))
            .limit(1);

        if (
            !row ||
            (row.status !== 'ASSIGNED_ACCEPTED' &&
                row.status !== 'PE_IN_PROGRESS')
        ) {
            return { checked: 1, reminded: 0 };
        }

        if (row.assignedPuskesmasId) {
            await insertNotifications(
                { kind: 'INSTITUTION', institutionId: row.assignedPuskesmasId },
                {
                    title: 'PE melewati SLA 72 jam',
                    message: `Investigasi PE untuk ${row.reportNumber} belum disubmit dalam 72 jam.`,
                    type: 'PE_SLA_BREACH',
                    entityType: 'REPORT_RS',
                    entityId: job.data.reportId,
                },
            );
        }
        await insertNotifications(
            { kind: 'ROLE', role: 'DINKES' },
            {
                title: 'Eskalasi PE SLA 72 jam',
                message: `PE kasus ${row.reportNumber} melewati batas 72 jam sejak diterima Puskesmas.`,
                type: 'PE_SLA_BREACH',
                entityType: 'REPORT_RS',
                entityId: job.data.reportId,
            },
        );
        return { checked: 1, reminded: 1 };
    }

    const ids = job.data.reportId
        ? [job.data.reportId]
        : await findOverdueReportIds();
    let reminded = 0;

    for (const reportId of ids) {
        const [row] = await getDb()
            .select({
                reportNumber: reportsRS.reportNumber,
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

        if (phase === 'ASSIGN_WARNING_6H') {
            if (row.assignedPuskesmasId) {
                await insertNotifications(
                    {
                        kind: 'INSTITUTION',
                        institutionId: row.assignedPuskesmasId,
                    },
                    {
                        title: 'Peringatan SLA 18 jam',
                        message: `Laporan ${row.reportNumber} tersisa 6 jam sebelum eskalasi SLA 24 jam.`,
                        type: 'SLA_WARNING',
                        entityType: 'REPORT_RS',
                        entityId: reportId,
                    },
                );
            }
            reminded++;
            continue;
        }

        if (row.assignedPuskesmasId) {
            await insertNotifications(
                { kind: 'INSTITUTION', institutionId: row.assignedPuskesmasId },
                {
                    title: 'Laporan melewati SLA 24 jam',
                    message: `Laporan ${row.reportNumber} belum diterima dalam 24 jam.`,
                    type: 'SLA_BREACH',
                    entityType: 'REPORT_RS',
                    entityId: reportId,
                },
            );
        }

        await insertNotifications(
            { kind: 'ROLE', role: 'DINKES' },
            {
                title: 'Eskalasi SLA 24 jam',
                message: `Laporan ${row.reportNumber} melewati tenggat penerimaan Puskesmas (24 jam).`,
                type: 'SLA_BREACH',
                entityType: 'REPORT_RS',
                entityId: reportId,
            },
        );

        reminded++;
    }

    return { checked: ids.length, reminded };
}

async function handleReconcile() {
    const ids = await findUnassignedReportIds();
    const { enqueueAssign } = await import('@/lib/queue');

    let requeued = 0;
    for (const reportId of ids) {
        await enqueueAssign(reportId);
        requeued++;
    }

    return { found: ids.length, requeued };
}

async function handleNotify(job: Job<NotifyJob>) {
    if (!job.data.userId) {
        throw new Error('notify job needs userId');
    }

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

async function handleWhatsAppDispatch(job: Job<WhatsAppDispatchJob>) {
    const { recipientPhone, recipientRole, reportRSId, eventKind, message } =
        job.data;

    let phones: string[] = recipientPhone ? [recipientPhone] : [];
    if (phones.length === 0 && recipientRole) {
        const recipients = await getDb()
            .select({ phone: users.whatsappPhone })
            .from(users)
            .where(
                and(
                    eq(
                        users.role,
                        recipientRole as
                            | 'ADMIN'
                            | 'DINKES'
                            | 'PUSKESMAS'
                            | 'RUMAH_SAKIT',
                    ),
                    eq(users.whatsappOptIn, true),
                    eq(users.isActive, true),
                    isNotNull(users.whatsappPhone),
                ),
            )
            .limit(10);
        phones = recipients
            .map((r) => r.phone)
            .filter((p): p is string => Boolean(p));
    }

    if (phones.length === 0) {
        // Still record a SKIPPED audit row so admin/detail page sees the dispatch intent.
        return dispatchWhatsApp({
            recipientPhone: 'UNCONFIGURED',
            recipientRole,
            reportRSId,
            eventKind,
            message,
        });
    }

    const results = [];
    for (const phone of phones) {
        results.push(
            await dispatchWhatsApp({
                recipientPhone: phone,
                recipientRole,
                reportRSId,
                eventKind,
                message,
            }),
        );
    }

    return { sent: results.length, results };
}

async function handleClusterDetector(job: Job<ClusterDetectorJob>) {
    const db = getDb();
    const [target] = await db
        .select({
            id: reportsRS.id,
            reportNumber: reportsRS.reportNumber,
            latitude: reportsRS.latitude,
            longitude: reportsRS.longitude,
            clusterId: reportsRS.clusterId,
            kelurahan: reportsRS.kelurahan,
            createdAt: reportsRS.createdAt,
        })
        .from(reportsRS)
        .where(eq(reportsRS.id, job.data.reportId))
        .limit(1);

    if (
        !target ||
        target.latitude === null ||
        target.longitude === null
    ) {
        return { matched: 0 };
    }

    const cutoff = new Date(
        target.createdAt.getTime() - 14 * 24 * 3600 * 1000,
    );
    const candidates = await db
        .select({
            id: reportsRS.id,
            latitude: reportsRS.latitude,
            longitude: reportsRS.longitude,
            createdAt: reportsRS.createdAt,
            clusterId: reportsRS.clusterId,
        })
        .from(reportsRS)
        .where(
            and(
                ne(reportsRS.id, target.id),
                isNotNull(reportsRS.latitude),
                isNotNull(reportsRS.longitude),
                gte(reportsRS.createdAt, cutoff),
            ),
        )
        .orderBy(desc(reportsRS.createdAt))
        .limit(500);

    const matches = findSpatialClusterMatches(
        {
            id: target.id,
            latitude: target.latitude,
            longitude: target.longitude,
            createdAt: target.createdAt,
        },
        candidates.map((c) => ({
            id: c.id,
            latitude: c.latitude!,
            longitude: c.longitude!,
            createdAt: c.createdAt,
            clusterId: c.clusterId,
        })),
    );

    if (matches.neighbors.length === 0) {
        return { matched: 0 };
    }

    const clusterId =
        matches.existingClusterId ??
        target.clusterId ??
        `CL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${target.id.slice(0, 6).toUpperCase()}`;

    const idsToLink = [target.id, ...matches.neighbors.map((m) => m.id)];
    await db
        .update(reportsRS)
        .set({ clusterId, updatedAt: new Date() })
        .where(inArray(reportsRS.id, idsToLink));

    await insertNotifications(
        { kind: 'ROLE', role: 'DINKES' },
        {
            title: 'Klaster spasial <=100m terdeteksi',
            message: `Kasus ${target.reportNumber} (${target.kelurahan ?? '-'}) berada dalam radius <=100m dengan ${matches.neighbors.length} kasus lain (Klaster ${clusterId}).`,
            type: 'CLUSTER_ALERT',
            entityType: 'REPORT_RS',
            entityId: target.id,
        },
    );

    return { matched: matches.neighbors.length, clusterId };
}

async function handleFoggingScheduler(job: Job<FoggingSchedulerJob>) {
    const db = getDb();
    const [report] = await db
        .select({
            id: reportsRS.id,
            reportNumber: reportsRS.reportNumber,
            kelurahan: reportsRS.kelurahan,
            assignedPuskesmasId: reportsRS.assignedPuskesmasId,
            status: reportsRS.status,
        })
        .from(reportsRS)
        .where(eq(reportsRS.id, job.data.reportRSId))
        .limit(1);

    if (!report || report.status === 'CLOSED') {
        return { skipped: true };
    }

    const [cycle2] = await db
        .select({ status: foggingCycles.status })
        .from(foggingCycles)
        .where(
            and(
                eq(foggingCycles.reportRSId, report.id),
                eq(foggingCycles.cycleNumber, 2),
            ),
        )
        .limit(1);

    if (cycle2?.status === 'DONE') {
        return { skipped: true };
    }

    const isReminder = job.data.phase === 'H_MINUS_1';
    const title = isReminder
        ? 'Pengingat H-1 Fogging Siklus 2'
        : 'Jatuh Tempo Fogging Siklus 2 (H+7)';
    const message = isReminder
        ? `Besok jadwal Fogging Siklus 2 untuk ${report.reportNumber} (${report.kelurahan ?? '-'}). Siapkan tim & logistik.`
        : `Hari ini jadwal Fogging Siklus 2 untuk ${report.reportNumber} (${report.kelurahan ?? '-'}).`;

    if (report.assignedPuskesmasId) {
        await insertNotifications(
            { kind: 'INSTITUTION', institutionId: report.assignedPuskesmasId },
            {
                title,
                message,
                type: 'FOGGING_REMINDER',
                entityType: 'REPORT_RS',
                entityId: report.id,
            },
        );
    }

    await enqueueWhatsAppDispatch({
        recipientPhone: '',
        recipientRole: 'PUSKESMAS',
        reportRSId: report.id,
        eventKind: isReminder ? 'FOGGING_H_MINUS_1' : 'FOGGING_DAY_0',
        message: `[WALI-EPI] ${title}: ${message}`,
    });

    return { reminded: true };
}

async function handleExport(job: Job<ExportJob>) {
    const { role, requestedBy, institutionId } = job.data;

    if (!requestedBy || !role) {
        throw new Error('export job missing actor');
    }

    const actor = { userId: requestedBy, role, institutionId, email: '' };
    const { columns, rows, total } = await buildReportExport(
        actor,
        job.data.kind,
        job.data.filters,
    );

    const file = await writeWorkbook(job.data.kind, columns, rows, total);

    return { rows: rows.length, file };
}

async function writeWorkbook(
    kind: ExportJob['kind'],
    columns: string[],
    rows: ExportRow[],
    total: number,
) {
    const dir = join(process.cwd(), 'uploads', 'exports');
    await mkdir(dir, { recursive: true });

    const name = `${kind}-${Date.now()}.xlsx`;
    const path = join(dir, name);
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        filename: path,
        useStyles: true,
    });

    const sheet = workbook.addWorksheet(kind);
    sheet.columns = columns.map((c) => ({
        header: c,
        key: c,
        width: Math.min(48, Math.max(12, c.length + 6)),
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    for (const row of rows) {
        sheet.addRow(row).commit();
    }

    if (total > rows.length) {
        const note: ExportRow = Object.fromEntries(
            columns.map((c) => [c, null]),
        );
        note[columns[0]] = `TERPOTONG: ${rows.length} dari ${total} baris`;
        sheet.addRow(note).commit();
    }

    await workbook.commit();

    return `exports/${name}`;
}

function startWorker(name: string, handler: (job: Job) => Promise<unknown>) {
    const worker = new Worker(name, handler, {
        connection: redisConnection(),
        concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
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

    await queue.upsertJobScheduler(
        'sla-sweep',
        { pattern: '0 23 * * *' },
        { name: 'sla-sweep', data: {} },
    );

    await getQueue(QUEUE_NAMES.assign).upsertJobScheduler(
        'assign-reconcile',
        { pattern: '30 23 * * *' },
        { name: 'assign-reconcile', data: {} },
    );
}

async function main() {
    const workers = [
        startWorker(QUEUE_NAMES.assign, (job) =>
            job.name === 'assign-reconcile'
                ? handleReconcile()
                : handleAssign(job),
        ),
        startWorker(QUEUE_NAMES.sla, handleSla),
        startWorker(QUEUE_NAMES.notify, handleNotify),
        startWorker(QUEUE_NAMES.export, handleExport),
        startWorker(QUEUE_NAMES.whatsappDispatch, handleWhatsAppDispatch),
        startWorker(QUEUE_NAMES.clusterDetector, handleClusterDetector),
        startWorker(QUEUE_NAMES.foggingScheduler, handleFoggingScheduler),
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
