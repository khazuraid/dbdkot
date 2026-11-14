import {
    Activity,
    Building2,
    CheckCircle2,
    Clock,
    FileSpreadsheet,
    Flame,
    Radio,
    ShieldCheck,
} from 'lucide-react';

export function BentoFeatures() {
    return (
        <section id="fitur" className="py-20 md:py-28">
            <div className="mx-auto max-w-6xl px-4 md:px-6">
                {/* Section Header */}
                <div className="max-w-2xl">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                        Infrastruktur Surveilans
                    </span>
                    <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                        Dirancang Khusus untuk Ketepatan Waktu & Presisi Lapangan
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                        Menghilangkan hambatan manual antara bangsal rawat inap, petugas epidemiologi Puskesmas, dan pembuat kebijakan Dinas Kesehatan.
                    </p>
                </div>

                {/* Asymmetrical Bento Grid */}
                <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-12">
                    {/* Bento 1: 8 Columns - KDRS RS Disposisi */}
                    <div className="md:col-span-8 rounded-[1.75rem] border border-[var(--border)] bg-muted/20 p-2 shadow-sm transition-all hover:shadow-md">
                        <div className="flex h-full flex-col justify-between rounded-[calc(1.75rem-0.5rem)] border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
                            <div>
                                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                                    <Activity className="size-5" />
                                </span>
                                <h3 className="mt-4 text-lg font-bold text-foreground sm:text-xl">
                                    Disposisi Kasus KDRS Otomatis Berbasis Wilayah
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    Saat Rumah Sakit mencatat kasus dengan kriteria klinis dan trombositopenia, sistem langsung memvalidasi domisili pasien dan mendisposisikan tugas ke Puskesmas wilayah kerja terkait.
                                </p>
                            </div>

                            {/* Telemetry Visual Inside Card */}
                            <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--ground)] p-4">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                                    <div className="flex items-center gap-2.5">
                                        <Clock className="size-4 text-teal-600 shrink-0" />
                                        <div>
                                            <p className="font-semibold text-foreground">SLA 24 Jam</p>
                                            <p className="text-[11px] text-muted-foreground">Lapor KDRS Rumah Sakit</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <ShieldCheck className="size-4 text-teal-600 shrink-0" />
                                        <div>
                                            <p className="font-semibold text-foreground">AES-256 PII</p>
                                            <p className="text-[11px] text-muted-foreground">NIK & Alamat Terenkripsi</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <Building2 className="size-4 text-teal-600 shrink-0" />
                                        <div>
                                            <p className="font-semibold text-foreground">Multi-Instansi</p>
                                            <p className="text-[11px] text-muted-foreground">RS, Puskesmas, Dinkes</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bento 2: 4 Columns - Entomologi & PE */}
                    <div className="md:col-span-4 rounded-[1.75rem] border border-[var(--border)] bg-muted/20 p-2 shadow-sm transition-all hover:shadow-md">
                        <div className="flex h-full flex-col justify-between rounded-[calc(1.75rem-0.5rem)] border border-[var(--border)] bg-[var(--surface)] p-6">
                            <div>
                                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                    <Radio className="size-5" />
                                </span>
                                <h3 className="mt-4 text-lg font-bold text-foreground">
                                    Investigasi Lapangan PE 72 Jam
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    Formulir survei jentik radius 100 meter, hitung otomatis Indeks Bebas Jentik (ABJ), House Index (HI), dan deteksi kasus demam lain di sekitar penderita.
                                </p>
                            </div>

                            <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--ground)] p-3.5">
                                <p className="text-[11px] font-medium text-muted-foreground">Standar Kemenkes RI</p>
                                <p className="mt-1 font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">
                                    ABJ Target &ge; 95%
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Bento 3: 4 Columns - Tindak Lanjut Fogging & Larvasidasi */}
                    <div className="md:col-span-4 rounded-[1.75rem] border border-[var(--border)] bg-muted/20 p-2 shadow-sm transition-all hover:shadow-md">
                        <div className="flex h-full flex-col justify-between rounded-[calc(1.75rem-0.5rem)] border border-[var(--border)] bg-[var(--surface)] p-6">
                            <div>
                                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                    <Flame className="size-5" />
                                </span>
                                <h3 className="mt-4 text-lg font-bold text-foreground">
                                    Fogging Fokus 2 Siklus
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    Penjadwalan presisi Siklus 1 (H0) dan Siklus 2 (H+7) lengkap dengan pencatatan alokasi insektisida, mesin fogger, dan larvasida (abate).
                                </p>
                            </div>

                            <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--ground)] p-3.5">
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                    <CheckCircle2 className="size-3.5 text-teal-600" />
                                    Terkontrol & Terdokumentasi
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Bento 4: 8 Columns - Rekap Laporan Resmi Dinkes */}
                    <div className="md:col-span-8 rounded-[1.75rem] border border-[var(--border)] bg-muted/20 p-2 shadow-sm transition-all hover:shadow-md">
                        <div className="flex h-full flex-col justify-between rounded-[calc(1.75rem-0.5rem)] border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
                            <div>
                                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    <FileSpreadsheet className="size-5" />
                                </span>
                                <h3 className="mt-4 text-lg font-bold text-foreground sm:text-xl">
                                    Rekapitulasi Surveilans Sesuai Format Kemenkes RI
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    Tersedia ekspor Excel dan tabel analitik menurut golongan umur (&lt;1 th, 1-4 th, 5-14 th, 15-44 th, &gt;44 th) per Puskesmas (Dinkes) serta per Kelurahan / RW / RT (Puskesmas).
                                </p>
                            </div>

                            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                                    Perhitungan Penderita & Kematian (P/M)
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                                    Indikator PE, Larvasidasi & Fogging
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                                    Download Satu Klik (.xlsx)
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
