# Audit Peluang Animasi & Motion — WALI-EPI

- **Tanggal:** 2026-11-24
- **Cakupan:** Landing page (`/`) dan Dashboard Portal Petugas (`/dasbor`, shell navigasi, peta sebaran, dan daftar laporan `/laporan`)
- **Stack motion:** Next.js 16 + React 19 + Tailwind CSS v4 + Radix UI (`DropdownMenu`, `Dialog`) + `motion` v14 (`MotionConfig`) + Leaflet + Recharts
- **Token easing yang direkomendasikan di `src/app/globals.css`:**
  - `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`
  - `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`

---

## Bagian 1 — Peluang Motion (Lolos 4 Gate)

Diurutkan berdasarkan dampak (*leverage*) tertinggi untuk petugas lapangan dan pengguna publik.

| # | Lokasi | Kondisi Saat Ini | Tujuan | Frekuensi | Rekomendasi Motion |
| --- | --- | --- | --- | --- | --- |
| 1 | `src/components/shell/mobile-nav.tsx:158` | Drawer navigasi mobile (`{open && ...}`) muncul & hilang seketika | Spatial consistency, Preventing a jarring change | Occasional | Backdrop `opacity: 0 → 1` (`180ms cubic-bezier(0.23, 1, 0.32, 1)`), panel `transform: translateX(-100%) → translateX(0)` (`260ms cubic-bezier(0.32, 0.72, 0, 1)` masuk, `180ms` keluar ke sisi kiri sama). `prefers-reduced-motion`: fade-only `opacity: 0 → 1` (`140ms`, tanpa `translateX`). |
| 2 | `src/components/reports/facility-map.tsx:795` | `fitMapToData` hardcode `animate: false` (`:803`, `:834`); ganti dropdown zonasi kelurahan atau Reset teleport kamera peta | Spatial consistency | Occasional | Pertahankan `animate: false` saat initial mount; saat user mengubah `selectedZoneId` atau klik Reset, panggil `map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15, animate: true, duration: 0.25, easeLinearity: 0.25 })`. `prefers-reduced-motion`: tetap `animate: false`. |
| 3 | `src/components/reports/facility-map.tsx:525` | Kartu detail `activeCase` saat klik marker kasus GPS (`{activeCase && ...}`) muncul & hilang mendadak | Preventing a jarring change, State indication | Occasional | Masuk/keluar via `@starting-style` atau `AnimatePresence`: `opacity: 0; transform: translateY(6px) scale(0.97)` → settled (`180ms cubic-bezier(0.23, 1, 0.32, 1)` masuk, `140ms` keluar). `prefers-reduced-motion`: `opacity` saja (`120ms`). |
| 4 | `src/components/landing/landing-nav.tsx:98` | Menu dropdown mobile landing (`{menuOpen && ...}`) snap terbuka tanpa transisi | Spatial consistency | Occasional | Masuk via `@starting-style`: `opacity: 0; transform: translateY(-6px)` → settled, `transform-origin: top`, `transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1), opacity 160ms cubic-bezier(0.23, 1, 0.32, 1)`. `prefers-reduced-motion`: `opacity` saja (`120ms`). |
| 5 | `src/components/ui/button.tsx:7` | Press state memakai `active:not-aria-[haspopup]:translate-y-px` tanpa transisi `transform` (snap 1px kaku) | Feedback | Tens/day | Ganti dengan `transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1), background-color 150ms ease, color 150ms ease` + `active:not-aria-[haspopup]:scale-[0.98]`; hover tint di-gate `@media (hover: hover) and (pointer: fine)`. `prefers-reduced-motion`: hapus `scale`, sisakan color transition (`100ms`). |

---

## Bagian 2 — Kandidat Ditolak (Tetap Statis / Instan)

Area yang sengaja **tidak** dianimasikan agar portal operasional tetap cepat dibaca dan dipakai setiap shift:

- `src/components/ui/command.tsx:55` (`CommandPalette` / `⌘K` mewarisi animasi zoom/fade `DialogContent` di `src/components/ui/dialog.tsx:42`) — **Ditolak (bahkan direkomendasikan untuk mencabut animasinya):** *Frequency gate* — aksi keyboard 100+/hari, command palette harus terbuka dan tertutup instan tanpa jeda.
- `src/app/page.tsx:197` (Kartu 3 Tahap / 3 Pilar `#alur`: RS, Puskesmas, Dinkes) — ekspansi accordion atau hover-lift kartu. **Ditolak:** *Purpose & Function gate* — ketiga tahap sudah ringkas dan terbaca paralel; menyembunyikannya di balik accordion menambah klik tanpa manfaat kognitif, dan efek lift dekoratif tidak menjelaskan alur.
- `src/app/(dashboard)/laporan/page.tsx:144` & `src/components/reports/facility-map.tsx:355,577` (Perpindahan tab/filter status kasus, periode, dan toggle layer peta) — sliding pill `layoutId` atau animasi keluar-masuk baris tabel. **Ditolak:** *Frequency & Function gate* — petugas mengganti filter status/layer puluhan hingga ratusan kali per shift; `transition-colors` instan menjaga kecepatan triase.
- `src/components/reports/daily-series-chart.tsx:128` & `src/components/shell/stat.tsx:51` (Draw-in grafik tren 14 hari, toggle Grafik/Tabel, count-up angka KPI) — **Ditolak:** *Function gate* — data surveilans operasional yang perlu langsung dipindai (`isAnimationActive={false}` sudah tepat).
- `src/components/reports/status-stepper.tsx:42` & `src/app/(dashboard)/dasbor/page.tsx:194` (Stagger masuk daftar `ActionItem` dan animasi stepper) — **Ditolak:** *Frequency & Function gate* — halaman dibuka berulang tiap shift; stagger menunda akses ke antrian SLA kritis.

---

## Bagian 3 — Ringkasan & Langkah Lanjut

WALI-EPI adalah alat operasional klinis yang sudah sangat dekat ke porsi motion ideal — sebagian besar UI (tab status kasus, toggle layer peta, tabel laporan, grafik tren, 3 Pilar) **sebaiknya tetap statis/instan** agar petugas RS, Puskesmas, dan Dinkes bekerja tanpa gesekan. Hanya 5 celah spasial dan *feedback* nyata yang lolos gate, dengan *leverage* tertinggi pada **#1 (`mobile-nav.tsx:158` drawer)** untuk petugas lapangan mobile dan **#2 (`facility-map.tsx:795` pan kamera zonasi kelurahan)** untuk menjaga orientasi geografis (ditambah rekomendasi mencabut animasi di `CommandDialog`).

Untuk mengubah salah satu item menjadi rencana implementasi mandiri:

```text
improve-animations plan <deskripsi item dari Bagian 1>
```

---

*Catatan cakupan: audit belum mencakup halaman detail/form sekunder (mis. modal form PE, dialog CRUD `/admin/*`) maupun uji rasa aktual di browser/device mobile.*
