# Blueprint Revamp Dasbor Portal Petugas WALI-EPI

> **Status**: Rencana terverifikasi & disetujui pada tahap Direction. Siap dieksekusi ke kode produksi (`src/app/(dashboard)/dasbor/`).
> **Arsitektur**: Hybrid **B + C** sebagai ruang kerja utama + **Toggle A** (*Peta Komando*)
> **Prinsip retensi**: Mempertahankan 100% fungsi, API endpoint, tenant scoping, dan data eksisting (**KDRS 24 Jam**, **PE 72 Jam**, **Fogging 2 Siklus**, **Klaster 100m**, **Peta Leaflet**, dan **Rekap Excel Kemenkes** `/api/export/laporan/rekap/excel`).

---

## 1. Audit Unslop — Masalah Dasbor Saat Ini

Fondasi token `src/app/globals.css` sudah cukup bersih (zinc neutral, deep teal `#0D9488`, `tabular-nums`, tanpa emoji/gradasi neon). Masalah utama pada `/dasbor` saat ini adalah **structural & hierarchy slop**:

1. **Hierarki terbalik (`src/app/(dashboard)/dasbor/page.tsx:80–325`)**: 4 kartu KPI pasif berukuran identik → peta `420px` penuh di atas lipatan → chart + daftar tautan buntu → baru tabel kasus di paling bawah (~1100px scroll sebelum menyentuh kasus nyata).
2. **KPI pasif & metrik inti tidak tampil (`dasbor/page.tsx:42,80–112,130`)**: kartu tidak memfilter antrean; `queues.foggingRequired` sudah di-query namun tidak dirender; Klaster 100m hanya jadi angka meta kecil di sudut peta.
3. **Antrean buntu (`dasbor/page.tsx:189–284`)**: `ActionItem` memaksa petugas keluar dari `/dasbor` ke 6 rute berbeda untuk aksi rutin (`ACCEPT`, `START_PE`, `VERIFY`, `MARK_CLOSED`), padahal semua server action (`reportAction`, `decideVerificationAction`, `disposeCrossBorderAction`, `reassignReportAction`, `executeFoggingAction`) sudah memanggil `revalidatePath('/dasbor')` tanpa `redirect()`.
4. **Kebisingan pil warna (`src/components/shell/status-text.tsx:25`, `src/components/reports/sla-countdown.tsx:57`)**: status rutin dan timer sama-sama dibungkus pil penuh sehingga sinyal darurat SLA tenggelam.
5. **Penyimpangan grid 4px**: `.ledger thead th` `height: 38px` (`globals.css:312`), `text-[11.5px]` pada `StatusText` (`status-text.tsx:25`).
6. **Akses Rekap Kemenkes tersembunyi**: `/api/export/laporan/rekap/excel` belum tersedia sebagai aksi cepat di header dasbor.
7. **Beban query spasial tak perlu**: 3 query GeoJSON/PostGIS (`facilityPoints`, `kelurahanZones`, `caseGeoPoints`) selalu berjalan di setiap load meski petugas hanya triase KDRS/PE.

---

## 2. Direction (Unslop — Disetujui)

- **Product**: Kokpit triase & tindak lanjut surveilans DBD (KDRS 24 jam, PE 72 jam, Fogging 2 Siklus, Klaster 100 m) untuk petugas RS, Puskesmas, dan Dinas Kesehatan Kota Cirebon.
- **Character**: `tenang, klinis, tegas`.
- **World**: Ruang kendali epidemiologi & lembar catatan klinis lapangan — permukaan mineral grafit senyap, tinta arang tajam, garis pengukur 1px, dan penanda peta topografi kesehatan.
- **Moments**:
  1. **Dossier Operasional Kanan (`ReportDossier`)**: progres KDRS → PE 72j (ABJ/jentik) → Fogging S1/S2 + mini-map Klaster 100 m & tombol aksi transisi inline.
  2. **Peta Komando Leaflet (`?view=map`)**: satu-satunya kanvas penuh warna (poligon zonasi kelurahan, cincin 100 m, pin kasus) yang dikelilingi chrome netral.
