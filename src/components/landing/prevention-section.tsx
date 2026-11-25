'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, PhoneCall, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

type PreventionStep = {
    id: string;
    title: string;
    desc: string;
    cadence: string;
    focusArea: string;
    checklist: string[];
};

const PREVENTION_3M: PreventionStep[] = [
    {
        id: 'menguras',
        title: 'Menguras',
        desc: 'Membersihkan tempat penampungan air seperti bak mandi, drum, dan ember minimal 1 minggu sekali.',
        cadence: 'Rutin 1× per minggu',
        focusArea: 'Bak mandi, toren, tatakan dispenser & vas bunga',
        checklist: [
            'Sikat dinding bagian dalam penampungan air untuk melepas telur nyamuk yang menempel',
            'Kosongkan dan keringkan tatakan pot tanaman, kulkas, serta tempat minum hewan peliharaan',
            'Lakukan serentak satu minggu sekali untuk memutus siklus jentik sebelum menjadi nyamuk dewasa',
        ],
    },
    {
        id: 'menutup',
        title: 'Menutup',
        desc: 'Menutup rapat tempat-tempat penampungan air agar nyamuk Aedes aegypti tidak dapat bertelur.',
        cadence: 'Setiap selesai digunakan',
        focusArea: 'Toren, gentong, drum air & ember cadangan',
        checklist: [
            'Pastikan tutup penampungan air tidak retak dan tidak meninggalkan celah masuk nyamuk',
            'Balikkan ember, baskom, atau wadah luar ruangan yang sedang tidak terisi air',
            'Periksa penutup lubang ventilasi tangki air agar tetap terpasang rapat',
        ],
    },
    {
        id: 'mendaur-ulang',
        title: 'Mendaur Ulang',
        desc: 'Memanfaatkan kembali atau menyingkirkan barang bekas yang berpotensi menampung air hujan.',
        cadence: 'Audit pekarangan mingguan',
        focusArea: 'Botol bekas, ban luar, kaleng & talang hujan',
        checklist: [
            'Pisahkan dan daur ulang botol plastik, kaleng, serta wadah bekas di halaman atau atap',
            'Simpan ban bekas di ruang tertutup atau lubangi agar tidak menjadi genangan saat hujan',
            'Bersihkan talang air dari daun kering supaya aliran air hujan tidak tertahan',
        ],
    },
    {
        id: 'plus',
        title: 'Plus Perlindungan Diri',
        desc: 'Menggunakan larvasida (abate), memasang kawat kasa, memelihara ikan pemakan jentik, serta memakai kelambu/lotion anti nyamuk.',
        cadence: 'Perlindungan harian',
        focusArea: 'Kamar tidur, ventilasi rumah & penampungan sulit dikuras',
        checklist: [
            'Taburkan larvasida sesuai takaran pada penampungan air yang sulit dikuras rutin',
            'Pasang kawat kasa pada jendela dan ventilasi, serta gunakan kelambu saat tidur siang/malam',
            'Oleskan lotion anti nyamuk terutama pada pagi dan sore hari saat Aedes aegypti aktif menggigit',
        ],
    },
];

const psnContentVariants = {
    enter: ({
        direction,
        reduce,
    }: {
        direction: -1 | 0 | 1;
        reduce: boolean;
    }) => ({
        opacity: 0,
        x: reduce ? 0 : direction * 8,
    }),
    center: {
        opacity: 1,
        x: 0,
    },
    exit: ({
        direction,
        reduce,
    }: {
        direction: -1 | 0 | 1;
        reduce: boolean;
    }) => ({
        opacity: 0,
        x: reduce ? 0 : direction * -8,
    }),
};

const WARNING_SIGNS = [
    'Nyeri perut hebat atau menetap',
    'Muntah terus-menerus dan tidak dapat minum',
    'Pendarahan pada gusi, mimisan, atau muntah darah',
    'Lemas luar biasa, gelisah, atau ujung jari dingin',
];

