export function BentoFeatures() {
    return (
        <section id="fitur" className="py-20 md:py-24">
            <div className="mx-auto max-w-6xl px-4 md:px-6">
                {/* Section Header */}
                <div className="max-w-2xl">
                    <p className="font-mono text-[12px] text-[var(--accent)]">
                        Infrastruktur surveilans
                    </p>
                    <h2 className="mt-3 text-[24px] leading-tight font-medium tracking-[-0.02em] text-foreground sm:text-[32px]">
                        Dirancang untuk ketepatan waktu dan presisi lapangan
                    </h2>
                    <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                        Menghubungkan bangsal rawat inap, petugas epidemiologi
                        Puskesmas, dan pembuat kebijakan Dinas Kesehatan tanpa
                        rekap manual berulang.
                    </p>
                </div>

                {/* Asymmetrical Grid (8+4 / 4+8) */}
                <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-12">
                    {/* Card 1: 8 Columns - KDRS RS Disposisi */}
                    <div className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 md:col-span-8 md:p-8">
                        <div>
                            <p className="font-mono text-[12px] text-muted-foreground">
                                Notifikasi KDRS
                            </p>
                            <h3 className="mt-3 text-[18px] leading-snug font-medium text-foreground sm:text-[20px]">
                                Disposisi kasus KDRS otomatis berbasis wilayah
                            </h3>
                            <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-muted-foreground">
                                Saat Rumah Sakit mencatat kasus dengan kriteria
                                klinis dan trombositopenia, sistem memvalidasi
                                domisili pasien dan mendisposisikan tugas ke
                                Puskesmas wilayah kerja terkait.
                            </p>
                        </div>

                        <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-[var(--border)] pt-5 sm:grid-cols-3">
                            <div>
                                <dt className="font-mono text-[13px] font-medium text-foreground tabular-nums">
                                    SLA 24 jam
                                </dt>
                                <dd className="mt-1 text-[12px] text-muted-foreground">
                                    Pelaporan KDRS Rumah Sakit
                                </dd>
                            </div>
                            <div>
                                <dt className="font-mono text-[13px] font-medium text-foreground">
                                    AES-256 PII
                                </dt>
                                <dd className="mt-1 text-[12px] text-muted-foreground">
                                    NIK dan alamat terenkripsi
                                </dd>
                            </div>
                            <div>
                                <dt className="font-mono text-[13px] font-medium text-foreground">
                                    Multi-instansi
                                </dt>
                                <dd className="mt-1 text-[12px] text-muted-foreground">
                                    RS, Puskesmas, Dinas Kesehatan
                                </dd>
                            </div>
                        </dl>
                    </div>

                    {/* Card 2: 4 Columns - Entomologi & PE */}
                    <div className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 md:col-span-4">
                        <div>
                            <p className="font-mono text-[12px] text-muted-foreground">
                                Entomologi lapangan
                            </p>
                            <h3 className="mt-3 text-[18px] leading-snug font-medium text-foreground">
                                Investigasi lapangan PE 72 jam
                            </h3>
                            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                                Formulir survei jentik radius 100 meter, hitung
                                otomatis Indeks Bebas Jentik (ABJ), House Index
                                (HI), dan deteksi kasus demam lain di sekitar
                                penderita.
                            </p>
                        </div>

                        <div className="mt-6 border-t border-[var(--border)] pt-4">
                            <p className="text-[12px] text-muted-foreground">
                                Standar Kemenkes RI
                            </p>
                            <p className="mt-1 font-mono text-[20px] font-medium text-[var(--accent)] tabular-nums">
                                ABJ &ge; 95%
                            </p>
                        </div>
                    </div>

                    {/* Card 3: 4 Columns - Tindak Lanjut Fogging & Larvasidasi */}
                    <div className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 md:col-span-4">
                        <div>
                            <p className="font-mono text-[12px] text-muted-foreground">
                                Pengendalian vektor
                            </p>
                            <h3 className="mt-3 text-[18px] leading-snug font-medium text-foreground">
                                Fogging fokus 2 siklus
                            </h3>
                            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                                Penjadwalan Siklus 1 (H0) dan Siklus 2 (H+7)
                                lengkap dengan pencatatan alokasi insektisida,
                                mesin fogger, dan larvasida (abate).
                            </p>
                        </div>

                        <div className="mt-6 border-t border-[var(--border)] pt-4 font-mono text-[12px] text-muted-foreground tabular-nums">
                            Siklus 1 H0 · Siklus 2 H+7
                        </div>
                    </div>

                    {/* Card 4: 8 Columns - Rekap Laporan Resmi Dinkes */}
                    <div className="flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 md:col-span-8 md:p-8">
                        <div>
                            <p className="font-mono text-[12px] text-muted-foreground">
                                Pelaporan Kemenkes RI
                            </p>
                            <h3 className="mt-3 text-[18px] leading-snug font-medium text-foreground sm:text-[20px]">
                                Rekapitulasi surveilans sesuai format Kemenkes
                                RI
                            </h3>
                            <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-muted-foreground">
                                Tersedia ekspor Excel dan tabel analitik menurut
                                golongan umur (&lt;1 th, 1-4 th, 5-14 th, 15-44
                                th, &gt;44 th) per Puskesmas (Dinkes) serta per
                                Kelurahan / RW / RT (Puskesmas).
                            </p>
                        </div>

                        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--border)] pt-4 font-mono text-[12px] text-muted-foreground">
                            <span>Penderita dan kematian (P/M)</span>
                            <span>Indikator PE, larvasidasi, fogging</span>
                            <span>Ekspor .xlsx</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
