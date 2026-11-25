'use client';

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type KeyboardEvent,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

type PillarStep = {
    id: 'rs' | 'puskesmas' | 'dinkes';
    num: string;
    role: string;
    title: string;
    desc: string;
    sla: string;
    slaWindow: string;
    objective: string;
    deliverables: string[];
    handoffTo: string;
    handoffAction: string;
};

const PILLARS: PillarStep[] = [
    {
        id: 'rs',
        num: '1',
        role: 'Rumah Sakit & Klinik',
        title: 'Deteksi dini dan KDRS',
        desc: 'Mencatat diagnosis klinis lab (trombosit dan hematokrit) dalam 24 jam dengan validasi alamat otomatis.',
        sla: 'SLA 24 jam',
        slaWindow: 'Maksimal 24 jam sejak diagnosis klinis ditetapkan',
        objective:
            'Memastikan notifikasi kasus DBD/DSS segera masuk ke sistem kota tanpa penundaan rekap manual.',
        deliverables: [
            'Entri formulir KDRS dengan nilai trombosit, hematokrit, dan tanggal onset demam',
            'Validasi alamat domisili kelurahan serta titik GPS untuk penentuan wilayah kerja',
            'Proteksi identitas pasien (NIK & data pribadi) terenkripsi AES-256',
        ],
        handoffTo: 'Puskesmas Wilayah',
        handoffAction:
            'Disposisi otomatis ke antrian PE Puskesmas sesuai kelurahan domisili',
    },
    {
        id: 'puskesmas',
        num: '2',
        role: 'Puskesmas Wilayah',
        title: 'Investigasi PE 72 jam',
        desc: 'Menerima disposisi kelurahan, memeriksa jentik 100 rumah sekitar, menghitung ABJ, serta memetakan risiko penularan.',
        sla: 'SLA 72 jam · 100 rumah',
        slaWindow: 'Maksimal 72 jam sejak disposisi kasus diterima',
        objective:
            'Menentukan potensi penularan setempat dan kebutuhan tindakan pengendalian vektor berbasis data lapangan.',
        deliverables: [
            'Survei jentik terhadap 100 rumah di sekitar titik kasus (radius 100 m)',
            'Kalkulasi otomatis Angka Bebas Jentik (ABJ), House Index, Container Index, dan Breteau Index',
            'Pencatatan penderita demam tambahan dan unggah temuan lapangan terverifikasi',
        ],
        handoffTo: 'Dinas Kesehatan Kota',
        handoffAction:
            'Pengiriman berkas PE lengkap untuk verifikasi epidemiologi dan keputusan intervensi',
    },
    {
        id: 'dinkes',
        num: '3',
        role: 'Dinas Kesehatan Kota',
        title: 'Verifikasi dan kendali wabah',
        desc: 'Memvalidasi epidemiologi, memantau klaster geospasial 100 m, dan menggerakkan fogging fokus 2 siklus terpadu.',
        sla: 'Klaster 100 m · 2 siklus',
        slaWindow: 'Fogging Siklus 1 (H0) dilanjutkan Siklus 2 (H+7)',
        objective:
            'Memutus rantai penularan lintas kelurahan serta mengawal kepatuhan SLA seluruh fasilitas kesehatan.',
        deliverables: [
            'Verifikasi epidemiologi berkas PE serta pemantauan kasus domisili lintas wilayah',
            'Analisis klaster spasial radius 100 m untuk penentuan prioritas fogging fokus',
            'Penjadwalan fogging 2 siklus (H0 & H+7), larvasidasi, PSN 3M Plus, hingga penutupan kasus',
        ],
        handoffTo: 'Siklus surveilans selesai',
        handoffAction:
            'Kasus ditutup dengan rekam jejak teraudit lintas RS, Puskesmas, dan Dinkes',
    },
];

const contentVariants = {
    enter: ({ direction, reduce }: { direction: 1 | -1; reduce: boolean }) => ({
        opacity: 0,
        x: reduce ? 0 : direction * 10,
    }),
    center: {
        opacity: 1,
        x: 0,
    },
    exit: ({ direction, reduce }: { direction: 1 | -1; reduce: boolean }) => ({
        opacity: 0,
        x: reduce ? 0 : direction * -10,
    }),
};