export function PreventionSection({
    branding,
}: {
    branding?: {
        title: string;
        institutionName: string;
        emergencyHotline: string;
        supportEmail: string;
    };
}) {
    const reduce = Boolean(useReducedMotion());
    const [selected, setSelected] = useState<{
        index: number | null;
        direction: -1 | 0 | 1;
    }>({ index: null, direction: 0 });
    const [drawerHeight, setDrawerHeight] = useState(0);
    const measureRef = useRef<HTMLDivElement>(null);

    const activeItem =
        selected.index !== null
            ? (PREVENTION_3M[selected.index] ?? null)
            : null;

    useEffect(() => {
        const el = measureRef.current;
        if (
            !el ||
            activeItem === null ||
            typeof ResizeObserver === 'undefined'
        ) {
            return;
        }
        const update = () => {
            const next = Math.ceil(el.getBoundingClientRect().height);
            if (next > 0) setDrawerHeight(next);
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, [activeItem]);

    function toggleStep(idx: number) {
        setSelected((prev) => {
            if (prev.index === idx) {
                return { index: null, direction: 0 };
            }
            const dir: -1 | 0 | 1 =
                prev.index === null ? 0 : idx > prev.index ? 1 : -1;
            return { index: idx, direction: dir };
        });
    }

    const title = branding?.title || 'WALI-EPI';
    const institutionName = branding?.institutionName || 'Dinas Kesehatan';
    const hotline = branding?.emergencyHotline || '119';
    const telHref = `tel:${hotline.replace(/[^\d+]/g, '') || '119'}`;
    const supportEmail = branding?.supportEmail || '';

    return (
        <section
            id="edukasi"
            className="border-t border-[var(--border)] bg-[var(--surface)] py-20 md:py-24"
        >
            <div className="mx-auto max-w-6xl px-4 md:px-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="max-w-2xl">
                        <p className="font-mono text-[12px] text-[var(--accent)]">
                            Edukasi dan pencegahan
                        </p>
                        <h2 className="mt-3 text-[24px] leading-tight font-medium tracking-[-0.02em] text-foreground sm:text-[32px]">
                            Pemberantasan sarang nyamuk di lingkungan rumah
                        </h2>
                        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                            Pencegahan primer melalui Pemberantasan Sarang
                            Nyamuk (PSN) 3M Plus adalah langkah paling efektif
                            memutus rantai penularan DBD di lingkungan tempat
                            tinggal.
                        </p>
                    </div>
                    <p className="font-mono text-[12px] text-muted-foreground">
                        Klik langkah untuk panduan praktis
                    </p>
                </div>

                {/* Interactive 3M Plus Grid */}
                <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {PREVENTION_3M.map((item, idx) => {
                        const isSelected = selected.index === idx;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                aria-expanded={isSelected}
                                aria-controls="psn-detail-panel"
                                onClick={() => toggleStep(idx)}
                                className={cn(
                                    'stat-card-interactive relative flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-[var(--radius-card)] border p-5 text-left focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:outline-none',
                                    isSelected
                                        ? 'border-[var(--accent)] bg-[var(--active)]/30'
                                        : 'border-[var(--border)] bg-[var(--ground)]',
                                )}
                            >
                                {isSelected ? (
                                    <motion.span
                                        layoutId="psn-active-bar"
                                        aria-hidden
                                        transition={
                                            reduce
                                                ? { duration: 0 }
                                                : {
                                                      duration: 0.22,
                                                      ease: EASE_OUT,
                                                  }
                                        }
                                        className="absolute inset-x-0 top-0 h-0.5 bg-[var(--accent)]"
                                    />
                                ) : null}

                                <div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-mono text-[12px] font-medium text-[var(--accent)] tabular-nums">
                                            Langkah {idx + 1}
                                        </span>
                                        <span className="font-mono text-[11px] text-muted-foreground">
                                            {isSelected ? 'Terbuka' : 'Panduan'}
                                        </span>
                                    </div>
                                    <h3 className="mt-3 text-[16px] leading-snug font-medium text-foreground">
                                        {item.title}
                                    </h3>
                                    <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                                        {item.desc}
                                    </p>
                                </div>

                                <p className="mt-4 border-t border-[var(--border)] pt-3 font-mono text-[11px] text-muted-foreground">
                                    {item.cadence}
                                </p>
                            </button>
                        );
                    })}
                </div>

                {/* Coordinated Height-Measured 3M+ Action Guide */}
                <motion.div
                    id="psn-detail-panel"
                    aria-hidden={!activeItem}
                    initial={false}
                    animate={{
                        height: activeItem ? drawerHeight || 'auto' : 0,
                        opacity: activeItem ? 1 : 0,
                    }}
                    transition={
                        reduce
                            ? { duration: 0.12 }
                            : {
                                  duration: activeItem ? 0.22 : 0.18,
                                  ease: EASE_OUT,
                              }
                    }
                    className="overflow-hidden"
                >
                    <div ref={measureRef} className="pt-4">
                        <AnimatePresence
                            mode="popLayout"
                            initial={false}
                            custom={{ direction: selected.direction, reduce }}
                        >
                            {activeItem ? (
                                <motion.div
                                    key={activeItem.id}
                                    custom={{
                                        direction: selected.direction,
                                        reduce,
                                    }}
                                    variants={psnContentVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{
                                        duration: reduce ? 0.12 : 0.2,
                                        ease: EASE_OUT,
                                    }}
                                    className="rounded-[var(--radius-card)] border border-l-2 border-[var(--border)] border-l-[var(--accent)] bg-[var(--ground)] p-5 md:p-6"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="space-y-1">
                                            <p className="font-mono text-[12px] text-[var(--accent)]">
                                                Panduan praktis ·{' '}
                                                {activeItem.cadence}
                                            </p>
                                            <h3 className="text-[16px] font-medium text-foreground">
                                                {activeItem.title} — area fokus:{' '}
                                                <span className="font-normal text-muted-foreground">
                                                    {activeItem.focusArea}
                                                </span>
                                            </h3>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSelected({
                                                    index: null,
                                                    direction: 0,
                                                })
                                            }
                                            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[12px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-[var(--raised)] hover:text-foreground"
                                        >
                                            <X
                                                className="size-3.5"
                                                strokeWidth={1.5}
                                                aria-hidden
                                            />
                                            <span>Tutup</span>
                                        </button>
                                    </div>

                                    <ul className="mt-4 grid grid-cols-1 gap-3 border-t border-[var(--border)] pt-4 md:grid-cols-3 md:gap-5">
                                        {activeItem.checklist.map(
                                            (stepText, i) => (
                                                <li
                                                    key={stepText}
                                                    className="flex items-start gap-2.5 text-[13px] leading-relaxed text-foreground"
                                                >
                                                    <span className="mt-0.5 font-mono text-[12px] text-[var(--accent)] tabular-nums">
                                                        0{i + 1}
                                                    </span>
                                                    <span>{stepText}</span>
                                                </li>
                                            ),
                                        )}
                                    </ul>
                                </motion.div>
                            ) : null}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* Warning Signs & Hotline Cards */}
                <div
                    id="kontak"
                    className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2"
                >
                    {/* Warning Signs */}
                    <div className="rounded-[var(--radius-card)] border border-l-2 border-[var(--border)] border-l-[var(--negative)] bg-[var(--ground)] p-6">
                        <div className="flex items-center gap-2 text-[var(--negative)]">
                            <AlertTriangle
                                className="size-4 shrink-0"
                                strokeWidth={1.5}
                            />
                            <h3 className="text-[16px] font-medium text-foreground">
                                Tanda bahaya DBD — segera ke fasilitas kesehatan
                            </h3>
                        </div>
                        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                            Waspada pada fase kritis (hari ke-3 hingga ke-6
                            sakit saat demam mulai turun). Segera bawa pasien ke
                            IGD Rumah Sakit atau Puskesmas jika terdapat:
                        </p>
                        <ul className="mt-4 space-y-2 text-[14px] text-foreground">
                            {WARNING_SIGNS.map((sign) => (
                                <li
                                    key={sign}
                                    className="flex items-start gap-2.5"
                                >
                                    <span
                                        aria-hidden
                                        className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--negative)]"
                                    />
                                    <span>{sign}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Emergency Hotline */}
                    <div className="flex flex-col justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--ground)] p-6">
                        <div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <PhoneCall
                                    className="size-4 shrink-0"
                                    strokeWidth={1.5}
                                />
                                <h3 className="text-[16px] font-medium text-foreground">
                                    Kontak darurat kesehatan
                                </h3>
                            </div>
                            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                                Layanan tanggap darurat dan rujukan medis
                                beroperasi 24 jam untuk koordinasi cepat antar
                                fasilitas kesehatan dan masyarakat.
                            </p>

                            <div className="mt-5 space-y-3">
                                <div className="flex items-center justify-between gap-4 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4">
                                    <div>
                                        <p className="text-[13px] font-medium text-foreground">
                                            Layanan gawat darurat PSC{' '}
                                            <span className="font-mono tabular-nums">
                                                {hotline}
                                            </span>
                                        </p>
                                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                                            Tanggap darurat 24 jam
                                        </p>
                                    </div>
                                    <a
                                        href={telHref}
                                        className="inline-flex h-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-[13px] font-medium text-[var(--accent-ink)] transition-colors duration-150 hover:bg-[var(--accent)]/90"
                                    >
                                        Panggil {hotline}
                                    </a>
                                </div>

                                <div className="flex items-center justify-between gap-4 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4">
                                    <div className="min-w-0">
                                        <p className="truncate text-[13px] font-medium text-foreground">
                                            {institutionName}
                                        </p>
                                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                                            Seksi P2P (Pencegahan dan
                                            Pengendalian Penyakit)
                                        </p>
                                    </div>
                                    {supportEmail && (
                                        <a
                                            href={`mailto:${supportEmail}`}
                                            className="shrink-0 font-mono text-[12px] font-medium text-foreground transition-colors duration-150 hover:text-[var(--accent)]"
                                        >
                                            {supportEmail}
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>

                        <p className="mt-6 text-[12px] text-muted-foreground">
                            {title} dioperasikan bersama oleh {institutionName},
                            Rumah Sakit, dan Puskesmas.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
