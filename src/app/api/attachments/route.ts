import { NextResponse } from 'next/server';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { requireActor, scopeToInstitution } from '@/lib/session';
import { getReport } from '@/lib/domain/report-detail';
import { listAttachments } from '@/lib/domain/attachments';
import { getDb } from '@/db';
import { attachments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { audit } from '@/lib/audit';
import {
    attachmentUploadSchema,
    buildStoragePath,
    isAllowedExtension,
} from '@/lib/attachments';

const UPLOAD_ROOT = join(process.cwd(), 'uploads');

/**
 * One attachment's bytes, for the download link the report page renders.
 * Listed by id, authorised through the owning report — never by path — so the
 * href carries no storage layout the caller could edit. Served as an
 * attachment with a sandboxed CSP: a stored SVG or PDF can never execute in
 * this origin.
 */
async function serve(request: Request) {
    // An anonymous probe of a file id is a 401, not an unhandled throw.
    const actor = await requireActor().catch(() => null);
    if (!actor) {
        return NextResponse.json({ error: 'Tidak masuk.' }, { status: 401 });
    }

    const id = new URL(request.url).searchParams.get('id') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
        return NextResponse.json(
            { error: 'Berkas tidak ditemukan.' },
            { status: 404 },
        );
    }

    const [row] = await getDb()
        .select({
            filePath: attachments.filePath,
            fileName: attachments.fileName,
            fileType: attachments.fileType,
            reportRSId: attachments.reportRSId,
        })
        .from(attachments)
        .where(eq(attachments.id, id))
        .limit(1);

    if (!row?.reportRSId) {
        return NextResponse.json(
            { error: 'Berkas tidak ditemukan.' },
            { status: 404 },
        );
    }

    // Same tenant check as the list: a report the caller is not party to is a
    // 404, so ids cannot be probed.
    const report = await getReport(actor, row.reportRSId);
    if (!report) {
        return NextResponse.json(
            { error: 'Berkas tidak ditemukan.' },
            { status: 404 },
        );
    }

    const absolute = join(UPLOAD_ROOT, row.filePath);
    let bytes: Uint8Array;
    try {
        bytes = new Uint8Array(await readFile(absolute));
    } catch {
        return NextResponse.json(
            { error: 'Berkas tidak ditemukan.' },
            { status: 404 },
        );
    }

    await audit({
        actor,
        action: 'READ_PII',
        entityType: 'ATTACHMENT',
        entityId: id,
        changes: { reportRSId: { from: null, to: row.reportRSId } },
    });

    return new Response(bytes as BodyInit, {
        headers: {
            'Content-Type': row.fileType,
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'private, no-store',
        },
    });
}

/**
 * Attachments for one report. Reads are scoped by `listAttachments`, which
 * reuses getReport's tenant check; a report the caller is not party to returns
 * 404 rather than an empty list, so ids cannot be probed.
 */
export async function GET(request: Request) {
    if (new URL(request.url).searchParams.has('id')) return serve(request);

    const actor = await requireActor();
    scopeToInstitution(actor);

    const reportRSId = new URL(request.url).searchParams.get('reportRSId');
    if (!reportRSId) {
        return NextResponse.json(
            { error: 'reportRSId wajib diisi.' },
            { status: 400 },
        );
    }

    const rows = await listAttachments(actor, reportRSId);
    if (!rows) {
        return NextResponse.json(
            { error: 'Laporan tidak ditemukan.' },
            { status: 404 },
        );
    }

    return NextResponse.json({ rows });
}

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
    try {
        // `wx`: the generated path is derived from the name, so a second
        // upload with the same name would otherwise replace the first file
        // while its row keeps the old type and size.
        await writeFile(absolute, Buffer.from(await file.arrayBuffer()), {
            flag: 'wx',
        });
    } catch (error) {
        if ((error as { code?: string }).code === 'EEXIST') {
            return NextResponse.json(
                { error: 'Nama berkas sudah dipakai di laporan ini.' },
                { status: 409 },
            );
        }
        throw error;
    }

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
