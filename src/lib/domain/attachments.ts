import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { attachments } from '@/db/schema';
import type { Actor } from '@/lib/session';
import { getReport } from './report-detail';

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