- **Signature**: **Pita SLA presisi 2 px** (`border-l-2`) + hitung mundur `tabular-nums` monospaced (`24j` / `72j`) di tepi kiri baris kasus yang mendekati atau melewati target — hanya menyala saat urgensi klinis nyata.

---

## 3. Sistem Visual (9 Pass Unslop)

| Lapisan | Spesifikasi |
| --- | --- |
| **Spacing (Grid 4px)** | Header halaman `56px`, header tabel `36px` (bukan `38px`), baris ledger `44px`, padding kartu `16px–20px`, gap antar grup `16px`, radius kontrol `8px`, radius kartu `12px`. |
| **Color (Graphite + 1 Aksen)** | Light: `#FAFAFA` ground, `#FFFFFF` surface, `#F4F4F5` raised, hairline `rgb(9 9 11 / 0.08)`. Dark: `#09090B` ground, `#111114` surface, `#18181B` raised, hairline `rgb(250 250 250 / 0.08)`. Aksen tunggal Deep Teal `#0D9488` (light) / `#14B8A6` (dark, kontras ≥4.5:1) hanya untuk CTA utama, seleksi aktif, & focus ring. Nol gradasi hue, nol glow. |
| **Semantik Darurat SLA** | Lewat SLA (`>24j`/`>72j`): Crimson `#BE123C` / `#FB7185`. Peringatan (`<6j`): Amber `#B45309` / `#FBBF24`. Tuntas / ABJ ≥95%: Emerald `#047857` / `#34D399`. Status rutin di daftar kasus turun menjadi **titik 6px + teks tenang** agar darurat SLA & badge `100m` menonjol seketika. |
| **Tipografi** | Geist Sans (`400`/`500`, `600` hanya nilai kritis, *sentence case* semua label, tanpa italic penekanan & tanpa negative tracking di teks kecil) + Geist Mono (`tabular-nums` konsisten untuk KPI, nomor KDRS, hitung mundur SLA, ABJ %, radius 100 m). |
| **Ikon & Copy** | Lucide `16px` stroke `1.5`, warna mengikuti peran teks, lebar kotak ikon sejajar. Tanpa emoji, tanda seru, atau sapaan basa-basi — judul langsung menampilkan konteks `Surveilans DBD · <Bulan Tahun>`. |

---

## 4. Poles Interaksi & Motion (Emil Kowalski Design Engineering)

### 4.1 Tabel Review (`Before | After | Why`)

| Before | After | Why |
| --- | --- | --- |
| `<motion.span layoutId={pillId} />` pada tab status (`src/components/reports/report-table.tsx:423`) | Indikator tab CSS berbasis `clip-path: inset(...)` / `transform: translateX(...)` (`180ms var(--ease-out)`), dan `transition-duration: 0ms` saat dipicu keyboard (`ArrowLeft`/`ArrowRight`/`Home`/`End`) | `layoutId` berjalan di main thread dan drop frame saat RSC/URL refresh; navigasi keyboard (100+/hari) tidak boleh dianimasikan |
| Filter wilayah (kelurahan/klaster) & pergantian antrean teleport tanpa transisi | Popover/dropdown filter memakai `transform-origin: var(--transform-origin)` + `scale(0.96)` + `opacity: 0` (`160ms var(--ease-out)` masuk, `120ms` keluar); daftar kasus saat `isPending` memakai `opacity: 0.72` + `filter: blur(1.5px)` (`160ms ease`) | Menjaga koneksi spasial dengan tombol pemicu dan meredam kedipan saat RSC memuat ulang hasil filter |
| `ReportAction` ganti teks mentah saat submit & kartu KPI/chip klaster tanpa `:active` | Semua target klik memakai `active:scale-[0.97]` (`150ms var(--ease-out)`, properti eksplisit tanpa `transition-all`); isi tombol aksi (`Idle → Memproses → Selesai`) crossfade `filter: blur(2px)` + `opacity: 0.7` (`160ms ease`) | Memberi umpan balik taktil instan pada pointer-down dan menyatukan transisi state tombol sebagai satu objek |
| Pil SLA statis penuh warna (`src/components/reports/sla-countdown.tsx:57`) tanpa feedback hover | Pita SLA `2px` + transisi warna CSS interruptible (`200ms ease`, nol `animate-pulse`/keyframes); tooltip batas waktu absolut muncul `125ms var(--ease-out)` (`data-instant` `0ms` untuk hover beruntun) hanya pada `@media (hover: hover) and (pointer: fine)` | Mencegah false hover di perangkat sentuh, menjaga data klinis tenang, dan mempercepat pemindaian tenggat SLA lintas baris |
| Baris tabel/antrean hanya ganti latar hover datar (`src/app/globals.css:334`) | Hover gated `@media (hover: hover) and (pointer: fine)` (`120ms ease`); `:active` halus `scale-[0.992]` (`120ms var(--ease-out)`); garis seleksi kiri `2px` `scaleY(0 → 1)` (`180ms var(--ease-out)`) + dossier kanan crossfade `160ms` (`opacity` + `translateY(4px)`) | Baris lebar tidak terasa menyusut berlebihan saat diklik dan garis seleksi mengunci hubungan visual ke dossier kanan |
| Drawer detail kasus & panel filter peta mobile | Pertahankan `SpringSheet` / Vaul (`cubic-bezier(0.32, 0.72, 0, 1)`, tracking 1:1 tanpa delay, velocity-based dismiss, `prefers-reduced-motion` tanpa bounce) | Gestur sentuh fisik tetap interruptible di viewport mobile `375px` |

