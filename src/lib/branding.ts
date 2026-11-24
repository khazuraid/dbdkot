import { inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { systemSettings } from '@/db/schema';
import { isSafeBrandingUrl } from './security';

export type PortalBranding = {
    title: string;
    tagline: string;
    institutionName: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    footerText: string;
    emergencyHotline: string;
    supportEmail: string;
};

export const DEFAULT_BRANDING: PortalBranding = {
    title: 'WALI-EPI',
    tagline: 'Surveilans DBD',
    institutionName: 'Dinas Kesehatan',
    logoUrl: null,
    faviconUrl: null,
    footerText: 'Sistem Surveilans Epidemiologi Demam Berdarah Dengue.',
    emergencyHotline: '119',
    supportEmail: '',
};

const BRANDING_KEYS = [
    'APP_TITLE',
    'APP_TAGLINE',
    'INSTITUTION_NAME',
    'APP_LOGO_URL',
    'APP_FAVICON_URL',
    'APP_FOOTER_TEXT',
    'EMERGENCY_HOTLINE',
    'SUPPORT_EMAIL',
] as const;

function sanitizeBrandingUrl(raw: string | undefined): string | null {
    const trimmed = raw?.trim() ?? '';
    if (!trimmed) return null;
    return isSafeBrandingUrl(trimmed) ? trimmed : null;
}

/**
 * Loads white-label regional branding from `system_settings` with neutral
 * fallbacks so no single city/region is hardcoded across the portal.
 */
export async function getPortalBranding(): Promise<PortalBranding> {
    try {
        const rows = await getDb()
            .select({ key: systemSettings.key, value: systemSettings.value })
            .from(systemSettings)
            .where(inArray(systemSettings.key, [...BRANDING_KEYS]));

        const map = new Map<string, string>();
        for (const r of rows) {
            if (r.value && r.value.trim()) {
                map.set(r.key, r.value.trim());
            }
        }

        return {
            title: map.get('APP_TITLE') ?? DEFAULT_BRANDING.title,
            tagline: map.get('APP_TAGLINE') ?? DEFAULT_BRANDING.tagline,
            institutionName:
                map.get('INSTITUTION_NAME') ?? DEFAULT_BRANDING.institutionName,
            logoUrl: sanitizeBrandingUrl(map.get('APP_LOGO_URL')),
            faviconUrl: sanitizeBrandingUrl(map.get('APP_FAVICON_URL')),
            footerText: map.get('APP_FOOTER_TEXT') ?? DEFAULT_BRANDING.footerText,
            emergencyHotline:
                map.get('EMERGENCY_HOTLINE') ??
                DEFAULT_BRANDING.emergencyHotline,
            supportEmail:
                map.get('SUPPORT_EMAIL') ?? DEFAULT_BRANDING.supportEmail,
        };
    } catch {
        return DEFAULT_BRANDING;
    }
}
