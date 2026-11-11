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
