import { AlertTriangle, PhoneCall } from 'lucide-react';

const PREVENTION_3M = [
    {
        title: 'Menguras',
        desc: 'Membersihkan tempat penampungan air seperti bak mandi, drum, dan ember minimal 1 minggu sekali.',
    },
    {
        title: 'Menutup',
        desc: 'Menutup rapat tempat-tempat penampungan air agar nyamuk Aedes aegypti tidak dapat bertelur.',
    },
    {
        title: 'Mendaur Ulang',
        desc: 'Memanfaatkan kembali atau menyingkirkan barang bekas yang berpotensi menampung air hujan.',
    },
    {
        title: 'Plus Perlindungan Diri',
        desc: 'Menggunakan larvasida (abate), memasang kawat kasa, memelihara ikan pemakan jentik, serta memakai kelambu/lotion anti nyamuk.',
    },
];

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
    const title = branding?.title || 'WALI-EPI';
    const institutionName = branding?.institutionName || 'Dinas Kesehatan';
    const hotline = branding?.emergencyHotline || '119';
    const telHref = `tel:${hotline.replace(/[^\d+]/g, '') || '119'}`;
    const supportEmail = branding?.supportEmail || '';

    return (
        <section
            id="edukasi"
            className="border-t border-[var(--border)] bg-muted/20 py-20 md:py-28"
        >
            <div className="mx-auto max-w-6xl px-4 md:px-6">
                <div className="max-w-2xl">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-[11px] font-semibold tracking-wider text-teal-700 uppercase dark:text-teal-400">
                        Edukasi & Pencegahan
                    </span>
                    <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                        Kunci Utama Pengendalian Demam Berdarah
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                        Pencegahan primer melalui Pemberantasan Sarang Nyamuk
                        (PSN) 3M Plus adalah langkah paling efektif memutus
                        rantai penularan DBD di lingkungan tempat tinggal.
                    </p>
                </div>

                {/* 3M Plus Grid */}
                <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {PREVENTION_3M.map((item, idx) => (
                        <div
                            key={item.title}
                            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs"
                        >
                            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-teal-500/10 text-xs font-bold text-teal-600 dark:text-teal-400">
                                0{idx + 1}
                            </span>
                            <h3 className="mt-3 text-base font-semibold text-foreground">
                                {item.title}
                            </h3>
                            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                                {item.desc}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Warning Signs & Hotline Cards */}
                <div
                    id="kontak"
                    className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2"
                >
                    {/* Warning Signs */}
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 md:p-8">
                        <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
                            <AlertTriangle className="size-5" />
                            <h3 className="text-base font-bold sm:text-lg">
                                Tanda Bahaya DBD (Segera ke Fasilitas Kesehatan)
                            </h3>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                            Waspada pada fase kritis (hari ke-3 hingga ke-6
                            sakit saat demam mulai turun). Segera bawa pasien ke
                            IGD Rumah Sakit atau Puskesmas jika terdapat:
                        </p>
                        <ul className="mt-4 space-y-2 text-xs text-foreground sm:text-sm">
                            {WARNING_SIGNS.map((sign) => (
                                <li
                                    key={sign}
                                    className="flex items-start gap-2"
                                >
                                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-rose-500" />
                                    <span>{sign}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Emergency Hotline */}
                    <div className="flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs md:p-8">
                        <div>
                            <div className="flex items-center gap-2.5 text-teal-600 dark:text-teal-400">
                                <PhoneCall className="size-5" />
                                <h3 className="text-base font-bold text-foreground sm:text-lg">
                                    Kontak Darurat Kesehatan
                                </h3>
                            </div>
                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                                Layanan tanggap darurat dan rujukan medis
                                beroperasi 24 jam penuh untuk koordinasi cepat
                                antar fasilitas kesehatan dan masyarakat.
                            </p>

                            <div className="mt-5 space-y-3">
                                <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--ground)] p-3">
                                    <div>
                                        <p className="text-xs font-semibold text-foreground">
                                            Emergency Call (PSC {hotline})
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                            Tanggap Darurat 24 Jam
                                        </p>
                                    </div>
                                    <a
                                        href={telHref}
                                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                                    >
                                        Panggil {hotline}
                                    </a>
                                </div>

                                <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--ground)] p-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-semibold text-foreground">
                                            {institutionName}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                            Seksi P2P (Pencegahan &amp;
                                            Pengendalian Penyakit)
                                        </p>
                                    </div>
                                    {supportEmail && (
                                        <a
                                            href={`mailto:${supportEmail}`}
                                            className="shrink-0 font-mono text-xs font-semibold text-foreground hover:underline"
                                        >
                                            {supportEmail}
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>

                        <p className="mt-6 text-[11px] text-muted-foreground">
                            {title} dioperasikan bersama oleh {institutionName},
                            Rumah Sakit, dan Puskesmas.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
