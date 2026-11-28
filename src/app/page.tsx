import { connection } from 'next/server';
import { getPublicSurveillanceSummary } from '@/lib/domain/reports';
import { publicCasePoints } from '@/lib/domain/map-data';
import { getPortalBranding } from '@/lib/branding';
import { PublicSurveillanceHero } from '@/components/landing/public-surveillance-hero';
import {
    getLandingBreakFixture,
    parseLandingBreakMode,
} from '@/components/landing/landing-break-fixtures';
import { LandingBreakToggle } from '@/components/landing/landing-break-toggle';

export default async function LandingPage({
    searchParams,
}: {
    searchParams: Promise<{ data?: string }>;
}) {
    await connection();
    const isDev = process.env.NODE_ENV !== 'production';
    const sp = isDev ? await searchParams : {};
    const breakMode = isDev ? parseLandingBreakMode(sp.data) : 'live';

    const [liveCases, liveSummary, liveBranding] = await Promise.all([
        publicCasePoints(),
        getPublicSurveillanceSummary(),
        getPortalBranding(),
    ]);

    const baseBranding = {
        title: liveBranding.title,
        tagline: liveBranding.tagline,
        logoUrl: liveBranding.logoUrl,
        institutionName: liveBranding.institutionName,
        emergencyHotline: liveBranding.emergencyHotline,
        supportEmail: liveBranding.supportEmail,
    };

    const resolved =
        isDev && breakMode !== 'live'
            ? getLandingBreakFixture(breakMode, baseBranding)
            : {
                  cases: liveCases,
                  summary: liveSummary,
                  branding: baseBranding,
              };

    return (
        <div className="min-h-dvh bg-[var(--ground)] text-foreground lg:h-dvh lg:overflow-hidden">
            <PublicSurveillanceHero
                cases={resolved.cases}
                summary={resolved.summary}
                branding={resolved.branding}
            />
            {isDev ? <LandingBreakToggle mode={breakMode} /> : null}
        </div>
    );
}