export function WorkflowPillars() {
    const reduce = Boolean(useReducedMotion());
    const [selection, setSelection] = useState<{
        index: number;
        direction: 1 | -1;
    }>({ index: 0, direction: 1 });
    const [panelHeight, setPanelHeight] = useState<number | null>(null);
    const [heightDuration, setHeightDuration] = useState(0.22);

    const measureRef = useRef<HTMLDivElement>(null);
    const prevHeightRef = useRef<number | null>(null);
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const active = PILLARS[selection.index] ?? PILLARS[0];

    const selectIndex = useCallback((nextIndex: number) => {
        setSelection((prev) => {
            if (prev.index === nextIndex) return prev;
            return {
                index: nextIndex,
                direction: nextIndex > prev.index ? 1 : -1,
            };
        });
    }, []);

    useEffect(() => {
        const el = measureRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver(() => {
            const nextHeight = Math.ceil(el.getBoundingClientRect().height);
            if (nextHeight <= 0) return;

            const prevHeight = prevHeightRef.current;
            if (prevHeight !== null && prevHeight !== nextHeight) {
                const delta = Math.abs(nextHeight - prevHeight);
                setHeightDuration(Math.min(0.24, Math.max(0.15, delta / 500)));
            }
            prevHeightRef.current = nextHeight;
            setPanelHeight(nextHeight);
        });

        observer.observe(el);
        return () => observer.disconnect();
    }, [selection.index]);

    function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
        let nextIdx: number | null = null;
        if (e.key === 'ArrowRight') nextIdx = (idx + 1) % PILLARS.length;
        else if (e.key === 'ArrowLeft')
            nextIdx = (idx - 1 + PILLARS.length) % PILLARS.length;
        else if (e.key === 'Home') nextIdx = 0;
        else if (e.key === 'End') nextIdx = PILLARS.length - 1;

        if (nextIdx !== null) {
            e.preventDefault();
            selectIndex(nextIdx);
            tabRefs.current[nextIdx]?.focus();
        }
    }

    const swapDuration = reduce ? 0.12 : heightDuration;

    return (
        <div className="mt-12">
            {/* 3 Pillar Selector Cards (Tablist) */}
            <div
                role="tablist"
                aria-label="Tiga tahap pengendalian demam berdarah"
                className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6"
            >
                {PILLARS.map((step, idx) => {
                    const isSelected = idx === selection.index;
                    return (
                        <button
                            key={step.id}
                            ref={(node) => {
                                tabRefs.current[idx] = node;
                            }}
                            id={`pillar-tab-${step.id}`}
                            type="button"
                            role="tab"
                            aria-selected={isSelected}
                            aria-controls={`pillar-panel-${step.id}`}
                            tabIndex={isSelected ? 0 : -1}
                            onClick={() => selectIndex(idx)}
                            onKeyDown={(e) => handleKeyDown(e, idx)}
                            className={cn(
                                'stat-card-interactive relative flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-[var(--radius-card)] border p-6 text-left focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:outline-none',
                                isSelected
                                    ? 'border-[var(--accent)] bg-[var(--active)]/30'
                                    : 'border-[var(--border)] bg-[var(--ground)]',
                            )}
                        >
                            {isSelected ? (
                                <motion.span
                                    layoutId="pillar-active-bar"
                                    aria-hidden
                                    transition={
                                        reduce
                                            ? { duration: 0 }
                                            : {
                                                  duration: 0.24,
                                                  ease: EASE_OUT,
                                              }
                                    }
                                    className="absolute inset-x-0 top-0 h-0.5 bg-[var(--accent)]"
                                />
                            ) : null}

                            <div>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-mono text-[13px] font-medium text-[var(--accent)] tabular-nums">
                                        Tahap {step.num}
                                    </span>
                                    <span className="text-[12px] text-muted-foreground">
                                        {step.role}
                                    </span>
                                </div>
                                <h3 className="mt-4 text-[18px] leading-snug font-medium text-foreground">
                                    {step.title}
                                </h3>
                                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                                    {step.desc}
                                </p>
                            </div>

                            <div className="mt-6 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-4 font-mono text-[12px]">
                                <span
                                    className={cn(
                                        isSelected
                                            ? 'text-[var(--accent)]'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    {step.sla}
                                </span>
                                <span
                                    className={cn(
                                        'transition-colors duration-150',
                                        isSelected
                                            ? 'text-foreground'
                                            : 'text-muted-foreground/70',
                                    )}
                                >
                                    {isSelected ? 'Aktif' : 'Lihat detail'}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Coordinated Height-Measured SLA & Workflow Detail Ledger */}
            <motion.div
                animate={
                    panelHeight !== null ? { height: panelHeight } : undefined
                }
                transition={
                    reduce
                        ? { duration: 0 }
                        : { duration: heightDuration, ease: EASE_OUT }
                }
                className="relative mt-6 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--ground)]"
            >
                <div ref={measureRef}>
                    <AnimatePresence
                        mode="popLayout"
                        initial={false}
                        custom={{ direction: selection.direction, reduce }}
                    >
                        <motion.div
                            key={active.id}
                            id={`pillar-panel-${active.id}`}
                            role="tabpanel"
                            aria-labelledby={`pillar-tab-${active.id}`}
                            custom={{ direction: selection.direction, reduce }}
                            variants={contentVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                duration: swapDuration,
                                ease: EASE_OUT,
                            }}
                            className="p-6 md:p-7"
                        >
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
                                {/* Left Summary & SLA Target */}
                                <div className="space-y-3 lg:col-span-5">
                                    <div className="flex flex-wrap items-center gap-2 font-mono text-[12px]">
                                        <span className="text-[var(--accent)]">
                                            Tahap {active.num} · {active.role}
                                        </span>
                                    </div>
                                    <h3 className="text-[18px] leading-snug font-medium text-foreground">
                                        {active.title}
                                    </h3>
                                    <p className="text-[14px] leading-relaxed text-muted-foreground">
                                        {active.objective}
                                    </p>
                                    <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
                                        <p className="font-mono text-[11px] text-muted-foreground">
                                            Batas waktu SLA
                                        </p>
                                        <p className="mt-0.5 text-[13px] font-medium text-foreground">
                                            {active.slaWindow}
                                        </p>
                                    </div>
                                </div>

                                {/* Right Concrete Deliverables & Handoff */}
                                <div className="flex flex-col justify-between gap-5 border-t border-[var(--border)] pt-5 lg:col-span-7 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
                                    <div>
                                        <p className="font-mono text-[12px] text-muted-foreground">
                                            Rincian alur & keluaran wajib
                                        </p>
                                        <ul className="mt-3 space-y-2.5">
                                            {active.deliverables.map(
                                                (item, i) => (
                                                    <li
                                                        key={item}
                                                        className="flex items-start gap-3 text-[13px] leading-relaxed text-foreground"
                                                    >
                                                        <span className="mt-0.5 font-mono text-[12px] text-[var(--accent)] tabular-nums">
                                                            0{i + 1}
                                                        </span>
                                                        <span>{item}</span>
                                                    </li>
                                                ),
                                            )}
                                        </ul>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                                        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                                            <ArrowRight
                                                className="size-4 shrink-0 text-[var(--accent)]"
                                                strokeWidth={1.5}
                                                aria-hidden
                                            />
                                            <span>
                                                <strong className="font-medium text-foreground">
                                                    {active.handoffTo}:
                                                </strong>{' '}
                                                {active.handoffAction}
                                            </span>
                                        </div>

                                        {selection.index <
                                        PILLARS.length - 1 ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    selectIndex(
                                                        selection.index + 1,
                                                    )
                                                }
                                                className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-medium text-foreground transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-[var(--raised)] active:scale-[0.98]"
                                            >
                                                <span>
                                                    Tahap {selection.index + 2}
                                                </span>
                                                <ArrowRight
                                                    className="size-3.5"
                                                    strokeWidth={1.5}
                                                    aria-hidden
                                                />
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => selectIndex(0)}
                                                className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-medium text-muted-foreground transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] hover:bg-[var(--raised)] hover:text-foreground active:scale-[0.98]"
                                            >
                                                Kembali ke Tahap 1
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
