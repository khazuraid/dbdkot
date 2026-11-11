import { describe, expect, it } from 'vitest';
import {
    assertInsideUploadRoot,
    attachmentUploadSchema,
    buildStoragePath,
    isAllowedExtension,
} from './attachments';

describe('attachmentUploadSchema', () => {
    const valid = {
        fileName: 'hasil-pe.pdf',
        fileType: 'application/pdf' as const,
        fileSize: 1024,
    };

    it('accepts a normal upload', () => {
        expect(attachmentUploadSchema.safeParse(valid).success).toBe(true);
    });

    it.each(['../../etc/passwd', 'a/b.pdf', 'a\\b.pdf', '..', ''])(
        'rejects filename %j',
        (fileName) => {
            expect(
                attachmentUploadSchema.safeParse({ ...valid, fileName })
                    .success,
            ).toBe(false);
        },
    );

    it('rejects a disallowed mime type', () => {
        expect(
            attachmentUploadSchema.safeParse({
                ...valid,
                fileType: 'image/svg+xml',
            }).success,
        ).toBe(false);
    });

    it('rejects an oversized upload', () => {
        expect(
            attachmentUploadSchema.safeParse({
                ...valid,
                fileSize: 11 * 1024 * 1024,
            }).success,
        ).toBe(false);
    });
});

describe('isAllowedExtension', () => {
    it('allows pdf and images, rejects html/svg', () => {
        expect(isAllowedExtension('a.PDF')).toBe(true);
        expect(isAllowedExtension('a.png')).toBe(true);
        expect(isAllowedExtension('a.html')).toBe(false);
        expect(isAllowedExtension('a.svg')).toBe(false);
        expect(isAllowedExtension('noext')).toBe(false);
    });
});

describe('buildStoragePath', () => {
    it('ignores the original path components', () => {
        const path = buildStoragePath(
            '11111111-2222-3333-4444-555555555555',
            'x.pdf',
        );
        expect(
            path.startsWith(
                'attachments/11111111-2222-3333-4444-555555555555/',
            ),
        ).toBe(true);
        expect(path).not.toContain('..');
    });
});

describe('assertInsideUploadRoot', () => {
    it('accepts a generated path', () => {
        expect(assertInsideUploadRoot('attachments/abc/file.pdf')).toBe(
            'attachments/abc/file.pdf',
        );
    });

    it.each([
        '/app/.env',
        'attachments/../../.env',
        '../secrets',
        'other/file.pdf',
        'attachments\\..\\..\\.env',
    ])('rejects %j', (path) => {
        expect(() => assertInsideUploadRoot(path)).toThrow();
    });
});
