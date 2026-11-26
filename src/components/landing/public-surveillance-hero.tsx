'use client';

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type KeyboardEvent,
} from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
    Activity,
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    GitBranch,
    Map as MapIcon,
    PhoneCall,
    ShieldCheck,
    X,
} from 'lucide-react';
import type { PublicCaseGeoPoint } from '@/lib/domain/map-data';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
    PublicCaseMap,
    type PublicMapFocusMode,
} from '@/components/landing/public-case-map';
import { WorkflowPillars } from '@/components/landing/workflow-pillars';
import { SpringSheet } from '@/components/ui/drawer';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export type PublicSurveillanceSummary = {
    totalThisMonth: number;
    peCompleted: number;
    foggingActive: number;
    closedCases: number;
    topKecamatan: { kecamatan: string; count: number }[];
};

export type PublicPortalBranding = {
    title: string;
    tagline: string;
    logoUrl: string | null;
    institutionName: string;
    emergencyHotline: string;
    supportEmail: string;
};

type MetricKey = 'total' | 'pe' | 'fogging' | 'closed';
type CommandView = 'overview' | 'alur' | 'edukasi' | 'darurat';
type PanelView = Exclude<CommandView, 'overview'>;

const VIEWS: readonly {
    id: CommandView;
    label: string;
    shortLabel: string;
    icon: typeof MapIcon;
    urgent?: boolean;
}[] = [
    {
        id: 'overview',
        label: 'Peta & Status',
        shortLabel: 'Peta',
        icon: MapIcon,
    },
    {
        id: 'alur',
        label: 'Alur 3 Pilar',
        shortLabel: 'Alur 3 Pilar',
        icon: GitBranch,
    },
    {
        id: 'edukasi',
        label: 'Edukasi 3M+',
        shortLabel: '3M+ & Bahaya',
        icon: ShieldCheck,
    },
    {
        id: 'darurat',
        label: 'Darurat 119',
        shortLabel: 'Darurat 119',
        icon: PhoneCall,
        urgent: true,
    },
] as const;

const PANEL_ORDER: readonly PanelView[] = ['alur', 'edukasi', 'darurat'];

const PANEL_META: Record<
    PanelView,
    { kicker: string; title: string; subtitle: string }
> = {
    alur: {
        kicker: 'Alur kolaborasi · 3 pilar',
        title: 'Tiga tahap pengendalian demam berdarah',
        subtitle:
            'Batas respons terukur (SLA) dari RS/Klinik, Puskesmas Wilayah, hingga Dinas Kesehatan Kota.',
    },
    edukasi: {
        kicker: 'Pencegahan & kewaspadaan dini',
        title: 'Langkah 3M Plus & tanda bahaya klinis',
        subtitle:
            'Pemutusan siklus nyamuk Aedes aegypti di rumah serta gejala klinis yang wajib segera dirujuk ke IGD.',
    },
    darurat: {
        kicker: 'Layanan gawat darurat 24 jam',
        title: 'Kontak darurat & rujukan cepat DBD',
        subtitle:
            'Gunakan kanal darurat bila demam tinggi disertai nyeri perut hebat, muntah terus-menerus, atau perdarahan.',
    },
};

const PREVENTION_3M = [
    {
        id: 'menguras',
        title: 'Menguras',
        cadence: 'Rutin 1× / minggu',
        focusArea: 'Bak mandi, toren, tatakan dispenser & vas bunga',
        checklist: [
            'Sikat dinding dalam penampungan air untuk melepas telur nyamuk menempel.',
            'Kosongkan tatakan pot tanaman, kulkas, dan tempat minum hewan peliharaan.',
            'Lakukan serentak tiap minggu sebelum jentik berkembang menjadi nyamuk dewasa.',
        ],
    },
    {
        id: 'menutup',
        title: 'Menutup',
        cadence: 'Setiap selesai pakai',
        focusArea: 'Toren, gentong, drum air & ember cadangan',
        checklist: [
            'Pastikan penutup tidak retak dan tidak menyisakan celah masuk nyamuk.',
            'Balikkan ember atau wadah luar ruangan saat sedang tidak terisi air.',
            'Periksa kasa pelindung pada lubang ventilasi tangki air.',
        ],
    },
    {
        id: 'mendaur-ulang',
        title: 'Mendaur Ulang',
        cadence: 'Audit pekarangan mingguan',
        focusArea: 'Botol bekas, ban luar, kaleng & talang hujan',
        checklist: [
            'Singkirkan atau daur ulang wadah bekas di halaman dan atap rumah.',
            'Simpan ban bekas di ruang tertutup atau lubangi agar air hujan tidak menggenang.',
            'Bersihkan talang air dari daun kering supaya aliran hujan tetap lancar.',
        ],
    },
    {
        id: 'plus',
        title: 'Plus Proteksi',
        cadence: 'Perlindungan harian',
        focusArea: 'Kamar tidur, ventilasi & penampungan sulit dikuras',
        checklist: [
            'Taburkan larvasida (abate) sesuai takaran pada penampungan sulit dikuras.',
            'Pasang kawat kasa ventilasi dan gunakan kelambu saat tidur siang/malam.',
            'Oleskan lotion antinyamuk terutama pagi (08.00–10.00) dan sore (15.00–17.00).',
        ],
    },
] as const;

const WARNING_SIGNS = [
    'Nyeri perut hebat atau menetap',
    'Muntah terus-menerus dan tidak dapat minum',
    'Perdarahan gusi, mimisan, atau muntah darah',
    'Lemas luar biasa, gelisah, atau ujung jari dingin',
] as const;

const EMERGENCY_PREP = [
    'Catat hari keberapa demam mulai muncul (fase kritis umumnya hari ke-3 hingga ke-6).',
    'Siapkan hasil lab darah terakhir (trombosit & hematokrit) bila sudah diperiksa.',
    'Sampaikan alamat domisili lengkap beserta kelurahan/RT untuk koordinasi ambulans & PE.',
] as const;

const panelBodyVariants = {
    enter: ({
        direction,
        reduce,
        instant,
    }: {
        direction: -1 | 0 | 1;
        reduce: boolean;
        instant: boolean;
    }) => ({
        opacity: instant ? 1 : 0,
        x: reduce || instant ? 0 : direction * 18,
    }),
    center: {
        opacity: 1,
        x: 0,
    },
    exit: ({
        direction,
        reduce,
        instant,
    }: {
        direction: -1 | 0 | 1;
        reduce: boolean;
        instant: boolean;
    }) => ({
        opacity: 0,
        x: reduce || instant ? 0 : direction * -18,
    }),
};