### 4.2 Decision Framework & Guardrails

- **No animation (`0ms`)**: navigasi tab via keyboard (`ArrowLeft`/`ArrowRight`/`Home`/`End`), shortcut Command Palette, dan tooltip lanjutan saat satu tooltip SLA sudah terbuka (`data-instant`).
- **Fast & crisp (`120–180ms`, `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`)**: klik tombol (`150ms`), tekan baris (`120ms`), tab klik (`180ms`), filter dropdown (`160ms` in / `120ms` out), pergantian isi dossier (`160ms`).
- **Compositor-only & accessible**: hanya animasikan `transform`, `opacity`, `clip-path`, dan warna; nol `transition-all`; nol `scale(0)`; batas `filter: blur()` maksimal `2px` (aman di Safari); wajib `@media (hover: hover) and (pointer: fine)` untuk efek hover dan `@media (prefers-reduced-motion: reduce)` yang mengubah gerak posisi menjadi fade `120ms ease`.

### 4.3 Fisika Gestur & Drawer Mobile (`/gestures`)

Prinsip dua fase diterapkan ketat untuk semua drawer/sheet di `/dasbor`:
- **Fase TRACK (jari menempel)**: posisi `transform: translateY(...)` 1:1 mengikuti jari via `useMotionValue` / Vaul tanpa easing, tanpa spring, tanpa `setState` per `pointermove`, dan tanpa CSS variable di parent (hindari style recalc ke child). Rubber-band di batas atas (`dragElastic={{ top: 0.2 }}`).
- **Fase RELEASE (jari dilepas)**: tutup jika melampaui ambang jarak (`~38–45%` tinggi sheet) **ATAU** kecepatan flick (`velocity.y > 550px/s` / proyeksi momentum); jika tidak tercapai, snap-back cepat dengan spring (`bounce: 0.18` hanya setelah drag, `bounce: 0` bila ditutup lewat tombol/Escape).

| Permukaan Mobile (`<lg`) | Primitif | Spesifikasi Gestur & Fisika |
| --- | --- | --- |
| **Panel Detail Kasus (`ReportDossier`)** | **Vaul `Drawer`** (`src/components/ui/drawer.tsx:19`, dipakai di `report-split-view.tsx:106`) | Edge-attached full-width sheet dengan `snapPoints={[0.55, 0.92]}`, kurva iOS `cubic-bezier(0.32, 0.72, 0, 1)` (500ms), focus trap, body scroll lock, dan handoff scroll-ke-drag otomatis saat `scrollTop === 0`. Wajib beri `data-vaul-no-drag` pada `PatientLocationMap` (Leaflet) serta tombol/form `ReportAction` agar pan peta atau tekan tombol tidak menarik sheet. Lapisan `z-[60]` di atas `MobileBottomDock` + `pb-[max(1rem,env(safe-area-inset-bottom))]`. |
| **Panel Filter Peta & Antrean Peta Komando** | **`SpringSheet`** (`src/components/ui/drawer.tsx:155`, `contained` di `FacilityMap` & floating sheet mobile) | Motion `useMotionValue(y)` + `useTransform` scrim 1:1 + drag `touch-action: pan-x` pada grip header (`≥44px`). Untuk sheet floating kecil non-edge-attached, pakai kurva cepat `200ms` (`cubic-bezier(0.165, 0.84, 0.44, 1)` atau spring `duration: 0.32`). Menutup searah sumbu masuk (dari bawah → swipe ke bawah). |

