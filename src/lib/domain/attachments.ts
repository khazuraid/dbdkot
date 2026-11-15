import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { and, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/db';
import { attachments, reportsRS, users } from '@/db/schema';
import { assertInsideUploadRoot } from '@/lib/attachments';
import { audit } from '@/lib/audit';
import type { Actor } from '@/lib/session';
import { getReport } from './report-detail';
import { peDetail } from './pe';

export type AttachmentRow = {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    href: string;
    createdAt: Date;
};

/**
 * Attachments for one report. Authorisation is `getReport`'s: the caller must
 * be party to the report before its file names are even listed, so this cannot
 * become an enumeration endpoint for another tenant's documents.
 *
 * `href` is the download endpoint, which streams the stored file with
 * Content-Disposition: attachment and a sandboxed CSP, so a stored HTML or SVG
 * can never render in the app's origin.
 */
export async function listAttachments(
    actor: Actor,
    reportRSId: string,
): Promise<AttachmentRow[] | null> {
    const report = await getReport(actor, reportRSId);
    if (!report) return null;

    const rows = await getDb()
        .select({
            id: attachments.id,
            fileName: attachments.fileName,
            fileType: attachments.fileType,
            fileSize: attachments.fileSize,
            filePath: attachments.filePath,
            createdAt: attachments.createdAt,
        })
        .from(attachments)
        .where(eq(attachments.reportRSId, report.id))
        .orderBy(desc(attachments.createdAt));

    // The href addresses the row, not the storage path: the handler owns the
    // lookup and re-checks the report, so the URL a caller sees reveals
    // nothing about the upload layout.
    return rows.map((row) => ({
        id: row.id,
        fileName: row.fileName,
        fileType: row.fileType,
        fileSize: row.fileSize,
        createdAt: row.createdAt,
        href: `/api/attachments?id=${row.id}`,
    }));
}

/**
 * Attachments for one PE report (field photos and official documents).
 */
export async function listPeAttachments(
    actor: Actor,
    reportPEId: string,
): Promise<AttachmentRow[] | null> {
    const detail = await peDetail(actor, reportPEId);
    if (!detail) return null;

    const rows = await getDb()
        .select({
            id: attachments.id,
            fileName: attachments.fileName,
            fileType: attachments.fileType,
            fileSize: attachments.fileSize,
            filePath: attachments.filePath,
            createdAt: attachments.createdAt,
        })
        .from(attachments)
        .where(eq(attachments.reportPEId, reportPEId))
        .orderBy(desc(attachments.createdAt));

    return rows.map((row) => ({
        id: row.id,
        fileName: row.fileName,
        fileType: row.fileType,
        fileSize: row.fileSize,
        createdAt: row.createdAt,
        href: `/api/attachments?id=${row.id}`,
    }));
}

export type AdminUploadedFileRow = {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    filePath: string;
    createdAt: Date;
    href: string;
    reportRSId: string | null;
    reportNumber: string | null;
    reportPEId: string | null;
    uploaderId: string;
    uploaderName: string | null;
    uploaderEmail: string | null;
};

export type AdminUploadedFilesResult = {
    rows: AdminUploadedFileRow[];
    page: number;
    perPage: number;
    total: number;
    summary: {
        allCount: number;
        totalBytes: number;
        imageCount: number;
        pdfCount: number;
    };
};

function escapeLike(input: string): string {
    return input.replace(/[\\%_]/g, '\\$&');
}

export async function listAllUploadedFiles(
    actor: Actor,
    opts: {
        page?: number;
        perPage?: number;
        q?: string;
        kind?: 'image' | 'pdf';
    } = {},
): Promise<AdminUploadedFilesResult> {
    if (actor.role !== 'ADMIN') {
        throw new Error('Forbidden: only ADMIN can list all uploaded files');
    }

    const db = getDb();
    const page = Math.max(1, opts.page ?? 1);
    const perPage = Math.min(100, Math.max(1, opts.perPage ?? 25));
    const offset = (page - 1) * perPage;

    const conditions: SQL[] = [];
    const q = opts.q?.trim();
    if (q) {
        const pattern = `%${escapeLike(q)}%`;
        const searchCond = or(
            ilike(attachments.fileName, pattern),
            ilike(attachments.fileType, pattern),
            ilike(reportsRS.reportNumber, pattern),
            ilike(users.name, pattern),
            ilike(users.email, pattern),
        );
        if (searchCond) conditions.push(searchCond);
    }

    if (opts.kind === 'image') {
        conditions.push(ilike(attachments.fileType, 'image/%'));
    } else if (opts.kind === 'pdf') {
        conditions.push(eq(attachments.fileType, 'application/pdf'));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [filteredCount], [summaryRow]] = await Promise.all([
        db
            .select({
                id: attachments.id,
                fileName: attachments.fileName,
                fileType: attachments.fileType,
                fileSize: attachments.fileSize,
                filePath: attachments.filePath,
                createdAt: attachments.createdAt,
                reportRSId: attachments.reportRSId,
                reportNumber: reportsRS.reportNumber,
                reportPEId: attachments.reportPEId,
                uploaderId: attachments.uploadedBy,
                uploaderName: users.name,
                uploaderEmail: users.email,
            })
            .from(attachments)
            .leftJoin(reportsRS, eq(attachments.reportRSId, reportsRS.id))
            .leftJoin(users, eq(attachments.uploadedBy, users.id))
            .where(whereClause)
            .orderBy(desc(attachments.createdAt))
            .limit(perPage)
            .offset(offset),
        db
            .select({ value: count() })
            .from(attachments)
            .leftJoin(reportsRS, eq(attachments.reportRSId, reportsRS.id))
            .leftJoin(users, eq(attachments.uploadedBy, users.id))
            .where(whereClause),
        db
            .select({
                allCount: count(),
                totalBytes: sql<number>`coalesce(sum(${attachments.fileSize}), 0)::bigint`,
                imageCount: sql<number>`count(*) filter (where ${attachments.fileType} like 'image/%')::int`,
                pdfCount: sql<number>`count(*) filter (where ${attachments.fileType} = 'application/pdf')::int`,
            })
            .from(attachments),
    ]);

    return {
        rows: rows.map((row) => ({
            ...row,
            href: `/api/attachments?id=${row.id}`,
        })),
        page,
        perPage,
        total: Number(filteredCount?.value ?? 0),
        summary: {
            allCount: Number(summaryRow?.allCount ?? 0),
            totalBytes: Number(summaryRow?.totalBytes ?? 0),
            imageCount: Number(summaryRow?.imageCount ?? 0),
            pdfCount: Number(summaryRow?.pdfCount ?? 0),
        },
    };
}

export async function deleteUploadedFile(
    actor: Actor,
    id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
    if (actor.role !== 'ADMIN') {
        return {
            ok: false,
            message: 'Hanya administrator yang dapat menghapus berkas.',
        };
    }

    if (!/^[0-9a-f-]{36}$/i.test(id)) {
        return { ok: false, message: 'ID berkas tidak valid.' };
    }

    const db = getDb();
    const [existing] = await db
        .select({
            id: attachments.id,
            fileName: attachments.fileName,
            filePath: attachments.filePath,
            fileType: attachments.fileType,
            fileSize: attachments.fileSize,
            reportRSId: attachments.reportRSId,
        })
        .from(attachments)
        .where(eq(attachments.id, id))
        .limit(1);

    if (!existing) {
        return { ok: false, message: 'Berkas tidak ditemukan.' };
    }

    const safeRelPath = assertInsideUploadRoot(existing.filePath);
    const absolutePath = join(process.cwd(), 'uploads', safeRelPath);

    try {
        await unlink(absolutePath);
    } catch (err) {
        if ((err as { code?: string }).code !== 'ENOENT') {
            return {
                ok: false,
                message: 'Gagal menghapus berkas fisik dari penyimpanan.',
            };
        }
    }

    await db.delete(attachments).where(eq(attachments.id, id));

    await audit({
        actor,
        action: 'DELETE',
        entityType: 'ATTACHMENT',
        entityId: id,
        changes: {
            fileName: { from: existing.fileName, to: null },
            fileType: { from: existing.fileType, to: null },
            fileSize: { from: existing.fileSize, to: null },
            reportRSId: { from: existing.reportRSId, to: null },
        },
    });

    return { ok: true };
}

