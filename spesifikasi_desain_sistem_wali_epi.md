# Spesifikasi Desain & Master AI Prompt: WALI-EPI

Dokumen ini memuat panduan komprehensif, daftar dependensi, spesifikasi arsitektur, dan **Master Execution Prompt untuk AI Code Assistant** dalam melakukan redesign total antarmuka (UI/UX) aplikasi **WALI-EPI** (Sistem Surveilans & Penyelidikan Epidemiologi DBD).

---

## 1. MASTER AI PROMPT (COPY-PASTE READY UNTUK AI ASSISTANT)

> **PETUNJUK PENGGUNAAN:** Salin seluruh blok teks di bawah ini dan berikan langsung ke AI Assistant (Cursor, Windsurf, Claude Code, GitHub Copilot, dsb.) sebagai System/Task Prompt untuk mengeksekusi redesign.

```text
================================================================================
MASTER PROMPT: REDESIGN TOTAL FRONTEND WALI-EPI (MOBILE-FIRST WEB)
================================================================================

PERAN & IDENTITAS ANDA:
Anda adalah Senior Staff Frontend Engineer & Design System Architect kelas dunia dengan keahlian mendalam pada: Next.js 15 App Router, React 19, Tailwind CSS v4, Motion v12, Shadcn UI, Radix Primitives, TanStack Table/Query, dan Leaflet GIS.

MISI ANDA:
Lakukan redesign visual dan restrukturisasi antarmuka (UI/UX) total dari awal untuk sistem surveilans epidemiologi "WALI-EPI" dengan pendekatan UTAMA: MOBILE-FIRST WEB yang ergonomis di smartphone lapangan, namun adaptif menjadi desktop-grade workspace di layar lebar.

================================================================================
BATASAN KETAT & LARANGAN MUTLAK (HARD CONSTRAINTS - DO NOT VIOLATE):
================================================================================
1. JANGAN PERNAH mengubah alur logika bisnis (business logic), algoritma kalkulasi entomologi (ABJ/HI/CI), atau alur status laporan yang sudah berjalan:
   - Rumus ABJ = (Rumah Bebas Jentik / Rumah Diperiksa) * 100%
   - Rumus HI = (Rumah Positif Jentik / Rumah Diperiksa) * 100%
   - Rumus CI = (TPA Positif / TPA Diperiksa) * 100%
   - Rekomendasi Fogging Otomatis jika: (Ada penderita lain OR suspek >= 3) AND (ABJ < 95% OR Jentik >= 5%).
2. JANGAN PERNAH mengubah atau merusak skema database (Drizzle ORM), tipe TypeScript API contract, query key TanStack Query, dan skema validasi Zod yang sudah ada.
3. JANGAN PERNAH mengubah mekanisme backend worker (BullMQ + Redis) untuk:
   - `assign` (auto-match kelurahan ke Puskesmas)
   - `whatsapp-dispatch` (notifikasi otomatis WA)
   - `sla` (countdown 1x24 jam respon penugasan & 3x24 jam respon PE)
   - `cluster-detector` (deteksi kasus radius 100m dalam 14 hari)
   - `export` (pembuatan file XLSX/PDF asinkron)
4. JANGAN PERNAH mengubah logic Better-Auth dan enkripsi data pribadi (PII: NIK, nama lengkap, kontak pasien).
5. WAJIB menerapkan prinsip "Strict Separation of Concerns":
   - Pisahkan kode visual murni (Presentation Component) dari Logic Hooks / Controller (`useReportQuery`, `usePEForm`, `useFilters`).
   - Jangan menulis fetch logic langsung di dalam komponen UI visual.

================================================================================
TATA KELOLA DEPENDENSI & STACK TEKNIS
================================================================================
Gunakan dependensi yang tertera pada dokumen DESIGN.md.
Aturan khusus library:
- Hapus paket npm pihak ketiga "cn". Buat utilitas internal `cn(...inputs)` menggunakan kombinasi `clsx` + `tailwind-merge`.
- Jangan gunakan "tw-animate-css". Gunakan animasi berbasis native Tailwind CSS v4 dan library "motion" (framer-motion v12).
- Gunakan "nuqs" untuk semua state URL (filter pencarian, tab, pagination, sorting, status).
- Gunakan "vaul" untuk seluruh sheet/drawer mobile gesture.
- Gunakan "browser-image-compression" pada setiap upload berkas kamera lapangan sebelum di-dispatch ke `/api/attachments`.
- Gunakan "@react-pdf/renderer" untuk ekspor berkas cetak resmi standar Kemenkes.

================================================================================
STANDAR DESIGN TOKENS & TEMA ("Clinical Precision & Field Operational"):
================================================================================
Palet Warna:
- Base: Zinc (Light: #FAFAFA, Dark: #09090B, Border Light: #E4E4E7, Border Dark: #27272A)
- Brand Primary: Deep Teal (Light: #0D9488 / teal-600, Dark: #14B8A6 / teal-500)
- Triage Kritis / SSD / Kluster Aktif / SLA Kritis: Rose (#E11D48 / rose-600)
- Triage Waspada / DBD / Butuh Tindakan / ABJ < 95%: Amber (#D97706 / amber-600)
- Triage Informasi / DD / Observasi Lab: Sky Blue (#0284C7 / sky-600)
- Triage Aman / Terverifikasi / Selesai / ABJ >= 95%: Emerald (#059669 / emerald-600)

Tipografi:
- Body/UI: Geist Sans atau Inter
- Angka Medis & Koordinat (WAJIB FONT MONOSPACE): Geist Mono atau JetBrains Mono untuk:
  * Trombosit (/µL)
  * Hematokrit (%)
  * Angka Bebas Jentik (ABJ %)
  * Sisa Waktu SLA (hh:mm:ss)
  * Koordinat GPS (latitude, longitude)
  * ID Laporan / Token (#ID-XXXXX)

================================================================================
SPESIFIKASI ARSITEKTUR MOBILE-FIRST & RESPONSIVE BEHAVIOR
================================================================================

1. GLOBAL NAVIGATION & SHELL:
- Layar Mobile (< 768px):
  * Gunakan Floating Bottom Navigation Bar melayang (Dasbor, Peta PE, FAB Tombol Cepat Lapor di tengah, Antrean Verifikasi, Profil/Notif) yang ramah jangkauan jempol (thumb-zone).
  * Header atas minimalis: Logo instansi, status koneksi (online/offline indicator), dan tombol Search/Command Palette.
- Layar Desktop (>= 768px):
  * Sembunyikan bottom dock.
  * Tampilkan Collapsible Sidebar kiri + Header lengkap dengan breadcrumbs dan profile dropdown.

2. COMMAND PALETTE (`cmdk`):
- Pemicu: Pintasan `Ctrl + K` / `Cmd + K` atau tombol cari di header.
- Fitur: Navigasi cepat antar-kelurahan, pencarian nomor ID laporan KDRS, lompat ke rute menu, dan filter kasus darurat.

3. ADAPTIVE MASTER-DETAIL WORKSPACE:
- Layar Mobile:
  * Data tabel KDRS dirender sebagai "Interactive Feed Cards" dengan badge urgensi SLA, ringkasan trombosit/diagnosa, dan kelurahan.
  * Mengetuk kartu membuka Drawer berbasis gestur sentuh ("vaul") dengan snap point 50% (peek) dan 92% (full-detail).
  * Tombol aksi (Terima / Tolak / Eskalasi) diletakkan di bagian bawah drawer agar mudah ditekan satu tangan.
- Layar Desktop:
  * Gunakan split-pane layout ("react-resizable-panels"): Sisi kiri berupa TanStack Data Table lengkap (dengan faceted filters & column visibility), sisi kanan berupa Live Preview detail kasus + Peta Radius 100m.

4. FORMULIR PENYELIDIKAN EPIDEMIOLOGI (PE) MULTI-STEP WIZARD:
- Di mobile, pecah formulir investigasi menjadi 4 langkah logis:
  * Step 1: Identitas Pasien & Konfirmasi Gejala (termasuk riwayat bepergian 7-14 hari).
  * Step 2: Pemeriksaan Spesimen Lab & Titik GPS Domisili (dengan tombol "Ambil Titik GPS Saya").
  * Step 3: Tabel Survei Jentik 20 Rumah Tangga (Input cepat: tombol toggle +/- untuk TPA dalam/luar rumah).
  * Step 4: Dokumentasi Foto Lapangan (kompresi otomatis client-side) & Hasil Kalkulator ABJ Otomatis.
- Sediakan Sticky Bottom Bar pada form untuk tombol navigasi: [ Kembali ] [ Lanjut / Simpan ].

5. PETA SPASIAL LEAFLET MOBILE OPTIMIZATION:
- Menggunakan CartoDB Positron (Light) dan Dark Matter (Dark) yang sinkron dengan theme.
- Tampilkan lingkaran spasial radius 100 meter (stroke merah putus-putus, fill merah transparan 12%) dari titik domisili kasus terkonfirmasi.
- Gunakan marker clustering untuk titik-titik kasus berdekatan.
- Kontrol zoom dan tombol geolokasi diletakkan di sisi kanan bawah (mudah dijangkau jempol).
- Mengetuk marker di mobile TIDAK membuka tooltip pop-up kecil yang terpotong, melainkan memicu kartu ringkas melayang di atas peta.

================================================================================
TAHAPAN PENGERJAAN EKSEKUSI (STEP-BY-STEP INSTRUCTIONS):
================================================================================
Lakukan refaktorisasi secara bertahap dan sistematis:

TAHAP 1: Audit & Ekstraksi Logika (Logic Decoupling)
- Identifikasi seluruh komponen yang memadukan UI visual dengan data-fetching.
- Ekstrak logic tersebut ke dalam custom hooks (misal: `useReportList`, `usePEDetails`, `useEntomologyCalculator`).
- Pastikan tidak ada endpoint API, mutasi Drizzle, atau query key yang berubah.

TAHAP 2: Penyiapan UI Shell & Layout Responsive
- Pasang tema warna CSS pada Tailwind CSS v4.
- Bangun layout shell universal: `MobileBottomDock` untuk mobile dan `DesktopSidebar` untuk desktop.
- Implementasikan Command Palette global (`cmdk`).

TAHAP 3: Transformasi Modul Kasus KDRS
- Buat komponen `MobileKDRSFeed` dan `KDRSDetailDrawer` menggunakan `vaul`.
- Buat komponen `DesktopKDRSTable` menggunakan TanStack Table + `react-resizable-panels`.
- Integrasikan state filter dengan `nuqs`.

TAHAP 4: Transformasi Formulir PE Lapangan & Kalkulator ABJ
- Rancang `MobilePEWizard` multi-langkah dengan validasi `react-hook-form` + `zod` yang ada.
- Pasang kalkulator entomologi reaktif: ABJ, HI, CI, dan auto-rekomendasi Fogging Fokus.
- Hubungkan input kamera dengan pipeline `compressFieldImage` sebelum masuk ke mutasi.

TAHAP 5: Modul Spasial Peta & Logistik
- Optimalkan peta Leaflet untuk kontrol sentuh mobile dan buffer 100m.
- Perbarui antarmuka modul logistik Abate/insektisida dan pencatatan eksekusi fogging 2 siklus.
- Pasang template ekspor berkas resmi PDF berbasis `@react-pdf/renderer`.

MULAI TUGAS INI SECARA TERSTRUKTUR. TULISKAN KODE BERSIH, TYPE-SAFE, MODULAR, DAN BEBAS ERROR.
================================================================================
```