#### Audit & Perbaikan Wajib pada `SpringSheet` Eksisting (`src/components/ui/drawer.tsx:155–362`)
1. **Velocity handoff sejati saat dismiss (`drawer.tsx:201–215`)**: saat ini `dismissWithVelocity` langsung memanggil `onOpenChange(false)` pada frame yang sama sehingga `exit={{ y: '100%' }}` me-reset animasi dengan `velocity: 0` (terasa melompat). Perbaiki dengan menunggu spring `animate(y, target, { type: 'spring', duration: 0.32, bounce: 0, velocity })` selesai (atau teruskan `velocity` ke `exit` via `custom`) sebelum unmount.
2. **Pisahkan animasi mount scrim dari `backdropOpacity` (`drawer.tsx:249–262`)**: saat ini `animate={{ opacity: 1 }}` dan `style={{ opacity: backdropOpacity }}` bentrok di node yang sama. Pisahkan ke 2 layer (outer fade mount/exit, inner `style={{ opacity: backdropOpacity }}`) agar scrim sinkron 1:1 dengan posisi jari bahkan saat gestur dibatalkan di tengah jalan.
3. **Reduced motion tetap izinkan direct manipulation (`drawer.tsx:280`)**: jangan matikan `drag` (`drag={reduce ? false : 'y'}`) — drag adalah gerakan langsung jari pengguna sehingga harus tetap `drag="y"`; yang direduksi hanyalah `bounce: 0`, durasi settle pendek (`140ms`), dan tanpa fling momentum.
4. **Target sentuh `≥44×44px` & gate hover (`drawer.tsx:339`)**: tombol tutup `size-8` (32px) wajib ditambah hitbox tak terlihat `relative before:absolute before:-inset-1.5 before:content-['']` agar area sentuh 44×44px; bungkus `:hover` tombol tutup & opsi filter di `@media (hover: hover) and (pointer: fine)` agar tidak memicu phantom hover di HP.
5. **Interruptible mid-flight & proteksi multi-touch**: pertahankan `onPointerDownCapture={() => animRef.current?.stop()}` agar sheet yang sedang snap-back/menutup bisa langsung ditangkap kembali tanpa lompat, dan abaikan sentuhan jari kedua saat drag aktif.

---

## 5. Arsitektur Hybrid B+C + Toggle A

### 5.1 Kontrak URL (`nuqs` `useQueryStates`, `{ shallow: false, history: 'replace' }`)

| Param | Nilai Valid | Default | Efek |
| --- | --- | --- | --- |
| `view` | `'workspace' \| 'map'` | `'workspace'` | Beralih antara Ruang Kerja (Hybrid B+C) dan Peta Komando (A). `RUMAH_SAKIT` selalu di-coerce ke `'workspace'`. |
| `queue` | `'all' \| 'overdue' \| 'kdrs' \| 'pe' \| 'fogging' \| 'cluster'` | `'all'` | Filter antrean server-side di `listReports`. Mengubah `queue` mereset `page` ke `1` dan mengosongkan `selected`. |
| `kelurahan` | nama kelurahan (opsional) | `''` | Filter wilayah cepat via dropdown/chip di toolbar antrean (non-PII). |
| `q` | string maks 64 karakter | `''` | Pencarian non-PII (`reportNumber` / `kelurahan` via `escapeLike`). |
| `selected` | UUID valid | `''` | Memuat `ReportDetail` secara **opt-in** di panel kanan / mobile drawer. |
| `page` | integer positif (`readPage`) | `1` | Paginasi antrean (`perPage: 20`). |

### 5.2 Kebijakan Keamanan & Audit PII (`READ_PII`)

