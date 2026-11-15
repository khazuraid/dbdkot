import { z } from 'zod';

/**
 * C7: the prototype accepted a client-supplied `filePath` and later passed it
 * straight to `fs.unlink`, so `DELETE /attachments/{id}` could delete any file
 * the Node process could write. Stored paths are now generated server-side from
 * a validated filename; callers never supply a path.
 */

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'] as const;

const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

const EXTENSION_MIME_MAP: Record<string, AllowedMimeType> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
};

export function detectMagicMime(bytes: Uint8Array): AllowedMimeType | null {
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
    ) {
        return 'image/png';
    }

    // JPEG: FF D8 FF
    if (
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
    ) {
        return 'image/jpeg';
    }

    // PDF: %PDF-
    if (
        bytes.length >= 5 &&
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46 &&
        bytes[4] === 0x2d
    ) {
        return 'application/pdf';
    }

    // WEBP: RIFF....WEBP
    if (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
    ) {
        return 'image/webp';
    }

    return null;
}

export function validateMagicBytes(
    bytes: Uint8Array,
    declaredMime: string,
    fileName: string,
): { ok: true; mime: AllowedMimeType } | { ok: false; error: string } {
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_ATTACHMENT_BYTES) {
        return {
            ok: false,
            error: 'Ukuran berkas kosong atau melebihi batas 10 MB.',
        };
    }

    const detected = detectMagicMime(bytes);
    if (!detected) {
        return {
            ok: false,
            error: 'Signature file (magic bytes) tidak valid. Hanya PDF, JPG, PNG, atau WEBP asli yang diizinkan.',
        };
    }

    const expectedFromExt = EXTENSION_MIME_MAP[extensionOf(fileName)];
    if (!expectedFromExt || expectedFromExt !== detected) {
        return {
            ok: false,
            error: 'Isi berkas (magic bytes) tidak cocok dengan ekstensi nama berkas.',
        };
    }

    if (declaredMime && declaredMime !== detected) {
        return {
            ok: false,
            error: 'Isi berkas (magic bytes) tidak cocok dengan tipe MIME yang dikirim.',
        };
    }

    return { ok: true, mime: detected };
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const attachmentUploadSchema = z.object({
    fileName: z
        .string()
        .min(1)
        .max(255)
        // Reject any path separator or traversal attempt outright.
        .refine((name) => !name.includes('/') && !name.includes('\\'), {
            message: 'fileName must not contain path separators',
        })
        .refine((name) => name !== '.' && name !== '..', {
            message: 'fileName is invalid',
        }),
    fileType: z.enum(ALLOWED_MIME_TYPES),
    fileSize: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
});

export type AttachmentUpload = z.infer<typeof attachmentUploadSchema>;

export function extensionOf(fileName: string): string {
    const dot = fileName.lastIndexOf('.');
    return dot === -1 ? '' : fileName.slice(dot).toLowerCase();
}

export function isAllowedExtension(fileName: string): boolean {
    return (ALLOWED_EXTENSIONS as readonly string[]).includes(
        extensionOf(fileName),
    );
}

/**
 * The only place a stored path is constructed. `reportId` is a server-issued
 * UUID and the filename is stripped of everything but its own basename, so the
 * result can never escape the upload root.
 */
export function buildStoragePath(reportId: string, fileName: string): string {
    const safeName = Buffer.from(fileName, 'utf8')
        .toString('base64url')
        .slice(0, 180);

    return `attachments/${reportId}/${safeName}`;
}

/**
 * Guards the delete path: resolves only inside the upload root and refuses
 * anything with a traversal segment.
 */
export function assertInsideUploadRoot(path: string): string {
    const normalized = path.replace(/\\/g, '/');

    if (
        normalized.startsWith('/') ||
        normalized.includes('../') ||
        !normalized.startsWith('attachments/')
    ) {
        throw new Error('Attachment path escapes the upload root');
    }

    return normalized;
}