---

## 2. Daftar Dependensi Lengkap (Dependencies & Tooling)

### `dependencies`

```json
{
  "dependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@radix-ui/react-accordion": "^1.2.2",
    "@radix-ui/react-alert-dialog": "^1.1.4",
    "@radix-ui/react-avatar": "^1.1.2",
    "@radix-ui/react-checkbox": "^1.1.3",
    "@radix-ui/react-dialog": "^1.1.4",
    "@radix-ui/react-dropdown-menu": "^2.1.4",
    "@radix-ui/react-label": "^2.1.1",
    "@radix-ui/react-popover": "^1.1.4",
    "@radix-ui/react-radio-group": "^1.2.2",
    "@radix-ui/react-select": "^2.1.4",
    "@radix-ui/react-separator": "^1.1.1",
    "@radix-ui/react-slot": "^1.1.1",
    "@radix-ui/react-switch": "^1.1.2",
    "@radix-ui/react-tabs": "^1.1.2",
    "@radix-ui/react-tooltip": "^1.1.6",
    "@react-pdf/renderer": "^4.1.2",
    "@tanstack/react-query": "^5.66.0",
    "@tanstack/react-table": "^8.21.2",
    "@tiptap/react": "^2.11.0",
    "@tiptap/starter-kit": "^2.11.0",
    "better-auth": "^1.1.18",
    "browser-image-compression": "^2.0.2",
    "bullmq": "^5.41.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.0.4",
    "date-fns": "^4.1.0",
    "drizzle-orm": "^0.39.0",
    "exceljs": "^4.4.0",
    "input-otp": "^1.4.2",
    "ioredis": "^5.5.0",
    "leaflet": "^1.9.4",
    "leaflet.markercluster": "^1.5.3",
    "lucide-react": "^0.475.0",
    "motion": "^12.4.0",
    "next": "15.1.7",
    "next-themes": "^0.4.4",
    "nuqs": "^2.3.2",
    "postgres": "^3.4.5",
    "react": "19.0.0",
    "react-day-picker": "^9.5.1",
    "react-dom": "19.0.0",
    "react-dropzone": "^14.3.5",
    "react-hook-form": "^7.54.2",
    "react-leaflet": "^5.0.0",
    "react-number-format": "^5.4.3",
    "react-phone-number-input": "^3.4.10",
    "react-resizable-panels": "^2.1.7",
    "recharts": "^2.15.1",
    "sonner": "^2.0.1",
    "tailwind-merge": "^3.0.1",
    "vaul": "^1.1.2",
    "zod": "^3.24.2"
  }
}
```