- **Nol endpoint API PII baru**: semua dekripsi PII (`patient.name`, `nik`, `address`, `phone`) tetap 100% di Server Component melalui `getReport(actor, id)` yang menegakkan `isValidUuid(id)` + `scopeToInstitution(actor)`.
- **Opt-in `READ_PII`**: `getReport(actor, sp.selected)` **hanya dipanggil saat `?selected=<uuid>` eksplisit ada di URL** (bukan auto-load baris pertama saat membuka `/dasbor`). Manfaat ganda:
  1. Log audit `READ_PII` tetap bersih (hanya tercatat saat petugas benar-benar membuka kasus).
  2. Drawer mobile tidak pernah terbuka otomatis saat halaman baru dimuat.
- **Zero-leak tampering**: jika pengguna `PUSKESMAS`/`RUMAH_SAKIT` mengganti `?selected=<uuid-instansi-lain>`, `getReport` mengembalikan `null` dan menampilkan state kosong.

### 5.3 Mode-Gated Query Flow (`src/app/(dashboard)/dasbor/page.tsx`)

- **Selalu paralel**: `reportCounts(actor)`, `queueCounts(actor)`, `listReports(actor, mappedFilters)`.
- **Hanya saat `view === 'workspace'`**: `sp.selected ? getReport(actor, sp.selected) : null`, `dailySeries(actor)`, `uncoveredKelurahan(actor)` — **menghemat 3 query spasial PostGIS/GeoJSON** pada tampilan utama.
- **Hanya saat `view === 'map'`**: `facilityPoints(actor)`, `kelurahanZones(actor)`, `caseGeoPoints(actor)`.

### 5.4 Matriks Peran

| Fitur | `DINKES` | `ADMIN` | `PUSKESMAS` | `RUMAH_SAKIT` |
| --- | --- | --- | --- | --- |
| Layout utama | Hybrid B+C Split-View | Hybrid B+C Split-View | Hybrid B+C Split-View | Variant B Clinical Table + preview `SpringSheet` |
| Toggle `Peta Komando` (`?view=map`) | Penuh se-kota | Penuh se-kota | Ter-scope kelurahan binaan | Disembunyikan (coerce ke `workspace`) |
| Aksi sekunder Header | `Rekap Kemenkes (.xlsx)` | `Rekap Kemenkes (.xlsx)` | `Rekap Kemenkes (.xlsx)` | `Rekap Kemenkes (.xlsx)` |
| CTA utama Header | `Verifikasi PE` (`/pe/verifikasi`) | `Semua Laporan` (`/laporan`) | `Buat Laporan PE` (`/pe/baru`) | `Buat Laporan KDRS` (`/laporan/baru`) |
| `ReportAction` inline di Dossier | `VERIFY`, `REJECT_BY_DINKES`, `MARK_CLOSED` | **Read-only** (selaras `transitionReport` yang melarang `ADMIN`), tautan `/admin/koreksi-wilayah` & `/laporan/[id]` | `ACCEPT`, `REJECT`, `START_PE`, `MARK_CLOSED` | Read-only status & progres PE + `/laporan/[id]` |

### 5.5 Struktur Layout per Bagian

1. **Header & Toolbar (56px)**:
   - Kiri: `Surveilans DBD · <Bulan Tahun>` + indikator `LiveData` (`src/components/shell/live-data.tsx`).
   - Kanan: Segmented toggle `Ruang Kerja | Peta Komando` (CSS clip-path/transform, non-`RUMAH_SAKIT`) + tombol sekunder `Rekap Kemenkes (.xlsx)` (`/api/export/laporan/rekap/excel`) + 1 CTA utama sesuai peran.
2. **Strip 4 KPI Klik-Filter (ala B)**:
   - `Perlu Tindakan / KDRS <24j` (`counts.needAction` + sub `submitted`/`assigned`)
   - `PE 72 Jam` (`queues.peInProgress` + badge `counts.slaOverdue` lewat SLA)
   - `Fogging 2 Siklus` (`queues.foggingRequired`)
   - `Klaster 100 m` (`queues.clustered`)
   - Semua memakai `button[aria-pressed]`, angka `font-mono tabular-nums`, dan `active:scale-[0.97]`.
