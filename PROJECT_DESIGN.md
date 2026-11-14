# PROJECT_DESIGN: WALI-EPI

## 1. Product Context
- **Product**: WALI-EPI (Sistem Surveilans Terpadu Epidemiologi Demam Berdarah Dengue)
- **Target user**: Petugas surveilans Puskesmas, analis Dinas Kesehatan, dan operator input RS
- **Target surface**: Clinical Command Center (Desktop) & Field Mobile Surveillance (Mobile)
- **Primary job-to-be-done**: Triase cepat laporan kasus DBD, pelacakan penyelidikan epidemiologi (PE), dan pemantauan klaster transmisi dalam batas SLA ketat (24-72 jam)
- **Success criteria**: Penanganan tepat waktu tanpa kasus terlewat, kelengkapan data NIK/laboratorium, dan kemudahan navigasi di lapangan
- **Content/data that must appear**: NIK 16 digit, nama pasien, tanggal onset/masuk, jumlah trombosit & hematokrit, status PE, status fogging, hitungan mundur SLA
- **Interaction requirements**: Keyboard shortcuts (`⌘K`), filter dinamis cepat, validasi real-time form, status checklist kelengkapan
- **Technical constraints**: Next.js 16 App Router, Turbopack, Tailwind CSS v4, Zod v4, zero test files di repositori

## 2. Existing UI Read
- **Current visual vocabulary**: Minimalist Swiss & Clinical Blue/Teal, grid terstruktur
- **Strongest existing cue to preserve**: Kontras tinggi, layout full-width tanpa ruang void, warna fungsional epidemiologi
- **Components/tokens to reuse**: Radix UI primitives, Lucide SVG icons, status badge system (`StatusText`), table `.ledger`
- **Patterns to preserve**: Bottom primary action bar pada form panjang, compact sticky summary rail (~340px)
- **Patterns to evolve**: Konversi grafik time-series ke smooth AreaChart dengan gradient fade, keyboard navigation (`J/K`)
- **Patterns to remove or avoid**: Ornamen dekoratif tidak perlu, emoji struktural, pie charts, warna-warna jenuh berlebihan

## 3. Taste Direction
- **Product identity sentence**: Sistem komando surveilans DBD berkecepatan tinggi dengan presisi klinis dan nol ambiguitas data.
- **Recommended taste direction**: Clinical Surveillance Command Center (IBM Carbon + Sentry style)
- **Direction to avoid**: Consumer-app playful gradient slop atau portal birokrasi berbelit
- **Why this makes the UI more useful**: Mengurangi kelelahan mata operator yang bekerja 8 jam sehari, menonjolkan anomali data seketika, dan mempercepat input di lapangan
- **What should feel distinctive**: Angka tabular monospaced untuk kode & SLA countdown, garis pembagi 1px hairline, indikator kelengkapan live
- **What should stay quiet**: Latar belakang netral, navigasi sidebar, elemen filter sekunder

## 4. Selected References
- **IBM Carbon Design System**:
  - *Why it fits*: Standar emas tata letak enterprise berdensitas tinggi dengan basis grid 8px
  - *Transferable traits*: Hirarki tipografi terstruktur, aksen biru klinis (`#0284c7`), garis batas terukur
  - *Non-transferable*: Komponen monolitik berat; gunakan implementasi ringan Tailwind v4
- **Sentry / Linear Command**:
  - *Why it fits*: Efisiensi triase isu/kasus dengan visualisasi tren sparkline dan shortcut keyboard
  - *Transferable traits*: Command palette (`⌘K`), badge status kontras tinggi, area chart time-series

## 5. Visual Theme & Atmosphere
- **Design thesis**: Presisi klinis di atas dekorasi (Clinical precision over decoration)
- **Emotional tone**: Tenang, siaga, terpercaya, dan akurat
- **Product personality**: Dokter spesialis epidemiologi yang sistematis dan tidak membuang waktu
- **First viewport message**: Ringkasan beban kasus real-time dan antrean prioritas tindakan instan
- **Visual weight priorities**: 1. Kasus kritis / SLA lewat batas → 2. Aksi verifikasi → 3. Tren data agregat

## 6. Color Palette & Roles
- **Page/background**: `#F8FAFC` (Light) / `#0B0F17` (Dark)
- **Primary surface**: `#FFFFFF` (Light) / `#111827` (Dark)
- **Border / hairline**: `#E2E8F0` (Light) / `#1F2937` (Dark)
- **Primary accent**: `#0284C7` (Clinical Sky Blue)
- **Status Critical**: `#DC2626` (Red 600 - SLA Terlewat / Kasus Berat)
- **Status Warning**: `#D97706` (Amber 600 - Suspek / Menunggu PE)
- **Status Positive**: `#16A34A` (Green 600 - ABJ Normal / Selesai)
- **Primary text**: `#0F172A` (Light) / `#F1F5F9` (Dark)
- **Secondary text**: `#64748B` (Light) / `#94A3B8` (Dark)

## 7. Typography
- **Heading**: Geist / System Sans, tight tracking (`-0.02em`)
- **Data & Identifiers**: Geist Mono / Fira Code (`tabular-nums`, `slashed-zero`)
- **Body**: Geist Sans, 13.5px - 14px

## 8. Surface Layout & Ergonomics
- **Desktop**: Split panels fleksibel, table dengan cell padding `px-3 py-2`, sticky summary rail max 360px
- **Mobile**: Touch target ≥44px, bottom mobile dock, swipeable card triage
