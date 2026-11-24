import { NextResponse } from 'next/server';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { requireActor, scopeToInstitution } from '@/lib/session';
import { getReport } from '@/lib/domain/report-detail';
import { listAttachments, listPeAttachments } from '@/lib/domain/attachments';
import { peDetail } from '@/lib/domain/pe';
import { getDb } from '@/db';
import { attachments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { audit } from '@/lib/audit';
import { consumeRateLimit } from '@/lib/rate-limit';
import { isValidUuid } from '@/lib/security';
import {
    assertInsideUploadRoot,
    attachmentUploadSchema,
    buildStoragePath,
    isAllowedExtension,
    validateMagicBytes,
} from '@/lib/attachments';

const UPLOAD_ROOT = resolve(process.cwd(), 'uploads');

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
            reportPEId: attachments.reportPEId,
        })
        .from(attachments)
        .where(eq(attachments.id, id))
        .limit(1);

    if (!row) {
        return NextResponse.json(
            { error: 'Berkas tidak ditemukan.' },
            { status: 404 },
        );
    }

    if (actor.role !== 'ADMIN') {
        let authorized = false;
        if (row.reportRSId) {
            const report = await getReport(actor, row.reportRSId);
            if (report) authorized = true;
        }
        if (!authorized && row.reportPEId) {
            const pe = await peDetail(actor, row.reportPEId);
            if (pe) authorized = true;
        }

        if (!authorized) {
            return NextResponse.json(
                { error: 'Berkas tidak ditemukan.' },
                { status: 404 },
            );
        }
    }

    let safeRel: string;
    try {
        safeRel = assertInsideUploadRoot(row.filePath);
    } catch {
        return NextResponse.json(
            { error: 'Berkas tidak ditemukan.' },
            { status: 404 },
        );
    }

    const absolute = resolve(UPLOAD_ROOT, safeRel);
    if (!absolute.startsWith(`${UPLOAD_ROOT}/`)) {
        return NextResponse.json(
            { error: 'Berkas tidak ditemukan.' },
            { status: 404 },
        );
    }

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
        changes: {
            reportRSId: { from: null, to: row.reportRSId },
            reportPEId: { from: null, to: row.reportPEId },
        },
    });

    const isInline = new URL(request.url).searchParams.get('inline') === 'true';
    const isImage = row.fileType.startsWith('image/');
    const isPdf = row.fileType === 'application/pdf';

    return new Response(bytes as BodyInit, {
        headers: {
            'Content-Type': row.fileType,
            'Content-Disposition': `${isInline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'Content-Security-Policy': isInline && (isImage || isPdf)
                ? "default-src 'self'; img-src 'self' data: blob:; style-src 'unsafe-inline'; object-src 'self'; frame-ancestors 'self'"
                : "default-src 'none'; sandbox",
            'Cache-Control': 'private, no-store',
        },
    });
}

/**
 * Attachments for one report or PE report. Reads are scoped by tenant check.
 */
export async function GET(request: Request) {
    if (new URL(request.url).searchParams.has('id')) return serve(request);

    const actor = await requireActor();
    scopeToInstitution(actor);

    const reportPEId = new URL(request.url).searchParams.get('reportPEId');
    if (reportPEId) {
        const rows = await listPeAttachments(actor, reportPEId);
        if (!rows) {
            return NextResponse.json(
                { error: 'Laporan PE tidak ditemukan.' },
                { status: 404 },
            );
        }
        return NextResponse.json({ rows });
    }

    const reportRSId = new URL(request.url).searchParams.get('reportRSId');
    if (!reportRSId) {
        return NextResponse.json(
            { error: 'reportRSId atau reportPEId wajib diisi.' },
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

export async function POST(request: Request) {
    const actor = await requireActor().catch(() => null);
    if (!actor) {
        return NextResponse.json({ error: 'Tidak masuk.' }, { status: 401 });
    }
    const instId = scopeToInstitution(actor);

    const rate = await consumeRateLimit(`upload:att:${actor.userId}`, 60, 30);
    if (!rate.allowed) {
        return NextResponse.json(
            { error: 'Terlalu banyak unggahan. Coba sebentar lagi.' },
            { status: 429, headers: { 'Retry-After': String(rate.retryAfter ?? 60) } },
        );
    }

    const form = await request.formData();
    const file = form.get('file');
    const reportRSId = form.get('reportRSId') ? String(form.get('reportRSId')) : null;
    const reportPEId = form.get('reportPEId') ? String(form.get('reportPEId')) : null;

    if (!(file instanceof File)) {
        return NextResponse.json(
            { error: 'Berkas wajib dikirim.' },
            { status: 400 },
        );
    }

    if (!reportRSId && !reportPEId) {
        return NextResponse.json(
            { error: 'reportRSId atau reportPEId wajib diisi.' },
            { status: 400 },
        );
    }

    if (
        (reportRSId && !isValidUuid(reportRSId)) ||
        (reportPEId && !isValidUuid(reportPEId))
    ) {
        return NextResponse.json(
            { error: 'Identitas laporan tidak valid.' },
            { status: 400 },
        );
    }

    let targetReportRSId = reportRSId;
    if (reportPEId) {
        if (actor.role === 'RUMAH_SAKIT') {
            return NextResponse.json(
                { error: 'Tidak memiliki izin mengunggah lampiran PE.' },
                { status: 403 },
            );
        }
        const pe = await peDetail(actor, reportPEId);
        if (!pe) {
            return NextResponse.json(
                { error: 'Laporan PE tidak ditemukan.' },
                { status: 404 },
            );
        }
        if (actor.role === 'PUSKESMAS' && pe.pe.status === 'VERIFIED') {
            return NextResponse.json(
                { error: 'Laporan PE yang sudah diverifikasi tidak dapat ditambah lampiran.' },
                { status: 403 },
            );
        }
        if (!targetReportRSId) targetReportRSId = pe.reportRSId;
    } else if (reportRSId) {
        const report = await getReport(actor, reportRSId);
        if (!report) {
            return NextResponse.json(
                { error: 'Laporan tidak ditemukan.' },
                { status: 404 },
            );
        }
        // Only the originating facility, assigned Puskesmas, Dinkes, or Admin may attach files
        if (
            actor.role === 'RUMAH_SAKIT' &&
            report.institutionId !== instId
        ) {
            return NextResponse.json(
                { error: 'Tidak memiliki izin mengunggah lampiran pada laporan ini.' },
                { status: 403 },
            );
        }
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

    const rawBytes = new Uint8Array(await file.arrayBuffer());
    const magic = validateMagicBytes(rawBytes, file.type, file.name);
    if (!magic.ok) {
        return NextResponse.json({ error: magic.error }, { status: 415 });
    }

    const folderPrefix = reportPEId ? `pe_${reportPEId}` : targetReportRSId!;
    const storagePath = assertInsideUploadRoot(
        buildStoragePath(folderPrefix, file.name),
    );
    const absolute = resolve(UPLOAD_ROOT, storagePath);

    await mkdir(dirname(absolute), { recursive: true });
    try {
        await writeFile(absolute, rawBytes, { flag: 'wx' });
    } catch (error) {
        if ((error as { code?: string }).code === 'EEXIST') {
            return NextResponse.json(
                { error: 'Nama berkas sudah dipakai di laporan ini.' },
                { status: 409 },
            );
        }
        throw error;
    }

    let row: { id: string };
    try {
        [row] = await getDb()
            .insert(attachments)
            .values({
                reportRSId: targetReportRSId,
                reportPEId: reportPEId,
                fileName: file.name,
                filePath: storagePath,
                fileType: magic.mime,
                fileSize: rawBytes.byteLength,
                uploadedBy: actor.userId,
            })
            .returning({ id: attachments.id });
    } catch (err) {
        // Avoid orphaned files on disk when DB insert fails
        await unlink(absolute).catch(() => {});
        throw err;
    }

    await audit({
        actor,
        action: 'UPDATE',
        entityType: 'ATTACHMENT',
        entityId: row.id,
        changes: {
            reportRSId: { from: null, to: targetReportRSId },
            reportPEId: { from: null, to: reportPEId },
        },
    });

    return NextResponse.json({ id: row.id, fileName: file.name });
}
