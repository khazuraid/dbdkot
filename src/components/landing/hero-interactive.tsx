'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
    Activity,
    CheckCircle2,
    Clock,
    MapPin,
    Shield,
    Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function HeroInteractive() {
    const shouldReduceMotion = useReducedMotion();
    const [activeTab, setActiveTab] = useState<'triage' | 'entomologi' | 'workflow'>('triage');

    return (
        <div className="relative mx-auto w-full max-w-xl">
            {/* Ambient Background Glow (Subtle Pine Teal, no purple) */}
            <div
                aria-hidden
                className="absolute -inset-4 rounded-3xl bg-teal-500/10 blur-2xl dark:bg-teal-500/15 pointer-events-none"
            />

            {/* Double-Bezel Hardware Frame (Outer Shell) */}
            <div className="relative rounded-[2rem] border border-[var(--border)] bg-muted/30 p-2 shadow-xl">
                {/* Inner Core */}
                <div className="rounded-[calc(2rem-0.5rem)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs">
                    {/* Header Bar: Status & Tabs */}
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-3.5">
                        <div className="flex items-center gap-2">
                            <span className="grid size-6 place-items-center rounded-md bg-teal-500/15 text-teal-600 dark:text-teal-400">
                                <Activity className="size-3.5" />
                            </span>
                            <span className="text-xs font-semibold text-foreground">
                                Clinical Surveillance Console
                            </span>
                        </div>

                        {/* Interactive Tab Pills */}
                        <div className="flex rounded-lg border border-[var(--border)] bg-[var(--ground)] p-0.5 text-[11px]">
                            <button
                                type="button"
                                onClick={() => setActiveTab('triage')}
                                className={cn(
                                    'rounded px-2.5 py-1 font-medium transition-colors',
                                    activeTab === 'triage'
                                        ? 'bg-[var(--surface)] text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                Triase SLA
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('entomologi')}
                                className={cn(
                                    'rounded px-2.5 py-1 font-medium transition-colors',
                                    activeTab === 'entomologi'
                                        ? 'bg-[var(--surface)] text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                Indeks ABJ
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('workflow')}
                                className={cn(
                                    'rounded px-2.5 py-1 font-medium transition-colors',
                                    activeTab === 'workflow'
                                        ? 'bg-[var(--surface)] text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                Alur Kasus
                            </button>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="pt-4 min-h-[220px]">
                        {activeTab === 'triage' && (
                            <motion.div
                                key="triage"
                                initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-3"
                            >
                                {/* Active Triage Card */}
                                <div className="rounded-xl border border-[var(--border)] bg-[var(--ground)] p-3.5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10.5px] font-semibold text-teal-700 dark:bg-teal-950/40 dark:text-teal-400">
                                                <Sparkles className="size-3" /> Kasus Terverifikasi Lab
                                            </span>
                                            <h4 className="mt-1.5 text-sm font-semibold text-foreground">
                                                KDRS-2026-03-0842
                                            </h4>
                                            <p className="text-[11.5px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                <MapPin className="size-3" /> Kel. Sukajadi, RT 03 / RW 05
                                            </p>
                                        </div>

                                        {/* SLA Badge */}
                                        <div className="text-right">
                                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                                <Clock className="size-3" /> SLA PE: 18j 24m
                                            </span>
                                            <p className="mt-1 text-[10px] text-muted-foreground">Batas waktu 72 jam</p>
                                        </div>
                                    </div>

                                    {/* Clinical telemetry pill */}
                                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-2.5 text-[11px]">
                                        <div>
                                            <p className="text-[10px] text-muted-foreground">Trombosit</p>
                                            <p className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                                                42.000 /µL
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground">Hematokrit</p>
                                            <p className="font-mono font-semibold text-foreground">
                                                44.8 %
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground">Status</p>
                                            <p className="font-medium text-teal-600 dark:text-teal-400">
                                                DHF Grade II
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-[11.5px] text-muted-foreground px-1">
                                    <span className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                                        Disposisi otomatis ke Puskesmas Sukajadi
                                    </span>
                                    <span className="font-mono text-[10.5px]">AES-256 Terenkripsi</span>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'entomologi' && (
                            <motion.div
                                key="entomologi"
                                initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-3"
                            >
                                <div className="rounded-xl border border-[var(--border)] bg-[var(--ground)] p-3.5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[11px] font-medium text-muted-foreground">
                                                Angka Bebas Jentik (ABJ) Radius 100m
                                            </p>
                                            <div className="mt-1 flex items-baseline gap-2">
                                                <span className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                                                    96.4%
                                                </span>
                                                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-600 dark:text-emerald-400">
                                                    Target &ge; 95% Kemenkes Terpenuhi
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Survey Stats */}
                                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-2.5 text-[11px]">
                                        <div>
                                            <p className="text-[10px] text-muted-foreground">Rumah Diperiksa</p>
                                            <p className="font-mono font-semibold text-foreground">100 Rumah</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground">Positif Jentik</p>
                                            <p className="font-mono font-semibold text-rose-600">4 Rumah</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground">Rekomendasi</p>
                                            <p className="font-medium text-blue-600">PSN 3M Plus</p>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-[11.5px] text-muted-foreground px-1 flex items-center gap-1.5">
                                    <Shield className="size-3.5 text-teal-600" />
                                    Hasil survei jentik otomatis tercatat pada format rekap dinas kesehatan.
                                </p>
                            </motion.div>
                        )}

                        {activeTab === 'workflow' && (
                            <motion.div
                                key="workflow"
                                initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-2.5"
                            >
                                <div className="rounded-xl border border-[var(--border)] bg-[var(--ground)] p-3">
                                    <div className="space-y-2 text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="grid size-5 place-items-center rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                                                ✓
                                            </span>
                                            <span className="font-semibold text-foreground">1. Rumah Sakit input kasus (KDRS)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="grid size-5 place-items-center rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                                                ✓
                                            </span>
                                            <span className="font-semibold text-foreground">2. Disposisi otomatis wilayah Puskesmas</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="grid size-5 place-items-center rounded-full bg-teal-500 text-white text-[10px] font-bold">
                                                3
                                            </span>
                                            <span className="font-semibold text-teal-600 dark:text-teal-400">
                                                3. Investigasi Lapangan PE (72 Jam)
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <span className="grid size-5 place-items-center rounded-full bg-muted text-[10px] font-medium">
                                                4
                                            </span>
                                            <span>4. Tindak Lanjut: Fogging Fokus / Abatisasi</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
