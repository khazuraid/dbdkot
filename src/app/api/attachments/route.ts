import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { requireActor, scopeToInstitution } from '@/lib/session';
import { getReport } from '@/lib/domain/report-detail';
import { getDb } from '@/db';
import { attachments } from '@/db/schema';
import { audit } from '@/lib/audit';
import {
    attachmentUploadSchema,
    buildStoragePath,
    isAllowedExtension,
} from '@/lib/attachments';

const UPLOAD_ROOT = join(process.cwd(), 'uploads');

/**
 * Attachment upload. The path is never derived from client input — only the
 * basename is kept and the storage path comes from buildStoragePath() (C7).
 *
 * The type and extension must agree: a `.png` declared as image/png is fine,
 * a `.html` declared as image/png is refused, which is the stored-XSS route
 * the legacy app left open.
 */
export async function POST(request: Request) {
    const actor = await requireActor();
    scopeToInstitution(actor);

    const form = await request.formData();
    const file = form.get('file');
    const reportRSId = String(form.get('reportRSId') ?? '');

    if (!(file instanceof File)) {
        return NextResponse.json(
            { error: 'Berkas wajib dikirim.' },
            { status: 400 },
        );
    }

    // Authorisation before parsing: the caller must be party to this report.
    const report = await getReport(actor, reportRSId);
    if (!report) {
        return NextResponse.json(
            { error: 'Laporan tidak ditemukan.' },
            { status: 404 },
        );
    }

    const parsed = attachmentUploadSchema.safeParse({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
    });

    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Tipe atau ukuran berkas tidak diizinkan.' },
            { status: 415 },
        );
    }

    if (!isAllowedExtension(file.name)) {
        return NextResponse.json(
            { error: 'Ekstensi berkas tidak diizinkan.' },
            { status: 415 },
        );
    }

    const storagePath = buildStoragePath(report.id, file.name);
    const absolute = join(UPLOAD_ROOT, storagePath);

    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, Buffer.from(await file.arrayBuffer()));

    const [row] = await getDb()
        .insert(attachments)
        .values({
            reportRSId: report.id,
            fileName: file.name,
            filePath: storagePath,
            fileType: file.type,
            fileSize: file.size,
            uploadedBy: actor.userId,
        })
        .returning({ id: attachments.id });

    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'ATTACHMENT',
        entityId: row.id,
        changes: { reportRSId: { from: null, to: report.id } },
    });

    return NextResponse.json({ id: row.id, fileName: file.name });
}