3. **Ruang Kerja (`?view=workspace`)**:
   - **Desktop (`lg+`)**: `ResizablePanelGroup` (kiri `~35%`, min `340px` | kanan `~65%`).
     - *Panel Kiri*: input cari `?q=`, dropdown filter wilayah (`?kelurahan=`), tab status CSS (`Semua`, `KDRS`, `PE 72 Jam`, `Fogging`, `Selesai`), daftar kasus terkelompok prioritas SLA (Lewat SLA → KDRS 24j → PE 72j → Fogging → Tuntas) dengan pita SLA 2px, status tenang, badge `100m`, dan `Pager`.
     - *Panel Kanan*: saat `?selected` kosong tampilkan ringkasan prioritas peran & tautan cepat (`crossBorderPending`, `peCompleted`, `assigned`, `foggingRequired`); saat kasus dipilih tampilkan `ReportDossier` (sticky header + `ReportAction` + `StatusStepper` + lab klinis + kartu PE ABJ + kartu Fogging S1/S2 + `PatientLocationMap` + loncat cepat `clusterSiblings` 100m + tombol *"Buka di Peta Komando"*).
   - **Mobile (`<lg`)**: daftar penuh; ketuk baris mengeset `?selected=<id>` dan membuka `SpringSheet`/`Drawer` swipe-to-dismiss berisi `ReportDossier`.
   - **Laci Analitik Sekunder (`<details>` lipat di bawah ruang kerja)**: `DailySeriesChart` (tren 14 hari + tabel aksesibel) dan peringatan `uncoveredKelurahan` (khusus `DINKES`/`ADMIN`) dengan tautan `/admin/koreksi-wilayah`.
4. **Peta Komando (`?view=map`, ala A)**:
   - `FacilityMapPanel` Leaflet full-height (`calc(100dvh - 13rem)`) dengan `points`, `zones`, dan `cases` riil.
   - Panel antrean samping collapsible (`360px` desktop, `SpringSheet contained` mobile dengan `pb-20` agar tidak bertabrakan dengan `MobileBottomDock`), tersinkronisasi 2 arah (`selectedCaseId`, `onSelectCase`, `focusClusterId` → `flyTo`).

---

## 6. Peta Perubahan File (Saat Tahap Implementasi)

### Edit File Existing
1. `src/lib/domain/reports.ts` — Ekstrak `slaOverdueSql()` dari `reportCounts()`; tambah filter opsional `slaOverdue?: boolean`, `hasCluster?: boolean`, `kelurahan?: string` pada `ReportListFilters` & `baseConditions()`.
2. `src/lib/domain/queries.ts` — Tambah kolom `peInProgress` dan `clustered` di `queueCounts(actor)` dalam 1 SQL scan yang sama.
3. `src/components/reports/report-split-view.tsx` — Ekspor `ReportDossier` (reuse `InspectorContent` yang saat ini 0 caller), tambah kartu Fogging S1/S2, chip `clusterSiblings` 100m, tombol `MARK_CLOSED`, dan role guard `ADMIN` read-only sesuai `transitionReport`.
4. `src/components/reports/report-table.tsx` — Ganti `<motion.span layoutId>` dengan indikator tab CSS (`clip-path`/`transform`) + `0ms` untuk navigasi keyboard; poles hover/active baris sesuai tabel Emil Design Eng.
5. `src/components/reports/facility-map.tsx` & `src/components/reports/facility-map-panel.tsx` — Perluas `height?: number | string` dan tambah prop opsional `selectedCaseId`, `onSelectCase`, `focusClusterId` untuk `flyTo` sinkron.
6. `src/components/shell/status-text.tsx` & `src/components/reports/sla-countdown.tsx` — Tambah varian status tenang (`dot` + teks, skala `12px`), pita SLA 2px, transisi warna CSS interruptible, dan tooltip batas waktu `data-instant`.
7. `src/components/ui/drawer.tsx` — Perbaiki 5 temuan gestur di `SpringSheet` (velocity handoff saat dismiss, pisah layer scrim `backdropOpacity`, pertahankan `drag="y"` pada `prefers-reduced-motion`, hitbox tutup `≥44×44px`, hover-gated & multi-touch guard) + pastikan `DrawerContent` Vaul mendukung safe-area & `z-[60]` di atas `MobileBottomDock`.
8. `src/app/globals.css` — Perbaiki `.ledger thead th` `height: 36px` (grid 4px), tambah aturan hover desktop-only (`@media (hover: hover) and (pointer: fine)`), helper transisi blur-morph tombol, dan fallback `prefers-reduced-motion`.
9. `src/app/(dashboard)/dasbor/page.tsx` — Parse & whitelist `searchParams`, jalankan mode-gated `Promise.all`, panggil `getReport` hanya saat `?selected` valid, render `<DasborWorkspace />`.