### `devDependencies`

```json
{
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.7",
    "@testing-library/react": "^16.2.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/leaflet": "^1.9.16",
    "@types/leaflet.markercluster": "^1.5.4",
    "@types/node": "^22.13.4",
    "@types/react": "^19.0.8",
    "@types/react-dom": "^19.0.3",
    "@typescript-eslint/parser": "^8.24.0",
    "@vitejs/plugin-react": "^4.3.4",
    "drizzle-kit": "^0.30.4",
    "eslint": "^9.20.1",
    "eslint-config-next": "15.1.7",
    "jsdom": "^26.0.0",
    "prettier": "^3.5.1",
    "prettier-plugin-tailwindcss": "^0.6.11",
    "redis-memory-server": "^0.11.0",
    "shadcn": "^2.3.0",
    "tailwindcss": "^4.0.7",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.24.0",
    "vitest": "^3.0.5"
  }
}
```

---

## 3. Desain Token & Konfigurasi CSS (Tailwind v4)

Tambahkan token variabel berikut pada berkas global CSS utama (`app/globals.css`):

```css
@import "tailwindcss";

@layer base {
  :root {
    --background: 240 10% 98%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    
    /* Primary Public Health: Deep Teal */
    --primary: 173 80% 32%; /* #0D9488 */
    --primary-foreground: 0 0% 100%;
    
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 173 58% 39%;
    --accent-foreground: 0 0% 100%;
    
    /* Triage Status */
    --destructive: 346 77% 49%; /* Rose-600 */
    --destructive-foreground: 0 0% 100%;
    --warning: 38 92% 50%; /* Amber-600 */
    --warning-foreground: 0 0% 100%;
    --safe: 160 84% 39%; /* Emerald-600 */
    --safe-foreground: 0 0% 100%;

    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 173 80% 32%;
    --radius: 1rem;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 6.9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 6.9%;
    --popover-foreground: 0 0% 98%;
    
    --primary: 173 70% 40%;
    --primary-foreground: 0 0% 100%;
    
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 173 70% 40%;
    --accent-foreground: 0 0% 100%;

    --destructive: 346 77% 49%;
    --destructive-foreground: 0 0% 100%;
    --warning: 38 92% 50%;
    --warning-foreground: 0 0% 100%;
    --safe: 160 84% 39%;
    --safe-foreground: 0 0% 100%;

    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 173 70% 40%;
  }
}
```