/** Precision 280ms quartic ease-out integer settle on mount; skips when reduced-motion is set. */
function AnimatedNumber({ value }: { value: number }) {
    const [display, setDisplay] = useState(value);

    useEffect(() => {
        if (value <= 0 || typeof window === 'undefined') return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        const startValue = value > 12 ? Math.round(value * 0.65) : 0;
        const delta = value - startValue;
        const duration = 280;
        let rafId = 0;
        const t0 = performance.now();

        const tick = (now: number) => {
            const progress = Math.min(1, (now - t0) / duration);
            const eased = 1 - Math.pow(1 - progress, 4);
            setDisplay(Math.round(startValue + delta * eased));
            if (progress < 1) {
                rafId = window.requestAnimationFrame(tick);
            }
        };

        rafId = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(rafId);
    }, [value]);

    return <>{formatNumber(value <= 0 ? value : display)}</>;
}

export function PublicSurveillanceHero({
    cases,
    summary,
    branding,
}: {
    cases: PublicCaseGeoPoint[];
    summary: PublicSurveillanceSummary;
    branding?: PublicPortalBranding;
}) {
    const reduce = Boolean(useReducedMotion());
    const [selectedKey, setSelectedKey] = useState<MetricKey | null>(null);
    const [viewState, setViewState] = useState<{
        view: CommandView;
        direction: -1 | 0 | 1;
        instant: boolean;
    }>({ view: 'overview', direction: 0, instant: false });
    const [active3mIdx, setActive3mIdx] = useState(0);
    const [isMobileSheet, setIsMobileSheet] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 767px)');
        const sync = () => setIsMobileSheet(mq.matches);
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);

    const tablistRef = useRef<HTMLDivElement>(null);
    const tabOverlayRef = useRef<HTMLDivElement>(null);
    const desktopTabRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const hasMeasuredTabRef = useRef(false);

    const title = branding?.title || 'WALI-EPI';
    const tagline = branding?.tagline || 'Surveilans DBD';
    const logoUrl = branding?.logoUrl ?? null;
    const institutionName = branding?.institutionName || 'Dinas Kesehatan';
    const emergencyHotline = branding?.emergencyHotline || '119';
    const supportEmail = branding?.supportEmail?.trim() || '';
    const hotlineHref = `tel:${emergencyHotline.replace(/[^\d+]/g, '') || '119'}`;
    const daruratTabLabel =
        emergencyHotline.length <= 6
            ? `Darurat ${emergencyHotline}`
            : 'Darurat';
    const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
    const showLogo = Boolean(logoUrl) && failedLogoUrl !== logoUrl;

    const activeView = viewState.view;
    const activePanel: PanelView | null =
        activeView === 'overview' ? null : activeView;

    const navigateView = useCallback(
        (nextView: CommandView, instant = false) => {
            setViewState((prev) => {
                if (prev.view === nextView) return prev;
                let direction: -1 | 0 | 1 = 0;
                if (prev.view !== 'overview' && nextView !== 'overview') {
                    const prevIdx = PANEL_ORDER.indexOf(prev.view);
                    const nextIdx = PANEL_ORDER.indexOf(nextView);
                    direction = nextIdx > prevIdx ? 1 : -1;
                }
                return { view: nextView, direction, instant };
            });
        },
        [],
    );

    const updateTabClip = useCallback(
        (instant: boolean) => {
            const track = tablistRef.current;
            const overlay = tabOverlayRef.current;
            const activeIdx = VIEWS.findIndex((v) => v.id === activeView);
            const el = desktopTabRefs.current[activeIdx];
            if (!track || !overlay || !el || track.clientWidth === 0) return;

            const left = el.offsetLeft;
            const top = el.offsetTop;
            const right = Math.max(
                0,
                track.clientWidth - (left + el.offsetWidth),
            );
            const bottom = Math.max(
                0,
                track.clientHeight - (top + el.offsetHeight),
            );

            const skipTransition =
                instant || reduce || !hasMeasuredTabRef.current;
            overlay.dataset.instant = skipTransition ? 'true' : 'false';
            overlay.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round 6px)`;
            overlay.style.opacity = '1';
            track.dataset.clipReady = 'true';

            if (!hasMeasuredTabRef.current) {
                hasMeasuredTabRef.current = true;
            }
        },
        [activeView, reduce],
    );

    useLayoutEffect(() => {
        updateTabClip(viewState.instant);
    }, [updateTabClip, viewState.instant]);

    useEffect(() => {
        const track = tablistRef.current;
        if (!track || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => updateTabClip(true));
        observer.observe(track);
        return () => observer.disconnect();
    }, [updateTabClip]);

    useEffect(() => {
        if (!activePanel) return;
        const onKeyDown = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Escape') {
                navigateView('overview', true);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [activePanel, navigateView]);

    function handleNavKeyDown(
        e: KeyboardEvent<HTMLButtonElement>,
        idx: number,
    ) {
        let nextIdx: number | null = null;
        if (e.key === 'ArrowRight') nextIdx = (idx + 1) % VIEWS.length;
        else if (e.key === 'ArrowLeft')
            nextIdx = (idx - 1 + VIEWS.length) % VIEWS.length;
        else if (e.key === 'Home') nextIdx = 0;
        else if (e.key === 'End') nextIdx = VIEWS.length - 1;

        if (nextIdx !== null) {
            e.preventDefault();
            // Keyboard nav is high-frequency: 0ms transition (no animation)
            navigateView(VIEWS[nextIdx].id, true);
            desktopTabRefs.current[nextIdx]?.focus();
        }
    }

    const clusterCount = cases.filter((c) => Boolean(c.clusterId)).length;
    const sporadicCount = cases.length - clusterCount;
    const peRate =
        summary.totalThisMonth > 0
            ? Math.min(
                  100,
                  Math.round(
                      (summary.peCompleted / summary.totalThisMonth) * 100,
                  ),
              )
            : null;
    const closedRate =
        summary.totalThisMonth > 0
            ? Math.min(
                  100,
                  Math.round(
                      (summary.closedCases / summary.totalThisMonth) * 100,
                  ),
              )
            : null;

    const topKecamatanText =
        summary.topKecamatan.length > 0
            ? summary.topKecamatan
                  .slice(0, 3)
                  .map(
                      (item) =>
                          `${item.kecamatan} (${formatNumber(item.count)})`,
                  )
                  .join(' · ')
            : 'Belum ada sebaran kecamatan tercatat';

    const cards: {
        key: MetricKey;
        label: string;
        value: number;
        caption: string;
        accent: boolean;
        focusMode: PublicMapFocusMode;
        mapFocusLabel: string;
        summaryTitle: string;
        summaryDetail: string;
        summaryMeta: string;
    }[] = [
        {
            key: 'total',
            label: 'Laporan bulan ini',
            value: summary.totalThisMonth,
            caption: 'KDRS RS & klinik',
            accent: false,
            focusMode: 'all',
            mapFocusLabel: 'Semua titik aktif',
            summaryTitle: 'Konsentrasi laporan KDRS bulan ini',
            summaryDetail: topKecamatanText,
            summaryMeta: `${formatNumber(cases.length)} titik pada peta`,
        },
        {
            key: 'pe',
            label: 'PE terverifikasi',
            value: summary.peCompleted,
            caption: 'Investigasi 72 jam',
            accent: false,
            focusMode: 'sporadic',
            mapFocusLabel: 'Kasus tunggal terverifikasi',
            summaryTitle: 'Cakupan investigasi lapangan (PE)',
            summaryDetail:
                peRate !== null
                    ? `${peRate}% laporan bulan ini telah melalui pemeriksaan jentik 100 rumah & ABJ.`
                    : 'Menunggu penyelesaian investigasi PE pertama bulan ini.',
            summaryMeta: `${formatNumber(sporadicCount)} titik tunggal`,
        },
        {
            key: 'fogging',
            label: 'Tindak lanjut aktif',
            value: summary.foggingActive,
            caption: 'Fokus radius 100 m',
            accent: true,
            focusMode: 'cluster',
            mapFocusLabel: 'Klaster radius 100 m',
            summaryTitle: 'Prioritas klaster radius 100 meter',
            summaryDetail:
                clusterCount > 0
                    ? `${formatNumber(clusterCount)} titik klaster aktif disorot merah di peta untuk intervensi PSN & fogging.`
                    : 'Tidak ada klaster aktif terdeteksi pada sebaran peta saat ini.',
            summaryMeta:
                clusterCount > 0
                    ? `${formatNumber(clusterCount)} titik klaster`
                    : '0 klaster aktif',
        },
        {
            key: 'closed',
            label: 'Kasus ditutup',
            value: summary.closedCases,
            caption: 'Intervensi selesai',
            accent: false,
            focusMode: 'all',
            mapFocusLabel: 'Semua titik aktif',
            summaryTitle: 'Penyelesaian respons wilayah',
            summaryDetail:
                closedRate !== null
                    ? `${closedRate}% kasus bulan ini telah menyelesaikan seluruh rangkaian PE & tindak lanjut.`
                    : 'Belum ada penutupan kasus tercatat pada periode berjalan.',
            summaryMeta: `${formatNumber(summary.closedCases)} selesai`,
        },
    ];

    const selectedCard = cards.find((c) => c.key === selectedKey) ?? null;
    const activeFocusMode: PublicMapFocusMode =
        selectedCard?.focusMode ?? 'all';
    const active3m = PREVENTION_3M[active3mIdx] ?? PREVENTION_3M[0];

    const shellTransition = viewState.instant
        ? { duration: 0 }
        : { duration: reduce ? 0.14 : 0.22, ease: EASE_OUT };

    const exitTransition = viewState.instant
        ? { duration: 0 }
        : { duration: reduce ? 0.12 : 0.16, ease: EASE_OUT };

    return (
        <div className="flex h-dvh flex-col overflow-hidden">
            {/* Static Command Header (never moves during view transitions) */}
            <header className="z-30 shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-sm">
                <nav
                    aria-label="Navigasi command center publik"
                    className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-4 md:px-6"
                >
                    <button
                        type="button"
                        onClick={() => navigateView('overview')}
                        className="flex max-w-[200px] min-w-0 cursor-pointer items-center gap-2.5 text-left transition-opacity duration-150 hover:opacity-85 active:scale-[0.98] lg:max-w-[240px]"
                        aria-label={`${title} — kembali ke peta & status`}
                    >
                        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--accent-ink)]">
                            {showLogo && logoUrl ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                    src={logoUrl}
                                    alt={title}
                                    onError={() => setFailedLogoUrl(logoUrl)}
                                    className="size-8 object-contain"
                                />
                            ) : (
                                <Activity
                                    className="size-4"
                                    strokeWidth={1.75}
                                />
                            )}
                        </span>
                        <span className="min-w-0 leading-tight">
                            <span
                                title={title}
                                className="block truncate text-[14px] font-semibold tracking-[-0.015em] text-foreground"
                            >
                                {title}
                            </span>
                            <span
                                title={tagline}
                                className="block truncate font-mono text-[11px] text-muted-foreground"
                            >
                                {tagline}
                            </span>
                        </span>
                    </button>

                    {/* Desktop Segmented View Switcher with Compositor-Only Sliding Clip-Path Indicator */}
                    <div
                        ref={tablistRef}
                        role="tablist"
                        aria-label="Tampilan portal publik"
                        className="group relative hidden items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-1 md:flex"
                    >
                        {VIEWS.map((item, idx) => {
                            const Icon = item.icon;
                            const isSelected = activeView === item.id;
                            return (
                                <button
                                    key={item.id}
                                    ref={(node) => {
                                        desktopTabRefs.current[idx] = node;
                                    }}
                                    type="button"
                                    role="tab"
                                    aria-selected={isSelected}
                                    tabIndex={isSelected ? 0 : -1}
                                    onClick={() => navigateView(item.id, false)}
                                    onKeyDown={(e) => handleNavKeyDown(e, idx)}
                                    className={cn(
                                        'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[6px] px-3 text-[13px] font-medium whitespace-nowrap transition-[color,transform] duration-150 ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:outline-none',
                                        isSelected
                                            ? item.urgent
                                                ? 'bg-[var(--negative)] text-white shadow-xs group-data-[clip-ready=true]:bg-transparent group-data-[clip-ready=true]:text-[var(--negative)] group-data-[clip-ready=true]:shadow-none'
                                                : 'bg-[var(--surface)] text-foreground shadow-xs group-data-[clip-ready=true]:bg-transparent group-data-[clip-ready=true]:shadow-none'
                                            : item.urgent
                                              ? 'text-[var(--negative)]/85 hover:text-[var(--negative)] active:scale-[0.97]'
                                              : 'text-muted-foreground hover:text-foreground active:scale-[0.97]',
                                    )}
                                >
                                    <Icon
                                        className="size-3.5 shrink-0"
                                        strokeWidth={1.75}
                                        aria-hidden
                                    />
                                    {item.id === 'darurat'
                                        ? daruratTabLabel
                                        : item.label}
                                </button>
                            );
                        })}

                        {/* Duplicated active layer clipped to active tab for seamless pill + text/icon color transition */}
                        <div
                            ref={tabOverlayRef}
                            aria-hidden
                            style={{
                                opacity: 0,
                                clipPath: 'inset(0 100% 0 0 round 6px)',
                            }}
                            className="nav-tab-clip pointer-events-none absolute inset-0 flex items-center gap-1 p-1"
                        >
                            {VIEWS.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <span
                                        key={item.id}
                                        className={cn(
                                            'inline-flex h-8 items-center gap-1.5 rounded-[6px] px-3 text-[13px] font-medium whitespace-nowrap',
                                            item.urgent
                                                ? 'bg-[var(--negative)] text-white ring-1 ring-black/10 ring-inset'
                                                : 'bg-[var(--surface)] text-foreground ring-1 ring-black/[0.06] ring-inset dark:ring-white/10',
                                        )}
                                    >
                                        <Icon
                                            className="size-3.5 shrink-0"
                                            strokeWidth={1.75}
                                            aria-hidden
                                        />
                                        {item.id === 'darurat'
                                            ? daruratTabLabel
                                            : item.label}
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                    {/* Portal Auth Actions */}
                    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                        <Link
                            href="/daftar"
                            className="hidden h-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] font-medium whitespace-nowrap text-foreground transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-out)] hover:border-[var(--control)] hover:bg-[var(--raised)] active:scale-[0.97] sm:inline-flex"
                        >
                            Registrasi
                        </Link>
                        <Link
                            href="/masuk"
                            className="cta-portal inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent)] px-3.5 text-[13px] font-medium whitespace-nowrap text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:outline-none"
                        >
                            Masuk portal
                            <ArrowRight
                                className="cta-arrow size-3.5"
                                strokeWidth={1.75}
                                aria-hidden
                            />
                        </Link>
                    </div>
                </nav>
            </header>

            {/* Single 100dvh Stage: Base Layer stays mounted; Interactive Panel overlays with zero layout shift */}
            <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                {/* Base Layer: Peta + Statistik (permanently mounted — Leaflet never reloads) */}
                <div
                    aria-hidden={activePanel !== null}
                    inert={activePanel !== null ? true : undefined}
                    className={cn(
                        'mx-auto flex h-full w-full max-w-[1440px] flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4 md:px-6 lg:min-h-0 lg:overflow-hidden lg:py-5',
                        viewState.instant
                            ? 'transition-none'
                            : 'transition-[transform,opacity] duration-200 ease-[var(--ease-out)]',
                        activePanel !== null
                            ? reduce
                                ? 'pointer-events-none opacity-35'
                                : 'pointer-events-none scale-[0.988] opacity-40'
                            : 'scale-100 opacity-100',
                    )}
                >
                    <div className="grid flex-1 grid-cols-1 gap-4 lg:min-h-0 lg:grid-cols-12 lg:gap-5">
                        {/* Left Command Column: Hero + 2x2 Surveillance KPIs + Fixed Context Strip */}
                        <section
                            aria-label="Ringkasan surveilans DBD"
                            className="flex flex-col justify-between gap-4 lg:col-span-5 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1"
                        >
                            {/* Hero Header */}
                            <div className="space-y-3">
                                <div className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                                    <span
                                        aria-hidden
                                        className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                                    />
                                    <span
                                        title={institutionName}
                                        className="min-w-0 truncate"
                                    >
                                        {institutionName}
                                    </span>
                                    <span aria-hidden className="shrink-0">
                                        ·
                                    </span>
                                    <span className="shrink-0 whitespace-nowrap text-[var(--accent)]">
                                        Surveilans Aktif
                                    </span>
                                </div>

                                <h1 className="max-w-[17ch] text-[28px] leading-[1.08] font-semibold tracking-[-0.028em] text-foreground sm:text-[34px] lg:text-[36px]">
                                    Pantau sebaran DBD, satu jalur
                                </h1>

                                <p className="max-w-[46ch] text-[14px] leading-relaxed text-muted-foreground">
                                    Menghubungkan notifikasi KDRS Rumah Sakit,
                                    investigasi jentik PE 72 jam Puskesmas, dan
                                    intervensi Dinas Kesehatan dengan enkripsi
                                    PII AES-256.
                                </p>

                                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                    <Link
                                        href="/masuk"
                                        className="cta-portal inline-flex h-10 items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-[13px] font-medium text-[var(--accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:outline-none"
                                    >
                                        Masuk portal petugas
                                        <ArrowRight
                                            className="cta-arrow size-3.5"
                                            strokeWidth={1.75}
                                            aria-hidden
                                        />
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            navigateView('alur', false)
                                        }
                                        className="inline-flex h-10 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3.5 text-[13px] font-medium text-foreground transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-out)] hover:border-[var(--control)] hover:bg-[var(--raised)] active:scale-[0.97]"
                                    >
                                        Alur 3 pilar
                                    </button>
                                    <button
                                        type="button"
                                        data-variant="outline"
                                        onClick={() =>
                                            navigateView('darurat', false)
                                        }
                                        className="cta-emergency inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--negative)]/35 bg-[var(--surface)] px-3.5 text-[13px] font-medium text-[var(--negative)] focus-visible:ring-2 focus-visible:ring-[var(--negative)]/40 focus-visible:outline-none"
                                    >
                                        <PhoneCall
                                            className="cta-phone size-3.5"
                                            strokeWidth={1.75}
                                            aria-hidden
                                        />
                                        Panggil {emergencyHotline}
                                    </button>
                                </div>
                            </div>

                            {/* 2x2 Real-Time Surveillance Stat Cards */}
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="font-mono text-[11px] font-medium tracking-[0.04em] text-muted-foreground uppercase">
                                        Status surveilans · klik untuk sorot
                                        peta
                                    </p>
                                    {selectedCard ? (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedKey(null)}
                                            className="inline-flex cursor-pointer items-center gap-1 font-mono text-[11px] text-[var(--accent)] hover:underline"
                                        >
                                            Reset sorotan
                                        </button>
                                    ) : null}
                                </div>

                                <div className="grid grid-cols-2 gap-2.5">
                                    {cards.map((item) => {
                                        const isSelected =
                                            selectedKey === item.key;
                                        return (
                                            <button
                                                key={item.key}
                                                type="button"
                                                aria-pressed={isSelected}
                                                onClick={() =>
                                                    setSelectedKey((prev) =>
                                                        prev === item.key
                                                            ? null
                                                            : item.key,
                                                    )
                                                }
                                                className={cn(
                                                    'kpi-tile relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-[var(--radius-card)] border p-3.5 text-left focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:outline-none',
                                                    isSelected
                                                        ? item.accent
                                                            ? 'border-[var(--negative)] bg-[var(--negative)]/[0.06]'
                                                            : 'border-[var(--accent)] bg-[var(--accent)]/[0.06]'
                                                        : 'border-[var(--border)] bg-[var(--surface)]',
                                                )}
                                            >
                                                <span
                                                    aria-hidden
                                                    className={cn(
                                                        'kpi-tile-bar absolute inset-x-0 top-0 h-[2px]',
                                                        item.accent
                                                            ? 'bg-[var(--negative)]'
                                                            : 'bg-[var(--accent)]',
                                                    )}
                                                />
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="truncate text-[12px] text-muted-foreground">
                                                        {item.label}
                                                    </span>
                                                    <span
                                                        aria-hidden
                                                        className={cn(
                                                            'kpi-tile-dot size-1.5 shrink-0 rounded-full',
                                                            isSelected
                                                                ? item.accent
                                                                    ? 'bg-[var(--negative)]'
                                                                    : 'bg-[var(--accent)]'
                                                                : 'bg-[var(--border)]',
                                                        )}
                                                    />
                                                </div>
                                                <p
                                                    className={cn(
                                                        'mt-1.5 font-mono text-[clamp(1.25rem,3.6vw,1.625rem)] leading-none font-semibold tracking-[-0.02em] tabular-nums',
                                                        item.accent &&
                                                            item.value > 0
                                                            ? 'text-[var(--negative)]'
                                                            : 'text-foreground',
                                                    )}
                                                >
                                                    <AnimatedNumber
                                                        value={item.value}
                                                    />
                                                </p>
                                                <p
                                                    title={item.caption}
                                                    className="mt-1.5 truncate text-[11px] text-muted-foreground"
                                                >
                                                    {item.caption}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Fixed-height Context Strip: blur-masked crossfade with zero vertical layout shift */}
                                <div className="relative flex min-h-[76px] items-center overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
                                    <AnimatePresence
                                        mode="popLayout"
                                        initial={false}
                                    >
                                        <motion.div
                                            key={selectedCard?.key ?? 'default'}
                                            initial={
                                                reduce
                                                    ? { opacity: 0 }
                                                    : {
                                                          opacity: 0,
                                                          filter: 'blur(1.5px)',
                                                      }
                                            }
                                            animate={
                                                reduce
                                                    ? { opacity: 1 }
                                                    : {
                                                          opacity: 1,
                                                          filter: 'blur(0px)',
                                                      }
                                            }
                                            exit={
                                                reduce
                                                    ? { opacity: 0 }
                                                    : {
                                                          opacity: 0,
                                                          filter: 'blur(1.5px)',
                                                      }
                                            }
                                            transition={{
                                                duration: reduce ? 0.1 : 0.16,
                                                ease: EASE_OUT,
                                            }}
                                            className="flex w-full items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <p
                                                    title={
                                                        selectedCard
                                                            ? selectedCard.summaryTitle
                                                            : 'Sebaran kecamatan tertinggi'
                                                    }
                                                    className="truncate text-[12px] font-medium text-foreground"
                                                >
                                                    {selectedCard
                                                        ? selectedCard.summaryTitle
                                                        : 'Sebaran kecamatan tertinggi'}
                                                </p>
                                                <p
                                                    title={
                                                        selectedCard
                                                            ? selectedCard.summaryDetail
                                                            : topKecamatanText
                                                    }
                                                    className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground"
                                                >
                                                    {selectedCard
                                                        ? selectedCard.summaryDetail
                                                        : topKecamatanText}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 flex-col items-end gap-1">
                                                <span className="rounded-[var(--radius-control)] bg-[var(--raised)] px-2 py-0.5 font-mono text-[11px] text-foreground tabular-nums">
                                                    {selectedCard
                                                        ? selectedCard.summaryMeta
                                                        : `${formatNumber(cases.length)} titik`}
                                                </span>
                                                {selectedCard ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setSelectedKey(null)
                                                        }
                                                        aria-label="Tutup sorotan metrik"
                                                        className="inline-flex cursor-pointer items-center gap-0.5 text-[11px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
                                                    >
                                                        <X
                                                            className="size-3"
                                                            strokeWidth={1.75}
                                                        />
                                                        Reset
                                                    </button>
                                                ) : null}
                                            </div>
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Compact Bottom Bar (desktop) */}
                            <div className="hidden items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5 text-[11px] text-muted-foreground lg:flex">
                                <span className="truncate">
                                    Anonim · Tanpa nama/NIK pada peta publik
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        navigateView('edukasi', false)
                                    }
                                    className="shrink-0 cursor-pointer font-medium text-[var(--accent)] hover:underline"
                                >
                                    Panduan 3M+ & Tanda Bahaya →
                                </button>
                            </div>
                        </section>

                        {/* Right Command Column: Full-height Live Leaflet Spatial Map */}
                        <section
                            aria-label="Peta sebaran kasus DBD"
                            className="flex min-h-[380px] flex-col lg:col-span-7 lg:min-h-0"
                        >
                            <PublicCaseMap
                                cases={cases}
                                fill
                                focusMode={activeFocusMode}
                                focusLabel={selectedCard?.mapFocusLabel}
                                onResetFocus={() => setSelectedKey(null)}
                            />
                        </section>
                    </div>
                </div>

                {/* Choreographed Interactive Panel Overlay (md+: side panel; <md: thumb-reachable SpringSheet bottom sheet) */}
                <AnimatePresence>
                    {!isMobileSheet && activePanel ? (
                        <div
                            key="command-panel-layer"
                            className="fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top,0px))] bottom-0 z-20 hidden justify-end md:flex lg:absolute lg:inset-0"
                        >
                            {/* Scrim (Decoration): fades simultaneously with panel lead */}
                            <motion.button
                                type="button"
                                aria-label="Kembali ke peta dan statistik"
                                onClick={() => navigateView('overview', false)}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={
                                    viewState.instant
                                        ? { duration: 0 }
                                        : { duration: 0.18, ease: EASE_OUT }
                                }
                                className="absolute inset-0 cursor-default bg-black/20 backdrop-blur-[2px] dark:bg-black/45"
                            />

                            {/* Panel Shell (Lead): one entrance per container, exits back along entry axis */}
                            <motion.section
                                role="dialog"
                                aria-modal="true"
                                aria-label={PANEL_META[activePanel].title}
                                initial={
                                    viewState.instant
                                        ? false
                                        : {
                                              opacity: 0,
                                              x: reduce ? 0 : 24,
                                          }
                                }
                                animate={{
                                    opacity: 1,
                                    x: 0,
                                    transition: shellTransition,
                                }}
                                exit={{
                                    opacity: 0,
                                    x: reduce || viewState.instant ? 0 : 24,
                                    transition: exitTransition,
                                }}
                                className="relative z-10 flex h-full w-full flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-[var(--elev-soft)] lg:w-[min(1080px,88vw)]"
                            >
                                {/* Static Panel Top Bar */}
                                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 md:px-6">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                navigateView('overview', false)
                                            }
                                            className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--ground)] px-2.5 text-[12px] font-medium text-foreground transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-[var(--raised)] active:scale-[0.97]"
                                        >
                                            <ArrowLeft
                                                className="size-3.5"
                                                strokeWidth={1.75}
                                                aria-hidden
                                            />
                                            <span>Peta</span>
                                            <kbd className="hidden rounded bg-[var(--surface)] px-1 font-mono text-[10px] text-muted-foreground sm:inline">
                                                Esc
                                            </kbd>
                                        </button>

                                        <div className="min-w-0">
                                            <p
                                                className={cn(
                                                    'truncate font-mono text-[11px]',
                                                    activePanel === 'darurat'
                                                        ? 'text-[var(--negative)]'
                                                        : 'text-[var(--accent)]',
                                                )}
                                            >
                                                {PANEL_META[activePanel].kicker}
                                            </p>
                                            <h2 className="truncate text-[16px] font-semibold tracking-[-0.015em] text-foreground md:text-[18px]">
                                                {PANEL_META[activePanel].title}
                                            </h2>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            navigateView('overview', false)
                                        }
                                        aria-label="Tutup panel"
                                        className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] text-muted-foreground transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] hover:bg-[var(--raised)] hover:text-foreground active:scale-[0.96]"
                                    >
                                        <X
                                            className="size-4"
                                            strokeWidth={1.75}
                                        />
                                    </button>
                                </div>

                                {/* Internal Panel Body: directional popLayout swap ONLY between sibling panels (initial={false} prevents double entrance on open) */}
                                <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] md:px-6">
                                    <AnimatePresence
                                        mode="popLayout"
                                        initial={false}
                                        custom={{
                                            direction: viewState.direction,
                                            reduce,
                                            instant: viewState.instant,
                                        }}
                                    >
                                        <motion.div
                                            key={activePanel}
                                            custom={{
                                                direction: viewState.direction,
                                                reduce,
                                                instant: viewState.instant,
                                            }}
                                            variants={panelBodyVariants}
                                            initial="enter"
                                            animate="center"
                                            exit="exit"
                                            transition={
                                                viewState.instant
                                                    ? { duration: 0 }
                                                    : {
                                                          duration: reduce
                                                              ? 0.12
                                                              : 0.18,
                                                          ease: EASE_OUT,
                                                      }
                                            }
                                            className="w-full"
                                        >
                                            {activePanel === 'alur' ? (
                                                <div className="space-y-4">
                                                    <p className="max-w-[68ch] text-[14px] leading-relaxed text-muted-foreground">
                                                        {
                                                            PANEL_META.alur
                                                                .subtitle
                                                        }
                                                    </p>
                                                    <WorkflowPillars className="mt-0" />
                                                </div>
                                            ) : null}

                                            {activePanel === 'edukasi' ? (
                                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                                                    {/* Left: Interactive 3M Plus Checklist */}
                                                    <div className="flex flex-col gap-4 lg:col-span-7">
                                                        <p className="text-[14px] leading-relaxed text-muted-foreground">
                                                            {
                                                                PANEL_META
                                                                    .edukasi
                                                                    .subtitle
                                                            }
                                                        </p>

                                                        <div
                                                            role="tablist"
                                                            aria-label="Langkah pencegahan 3M Plus"
                                                            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                                                        >
                                                            {PREVENTION_3M.map(
                                                                (item, idx) => {
                                                                    const isSelected =
                                                                        idx ===
                                                                        active3mIdx;
                                                                    return (
                                                                        <button
                                                                            key={
                                                                                item.id
                                                                            }
                                                                            type="button"
                                                                            role="tab"
                                                                            aria-selected={
                                                                                isSelected
                                                                            }
                                                                            onClick={() =>
                                                                                setActive3mIdx(
                                                                                    idx,
                                                                                )
                                                                            }
                                                                            className={cn(
                                                                                'flex min-h-[44px] cursor-pointer flex-col justify-between rounded-[var(--radius-control)] border px-3 py-2.5 text-left transition-[border-color,background-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97]',
                                                                                isSelected
                                                                                    ? 'border-[var(--accent)] bg-[var(--accent)]/[0.08] text-foreground'
                                                                                    : 'border-[var(--border)] bg-[var(--ground)] text-muted-foreground hover:text-foreground',
                                                                            )}
                                                                        >
                                                                            <span className="font-mono text-[11px] text-[var(--accent)] tabular-nums">
                                                                                0
                                                                                {idx +
                                                                                    1}
                                                                            </span>
                                                                            <span className="mt-1 text-[13px] font-medium text-foreground">
                                                                                {
                                                                                    item.title
                                                                                }
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                },
                                                            )}
                                                        </div>

                                                        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--ground)] p-5">
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <h3 className="text-[16px] font-semibold text-foreground">
                                                                    {
                                                                        active3m.title
                                                                    }
                                                                </h3>
                                                                <span className="rounded-[var(--radius-control)] bg-[var(--surface)] px-2.5 py-1 font-mono text-[11px] text-[var(--accent)]">
                                                                    {
                                                                        active3m.cadence
                                                                    }
                                                                </span>
                                                            </div>
                                                            <p className="mt-1 font-mono text-[12px] text-muted-foreground">
                                                                Area fokus:{' '}
                                                                {
                                                                    active3m.focusArea
                                                                }
                                                            </p>
                                                            <ul className="mt-4 space-y-2.5">
                                                                {active3m.checklist.map(
                                                                    (line) => (
                                                                        <li
                                                                            key={
                                                                                line
                                                                            }
                                                                            className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-foreground"
                                                                        >
                                                                            <CheckCircle2
                                                                                className="mt-0.5 size-4 shrink-0 text-[var(--accent)]"
                                                                                strokeWidth={
                                                                                    1.75
                                                                                }
                                                                                aria-hidden
                                                                            />
                                                                            <span>
                                                                                {
                                                                                    line
                                                                                }
                                                                            </span>
                                                                        </li>
                                                                    ),
                                                                )}
                                                            </ul>
                                                        </div>
                                                    </div>

                                                    {/* Right: Clinical Red-Flag Warning Signs */}
                                                    <div className="flex flex-col justify-between rounded-[var(--radius-card)] border border-[var(--negative)]/30 bg-[var(--negative)]/[0.04] p-5 lg:col-span-5">
                                                        <div>
                                                            <div className="flex items-center gap-2 text-[var(--negative)]">
                                                                <AlertTriangle
                                                                    className="size-4 shrink-0"
                                                                    strokeWidth={
                                                                        1.75
                                                                    }
                                                                    aria-hidden
                                                                />
                                                                <span className="font-mono text-[11px] font-semibold tracking-[0.04em] uppercase">
                                                                    Tanda bahaya
                                                                    klinis DBD
                                                                </span>
                                                            </div>
                                                            <h3 className="mt-2 text-[17px] font-semibold text-foreground">
                                                                Segera bawa ke
                                                                IGD bila muncul
                                                                gejala ini
                                                            </h3>
                                                            <ul className="mt-4 space-y-2.5">
                                                                {WARNING_SIGNS.map(
                                                                    (sign) => (
                                                                        <li
                                                                            key={
                                                                                sign
                                                                            }
                                                                            className="flex items-start gap-2.5 rounded-[var(--radius-control)] border border-[var(--negative)]/20 bg-[var(--surface)] px-3 py-2.5 text-[13px] font-medium text-foreground"
                                                                        >
                                                                            <span
                                                                                aria-hidden
                                                                                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--negative)]"
                                                                            />
                                                                            <span>
                                                                                {
                                                                                    sign
                                                                                }
                                                                            </span>
                                                                        </li>
                                                                    ),
                                                                )}
                                                            </ul>
                                                        </div>

                                                        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--negative)]/20 pt-4">
                                                            <p className="text-[12px] text-muted-foreground">
                                                                Butuh ambulans
                                                                atau rujukan?
                                                            </p>
                                                            <button
                                                                type="button"
                                                                data-variant="solid"
                                                                onClick={() =>
                                                                    navigateView(
                                                                        'darurat',
                                                                        false,
                                                                    )
                                                                }
                                                                className="cta-emergency inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--negative)] px-3.5 text-[12px] font-medium text-white focus-visible:ring-2 focus-visible:ring-[var(--negative)]/40 focus-visible:outline-none"
                                                            >
                                                                <PhoneCall
                                                                    className="cta-phone size-3.5"
                                                                    strokeWidth={
                                                                        1.75
                                                                    }
                                                                    aria-hidden
                                                                />
                                                                Buka Darurat{' '}
                                                                {
                                                                    emergencyHotline
                                                                }
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : null}

                                            {activePanel === 'darurat' ? (
                                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                                                    <div className="flex flex-col justify-between rounded-[var(--radius-card)] border border-[var(--negative)]/35 bg-[var(--negative)]/[0.04] p-6 lg:col-span-6">
                                                        <div>
                                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--negative)]/12 px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--negative)]">
                                                                <PhoneCall
                                                                    className="size-3"
                                                                    strokeWidth={
                                                                        1.75
                                                                    }
                                                                    aria-hidden
                                                                />
                                                                Layanan Gawat
                                                                Darurat 24/7
                                                            </span>
                                                            <p className="mt-4 font-mono text-[clamp(1.75rem,3vw,2.75rem)] leading-tight font-semibold tracking-[-0.03em] [overflow-wrap:anywhere] text-[var(--negative)] tabular-nums">
                                                                {
                                                                    emergencyHotline
                                                                }
                                                            </p>
                                                            <h3 className="mt-2 text-[18px] font-semibold text-foreground">
                                                                PSC{' '}
                                                                {
                                                                    emergencyHotline
                                                                }{' '}
                                                                ·{' '}
                                                                {
                                                                    institutionName
                                                                }
                                                            </h3>
                                                            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                                                                {
                                                                    PANEL_META
                                                                        .darurat
                                                                        .subtitle
                                                                }
                                                            </p>
                                                        </div>

                                                        <div className="mt-6 flex flex-wrap items-center gap-2.5">
                                                            <a
                                                                href={
                                                                    hotlineHref
                                                                }
                                                                data-variant="solid"
                                                                className="cta-emergency inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--negative)] px-5 text-[14px] font-medium text-white focus-visible:ring-2 focus-visible:ring-[var(--negative)]/40 focus-visible:outline-none"
                                                            >
                                                                <PhoneCall
                                                                    className="cta-phone size-4"
                                                                    strokeWidth={
                                                                        1.75
                                                                    }
                                                                    aria-hidden
                                                                />
                                                                Panggil{' '}
                                                                {
                                                                    emergencyHotline
                                                                }{' '}
                                                                sekarang
                                                            </a>
                                                            {supportEmail ? (
                                                                <a
                                                                    href={`mailto:${supportEmail}`}
                                                                    className="inline-flex min-h-11 max-w-full items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-center font-mono text-[12px] [overflow-wrap:anywhere] text-foreground transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-[var(--raised)] active:scale-[0.97]"
                                                                >
                                                                    {
                                                                        supportEmail
                                                                    }
                                                                </a>
                                                            ) : null}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--ground)] p-6 lg:col-span-6">
                                                        <div>
                                                            <p className="font-mono text-[11px] text-[var(--accent)] uppercase">
                                                                Siapkan sebelum
                                                                menghubungi IGD
                                                                /{' '}
                                                                {
                                                                    emergencyHotline
                                                                }
                                                            </p>
                                                            <h3 className="mt-2 text-[16px] font-semibold text-foreground">
                                                                Informasi yang
                                                                mempercepat
                                                                triase medis
                                                            </h3>
                                                            <ol className="mt-4 space-y-3">
                                                                {EMERGENCY_PREP.map(
                                                                    (
                                                                        step,
                                                                        idx,
                                                                    ) => (
                                                                        <li
                                                                            key={
                                                                                step
                                                                            }
                                                                            className="flex items-start gap-3 text-[13.5px] leading-relaxed text-foreground"
                                                                        >
                                                                            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] font-mono text-[11px] font-semibold text-[var(--accent)] tabular-nums">
                                                                                {idx +
                                                                                    1}
                                                                            </span>
                                                                            <span>
                                                                                {
                                                                                    step
                                                                                }
                                                                            </span>
                                                                        </li>
                                                                    ),
                                                                )}
                                                            </ol>
                                                        </div>

                                                        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4 text-[12px] text-muted-foreground">
                                                            <span>
                                                                Petugas RS /
                                                                Puskesmas?
                                                            </span>
                                                            <Link
                                                                href="/masuk"
                                                                className="font-medium text-[var(--accent)] hover:underline"
                                                            >
                                                                Lapor KDRS di
                                                                Portal Petugas →
                                                            </Link>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </motion.section>
                        </div>
                    ) : null}
                </AnimatePresence>

                {/* Mobile Bottom Sheet (<768px): thumb-reachable swipe-to-dismiss sheet for 3 Pilar, 3M+, & 119 */}
                <SpringSheet
                    open={isMobileSheet && activePanel !== null}
                    onOpenChange={(open) => {
                        if (!open) navigateView('overview', false);
                    }}
                    title={activePanel ? PANEL_META[activePanel].title : ''}
                    description={
                        activePanel ? PANEL_META[activePanel].kicker : undefined
                    }
                    className="md:hidden"
                >
                    {activePanel ? (
                        <div className="space-y-4">
                            <div
                                role="tablist"
                                aria-label="Pindah panel informasi"
                                className="grid grid-cols-3 gap-1.5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] p-1"
                            >
                                {VIEWS.filter((v) => v.id !== 'overview').map(
                                    (item) => {
                                        const Icon = item.icon;
                                        const isSelected =
                                            activePanel === item.id;
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                role="tab"
                                                aria-selected={isSelected}
                                                onClick={() =>
                                                    navigateView(item.id, false)
                                                }
                                                className={cn(
                                                    'inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-[6px] px-2 text-[12px] font-medium whitespace-nowrap transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97]',
                                                    isSelected
                                                        ? item.urgent
                                                            ? 'bg-[var(--negative)] text-white shadow-xs'
                                                            : 'bg-[var(--surface)] text-foreground shadow-xs'
                                                        : item.urgent
                                                          ? 'text-[var(--negative)]'
                                                          : 'text-muted-foreground',
                                                )}
                                            >
                                                <Icon
                                                    className="size-3.5 shrink-0"
                                                    strokeWidth={1.75}
                                                    aria-hidden
                                                />
                                                <span className="truncate">
                                                    {item.id === 'darurat'
                                                        ? daruratTabLabel
                                                        : item.shortLabel}
                                                </span>
                                            </button>
                                        );
                                    },
                                )}
                            </div>

                            {activePanel === 'alur' ? (
                                <div className="space-y-3">
                                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                                        {PANEL_META.alur.subtitle}
                                    </p>
                                    <WorkflowPillars className="mt-0" />
                                </div>
                            ) : null}

                            {activePanel === 'edukasi' ? (
                                <div className="space-y-4">
                                    <div className="space-y-3">
                                        <p className="text-[13px] leading-relaxed text-muted-foreground">
                                            {PANEL_META.edukasi.subtitle}
                                        </p>

                                        <div
                                            role="tablist"
                                            aria-label="Langkah pencegahan 3M Plus"
                                            className="grid grid-cols-2 gap-2"
                                        >
                                            {PREVENTION_3M.map((item, idx) => {
                                                const isSelected =
                                                    idx === active3mIdx;
                                                return (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        role="tab"
                                                        aria-selected={
                                                            isSelected
                                                        }
                                                        onClick={() =>
                                                            setActive3mIdx(idx)
                                                        }
                                                        className={cn(
                                                            'min-h-[44px] cursor-pointer rounded-[var(--radius-control)] border px-3 py-2 text-left transition-[border-color,background-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97]',
                                                            isSelected
                                                                ? 'border-[var(--accent)] bg-[var(--accent)]/[0.08]'
                                                                : 'border-[var(--border)] bg-[var(--ground)]',
                                                        )}
                                                    >
                                                        <p className="text-[13px] font-medium text-foreground">
                                                            {item.title}
                                                        </p>
                                                        <p className="truncate font-mono text-[11px] text-muted-foreground">
                                                            {item.cadence}
                                                        </p>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--ground)] p-4">
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2.5">
                                                <h3 className="text-[14px] font-semibold text-foreground">
                                                    {active3m.title} ·{' '}
                                                    {active3m.focusArea}
                                                </h3>
                                                <span className="font-mono text-[11px] text-[var(--accent)]">
                                                    {active3m.cadence}
                                                </span>
                                            </div>
                                            <ul className="mt-3 space-y-2">
                                                {active3m.checklist.map(
                                                    (step) => (
                                                        <li
                                                            key={step}
                                                            className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground"
                                                        >
                                                            <CheckCircle2
                                                                className="mt-0.5 size-4 shrink-0 text-[var(--accent)]"
                                                                strokeWidth={
                                                                    1.75
                                                                }
                                                                aria-hidden
                                                            />
                                                            <span>{step}</span>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="rounded-[var(--radius-card)] border border-[var(--negative)]/30 bg-[var(--negative)]/[0.05] p-4">
                                        <div className="flex items-center gap-2 text-[var(--negative)]">
                                            <AlertTriangle
                                                className="size-4 shrink-0"
                                                strokeWidth={1.75}
                                                aria-hidden
                                            />
                                            <span className="font-mono text-[11px] font-semibold tracking-wide uppercase">
                                                Tanda bahaya — segera ke IGD
                                            </span>
                                        </div>
                                        <ul className="mt-3 space-y-2">
                                            {WARNING_SIGNS.map((sign) => (
                                                <li
                                                    key={sign}
                                                    className="flex items-start gap-2 rounded-[var(--radius-control)] border border-[var(--negative)]/20 bg-[var(--surface)] px-3 py-2 text-[13px] font-medium text-foreground"
                                                >
                                                    <span
                                                        aria-hidden
                                                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--negative)]"
                                                    />
                                                    <span>{sign}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <button
                                            type="button"
                                            data-variant="solid"
                                            onClick={() =>
                                                navigateView('darurat', false)
                                            }
                                            className="cta-emergency mt-3.5 inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--negative)] px-4 text-[13px] font-medium text-white"
                                        >
                                            <PhoneCall
                                                className="cta-phone size-4"
                                                strokeWidth={1.75}
                                                aria-hidden
                                            />
                                            Buka Darurat {emergencyHotline}
                                        </button>
                                    </div>
                                </div>
                            ) : null}

                            {activePanel === 'darurat' ? (
                                <div className="space-y-4">
                                    <div className="rounded-[var(--radius-card)] border border-[var(--negative)]/30 bg-[var(--negative)]/[0.05] p-4">
                                        <p className="font-mono text-[clamp(1.5rem,6vw,2.25rem)] leading-tight font-semibold tracking-[-0.03em] [overflow-wrap:anywhere] text-[var(--negative)] tabular-nums">
                                            {emergencyHotline}
                                        </p>
                                        <h3 className="mt-2 text-[16px] font-semibold text-foreground">
                                            PSC {emergencyHotline} ·{' '}
                                            {institutionName}
                                        </h3>
                                        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                                            {PANEL_META.darurat.subtitle}
                                        </p>
                                        <div className="mt-4 flex flex-col gap-2">
                                            <a
                                                href={hotlineHref}
                                                data-variant="solid"
                                                className="cta-emergency inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--negative)] px-4 py-2 text-center text-[14px] font-medium text-white"
                                            >
                                                <PhoneCall
                                                    className="cta-phone size-4 shrink-0"
                                                    strokeWidth={1.75}
                                                    aria-hidden
                                                />
                                                <span className="[overflow-wrap:anywhere]">
                                                    Panggil {emergencyHotline}{' '}
                                                    sekarang
                                                </span>
                                            </a>
                                            {supportEmail ? (
                                                <a
                                                    href={`mailto:${supportEmail}`}
                                                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center font-mono text-[12px] [overflow-wrap:anywhere] text-foreground active:scale-[0.97]"
                                                >
                                                    {supportEmail}
                                                </a>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--ground)] p-4">
                                        <p className="font-mono text-[11px] text-[var(--accent)] uppercase">
                                            Siapkan sebelum menghubungi IGD /{' '}
                                            {emergencyHotline}
                                        </p>
                                        <ol className="mt-3 space-y-2.5">
                                            {EMERGENCY_PREP.map((item, i) => (
                                                <li
                                                    key={item}
                                                    className="flex items-start gap-2.5 text-[13px] leading-relaxed text-foreground"
                                                >
                                                    <span className="mt-0.5 font-mono text-[12px] font-semibold text-[var(--accent)] tabular-nums">
                                                        0{i + 1}
                                                    </span>
                                                    <span>{item}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </SpringSheet>
            </main>

            {/* Mobile Bottom Thumb Dock (<768px): pinned inside 100dvh with safe-area-inset-bottom */}
            <nav
                aria-label="Navigasi bawah mobile"
                role="tablist"
                className="z-30 grid shrink-0 grid-cols-4 border-t border-[var(--border)] bg-[var(--surface)]/95 px-1.5 pt-1 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))] backdrop-blur-sm md:hidden"
            >
                {VIEWS.map((item) => {
                    const Icon = item.icon;
                    const isSelected = activeView === item.id;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            aria-selected={isSelected}
                            onClick={() => navigateView(item.id, false)}
                            className={cn(
                                'flex min-h-[48px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] px-1 text-[11px] font-medium transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.96]',
                                isSelected
                                    ? item.urgent
                                        ? 'bg-[var(--negative)]/12 text-[var(--negative)]'
                                        : 'bg-[var(--accent)]/12 text-[var(--accent)]'
                                    : item.urgent
                                      ? 'text-[var(--negative)]/85'
                                      : 'text-muted-foreground',
                            )}
                        >
                            <Icon
                                className="size-4 shrink-0"
                                strokeWidth={isSelected ? 2 : 1.75}
                                aria-hidden
                            />
                            <span className="max-w-full truncate">
                                {item.id === 'darurat'
                                    ? daruratTabLabel
                                    : item.shortLabel}
                            </span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