### Tambah File Baru
10. `src/app/(dashboard)/dasbor/dasbor-workspace.tsx` — Client orchestrator Hybrid B+C + Toggle A dengan `nuqs` `useQueryStates`, strip 4 KPI klik-filter, split-view / `RUMAH_SAKIT` clinical view, `<details>` analitik, dan Command Map overlay.

### Hapus Prototipe Throwaway (Keamanan Pasca-Implementasi)
11. Hapus 6 file di luar auth group `(dashboard)`:
    - `src/app/prototype/dasbor/{page.tsx,workbench.tsx,_variants.tsx,_map-canvas.tsx,_data.ts}`
    - `src/components/prototype/prototype-switcher.tsx`

---

## 7. Checklist Verifikasi End-to-End

1. **Static & Build**:
   - `npx tsc --noEmit`
   - `npx eslint src/app/\(dashboard\)/dasbor src/components/reports src/components/shell/status-text.tsx src/lib/domain/reports.ts src/lib/domain/queries.ts`
   - `npm run build` (verifikasi Next.js 16 `cacheComponents: true` + `export const instant = false`)
2. **Fungsi & Keamanan per Peran (`DINKES`, `PUSKESMAS`, `ADMIN`, `RUMAH_SAKIT`)**:
   - Buka `/dasbor` → pastikan `READ_PII` **tidak** tercatat sebelum kasus diklik.
   - Uji klik 4 kartu KPI, tab status (pointer & keyboard `ArrowLeft`/`ArrowRight`), serta filter wilayah kelurahan.
   - Pilih kasus → verifikasi `ReportDossier` memuat lab, PE ABJ, Fogging S1/S2, `PatientLocationMap`, & loncat `clusterSiblings` 100m.
   - Uji aksi inline (`ACCEPT`, `START_PE`, `VERIFY`, `MARK_CLOSED`) → pastikan KPI & daftar ter-refresh lewat `revalidatePath('/dasbor')` tanpa reload penuh; pastikan `ADMIN` tampil read-only (tidak muncul tombol `VERIFY` yang error `FORBIDDEN`).
   - Uji `?selected=<uuid-instansi-lain>` sebagai `PUSKESMAS`/`RUMAH_SAKIT` → kosong (tanpa kebocoran PII).
   - Uji tombol `Rekap Kemenkes (.xlsx)` mengunduh dari `/api/export/laporan/rekap/excel`.
   - Uji toggle `Peta Komando` (`?view=map`) → peta Leaflet penuh + sinkronisasi 2 arah antrean ↔ marker.
3. **Interaksi, Responsif & Aksesibilitas**:
   - Uji slow-motion di DevTools Animation Inspector: tab CSS tidak drop frame, keyboard nav `0ms`, blur tombol `≤2px`, tooltip SLA `data-instant`.
   - Uji viewport mobile `375px` **dan perangkat HP fisik lewat IP lokal** (layar 120Hz): tidak ada auto-open drawer, `Drawer` Detail Kasus & `SpringSheet` Filter Peta tracking 1:1 tanpa lag, flick cepat menutup dengan velocity handoff tanpa lompat, tangkap sheet di tengah gerak (interruptible) mulus, pan peta `PatientLocationMap` tidak menarik sheet (`data-vaul-no-drag`), target sentuh tutup `≥44×44px`, tidak menutupi `MobileBottomDock`, dan `prefers-reduced-motion: reduce` tetap mengizinkan drag langsung dengan settle tanpa bounce.
4. **Cleanup**: pastikan `/prototype/dasbor` mengembalikan `404`.
