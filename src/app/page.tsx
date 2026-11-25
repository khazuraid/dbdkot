import Link from 'next/link';
import { connection } from 'next/server';
import { getPublicSurveillanceSummary } from '@/lib/domain/reports';
import { publicCasePoints } from '@/lib/domain/map-data';
import { getPortalBranding } from '@/lib/branding';
import { LandingNav } from '@/components/landing/landing-nav';
import { PublicSurveillanceHero } from '@/components/landing/public-surveillance-hero';
import { WorkflowPillars } from '@/components/landing/workflow-pillars';
import { BentoFeatures } from '@/components/landing/bento-features';
import { PreventionSection } from '@/components/landing/prevention-section';

export default async function LandingPage() {
    await connection();
    const [cases, summary, branding] = await Promise.all([
        publicCasePoints(),
        getPublicSurveillanceSummary(),
        getPortalBranding(),
    ]);

    return (
        <div className="flex min-h-[100dvh] flex-col bg-[var(--ground)] text-foreground">
            <LandingNav
                branding={{
                    title: branding.title,
                    tagline: branding.tagline,
                    logoUrl: branding.logoUrl,
                }}
            />

            <main className="flex-1">
                {/* Interactive Hero, Live Spatial Case Map, and Real-Time Surveillance Strip */}
                <PublicSurveillanceHero cases={cases} summary={summary} />

                {/* Workflow Section (Alur Kerja) */}
                <section
                    id="alur"
                    className="border-t border-[var(--border)] bg-[var(--surface)] py-20 md:py-24"
                >
                    <div className="mx-auto max-w-6xl px-4 md:px-6">
                        <div className="max-w-2xl">
                            <p className="font-mono text-[12px] text-[var(--accent)]">
                                Alur kolaborasi
                            </p>
                            <h2 className="mt-3 text-[24px] leading-tight font-medium tracking-[-0.02em] text-foreground sm:text-[32px]">
                                Tiga tahap pengendalian demam berdarah
                            </h2>
                            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                                Setiap entitas memiliki peran spesifik dengan
                                batas waktu respons (SLA) yang ketat untuk
                                mencegah eskalasi kejadian luar biasa.
                            </p>
                        </div>

                        <WorkflowPillars />
                    </div>
                </section>

                {/* Feature Matrix */}
                <BentoFeatures />

                {/* Prevention 3M Plus & Emergency Contacts */}
                <PreventionSection
                    branding={{
                        title: branding.title,
                        institutionName: branding.institutionName,
                        emergencyHotline: branding.emergencyHotline,
                        supportEmail: branding.supportEmail,
                    }}
                />
            </main>

            {/* Footer */}
            <footer className="border-t border-[var(--border)] bg-[var(--surface)] py-10 text-[12px] text-muted-foreground">
                <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 md:flex-row md:items-center md:px-6">
                    <div className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-control)] bg-[var(--accent)] text-[12px] font-medium text-[var(--accent-ink)]">
                            {branding.logoUrl ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                    src={branding.logoUrl}
                                    alt={branding.title}
                                    className="size-8 object-contain"
                                />
                            ) : (
                                branding.title.slice(0, 1).toUpperCase()
                            )}
                        </span>
                        <div>
                            <p className="font-medium text-foreground">
                                {branding.title} · {branding.tagline}
                            </p>
                            <p className="text-[12px] text-muted-foreground">
                                {branding.institutionName}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                        <Link
                            href="/masuk"
                            className="transition-colors duration-150 hover:text-foreground"
                        >
                            Portal masuk
                        </Link>
                        <Link
                            href="/daftar"
                            className="transition-colors duration-150 hover:text-foreground"
                        >
                            Registrasi instansi
                        </Link>
                        <a
                            href="#edukasi"
                            className="transition-colors duration-150 hover:text-foreground"
                        >
                            Panduan 3M+
                        </a>
                        <a
                            href="#kontak"
                            className="transition-colors duration-150 hover:text-foreground"
                        >
                            Kontak darurat
                        </a>
                    </div>

                    <p className="text-[12px]">
                        © {new Date().getFullYear()} {branding.institutionName}.{' '}
                        {branding.footerText}
                    </p>
                </div>
            </footer>
        </div>
    );
}
