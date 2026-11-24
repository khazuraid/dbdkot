/**
 * Shared client-safe security utilities: HTML escaping, input validators,
 * formula-injection neutralization, URL scheme validation, and masking.
 */

export const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | null | undefined): value is string {
    return typeof value === 'string' && UUID_RE.test(value.trim());
}

/** Escapes HTML metacharacters before interpolating strings into HTML/Leaflet markup. */
export function escapeHtml(input: unknown): string {
    return String(input ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Escapes SQL LIKE/ILIKE wildcards (`\`, `%`, `_`). */
export function escapeLike(input: string): string {
    return input.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * Neutralizes spreadsheet formula injection (CWE-1236) on string cells.
 * Numbers, booleans, Dates, and nullish values pass through unchanged.
 */
const FORMULA_TRIGGER_RE = /^[\s\u0000-\u001f]*[=+\-@\t\r]/;

export function sanitizeExcelCell<T>(value: T): T | string {
    if (typeof value !== 'string') return value;
    if (value.length === 0) return value;
    if (FORMULA_TRIGGER_RE.test(value)) {
        return `'${value}`;
    }
    return value;
}

/**
 * Walks every worksheet cell in an ExcelJS Workbook and neutralizes string
 * values that start with formula triggers (`=`, `+`, `-`, `@`, tab, CR).
 * Real formula objects (`{ formula: ... }`), numbers, and Dates stay intact.
 */
export function sanitizeWorkbookStrings<
    TWb extends {
        eachSheet: (
            cb: (ws: {
                eachRow: (
                    cb: (row: {
                        eachCell: (cb: (cell: { value: unknown }) => void) => void;
                    }) => void,
                ) => void;
            }) => void,
        ) => void;
    },
>(wb: TWb): TWb {
    wb.eachSheet((ws) => {
        ws.eachRow((row) => {
            row.eachCell((cell) => {
                if (typeof cell.value === 'string') {
                    const safe = sanitizeExcelCell(cell.value);
                    if (safe !== cell.value) {
                        cell.value = safe;
                    }
                }
            });
        });
    });
    return wb;
}

/**
 * Validates branding image/icon URLs (`APP_LOGO_URL`, `APP_FAVICON_URL`).
 * Allows empty string, same-origin root-relative paths (`/logo.png`), or `https://` URLs.
 * Rejects `javascript:`, `data:`, `vbscript:`, `http://`, and protocol-relative `//`.
 */
export function isSafeBrandingUrl(raw: string | null | undefined): boolean {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) return true;
    if (trimmed.startsWith('/')) {
        return !trimmed.startsWith('//') && !/[\r\n\0]/.test(trimmed);
    }
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Validates Indonesian regional codes (`32`, `3274`, `32.74`, `32.74.01`, `3274011001`).
 * Blocks path traversal (`..`, `/`, `\`) and query/fragment injection.
 */
const WILAYAH_CODE_RE = /^[0-9]{2}(\.?[0-9]{2,4}){0,3}$/;

export function isValidWilayahCode(code: string | null | undefined): boolean {
    if (typeof code !== 'string') return false;
    const trimmed = code.trim();
    return (
        trimmed.length >= 2 &&
        trimmed.length <= 16 &&
        WILAYAH_CODE_RE.test(trimmed)
    );
}

/** Masks middle digits of a phone number for non-privileged display. */
export function maskPhone(phone: string | null | undefined): string {
    if (!phone) return '-';
    const trimmed = phone.trim();
    if (trimmed.length <= 6) return '••••';
    return `${trimmed.slice(0, 4)}••••${trimmed.slice(-3)}`;
}

export const MASKED_SECRET = '••••••••';

const EXPLICIT_SECRET_KEYS = new Set([
    'SMTP_PASS',
    'REGIONAL_API_KEY',
    'SUMOPOD_API_KEY',
    'whatsapp_gateway',
]);

export function isSecretSettingKey(key: string): boolean {
    if (EXPLICIT_SECRET_KEYS.has(key)) return true;
    return /(PASS|SECRET|TOKEN|API_KEY|PRIVATE_KEY)/i.test(key);
}