---

## 4. Cetak Biru Logika & Kalkulator Entomologi PE (Untuk AI)

Gunakan modul pure helper ini agar AI tidak menulis ulang rumus perhitungan PE:

```typescript
// lib/entomology-calculator.ts

export interface HouseholdSurveyRow {
  houseNumber: number;
  houseOwner: string;
  isInsideContainerPositive: boolean;
  isOutsideContainerPositive: boolean;
  totalContainersChecked: number;
  totalPositiveContainers: number;
}

export interface EntomologySummary {
  totalHousesChecked: number;
  positiveHousesCount: number;
  negativeHousesCount: number;
  totalContainersChecked: number;
  positiveContainersCount: number;
  abj: number; // Angka Bebas Jentik (%)
  hi: number;  // House Index (%)
  ci: number;  // Container Index (%)
  transmissionRisk: "POSITIF_PENULARAN" | "NEGATIF_PENULARAN";
  foggingRecommended: boolean;
  actionPlan: string;
}

export function calculateEntomologyMetrics(
  surveys: HouseholdSurveyRow[],
  hasOtherDenguePatients: boolean,
  suspectedFeverCount: number
): EntomologySummary {
  const totalHousesChecked = surveys.length || 1; // Cegah divide-by-zero
  
  let positiveHousesCount = 0;
  let totalContainersChecked = 0;
  let positiveContainersCount = 0;

  for (const s of surveys) {
    if (s.isInsideContainerPositive || s.isOutsideContainerPositive) {
      positiveHousesCount++;
    }
    totalContainersChecked += s.totalContainersChecked || 0;
    positiveContainersCount += s.totalPositiveContainers || 0;
  }

  const negativeHousesCount = Math.max(0, totalHousesChecked - positiveHousesCount);
  const abj = Number(((negativeHousesCount / totalHousesChecked) * 100).toFixed(2));
  const hi = Number(((positiveHousesCount / totalHousesChecked) * 100).toFixed(2));
  const ci = totalContainersChecked > 0 
    ? Number(((positiveContainersCount / totalContainersChecked) * 100).toFixed(2))
    : 0;

  // Standar Kemenkes RI:
  // Positif penularan bila: ada penderita DBD lain ATAU ada >= 3 penderita panas tanpa sebab lain, DAN ditemukan jentik (HI >= 5% atau ABJ < 95%)
  const hasFeverCluster = hasOtherDenguePatients || suspectedFeverCount >= 3;
  const isLarvaDangerous = abj < 95 || hi >= 5;

  const isTransmissionPositive = hasFeverCluster && isLarvaDangerous;
  const foggingRecommended = isTransmissionPositive;

  const actionPlan = foggingRecommended
    ? "FOGGING FOKUS (2 Siklus Interval 7 Hari) + PSN 3M PLUS MASSAL"
    : "PSN 3M PLUS MASSAL & LARVASIDASI SELEKTIF (ABATISASI)";

  return {
    totalHousesChecked: surveys.length,
    positiveHousesCount,
    negativeHousesCount,
    totalContainersChecked,
    positiveContainersCount,
    abj,
    hi,
    ci,
    transmissionRisk: isTransmissionPositive ? "POSITIF_PENULARAN" : "NEGATIF_PENULARAN",
    foggingRecommended,
    actionPlan,
  };
}
```

---

## 5. Ringkasan File Baru yang Dihasilkan

1. **`DESIGN.md`**: Dokumen ini sebagai instruksi acuan master AI.
2. **`ALUR-WEBSITE.md`**: Dokumentasi alur status, integrasi WA dispatch, SLA, logistik fogging, dan format PDF resmi.
3. **`app/page.tsx`**: Landing page publik one-page yang responsif untuk transparansi risiko DBD kelurahan dan edukasi PSN.