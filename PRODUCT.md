# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Petugas Surveilans Puskesmas (Desktop & Mobile Lapangan):** Menerima atau menolak penugasan kasus DBD di wilayah kerjanya (wajib menyertakan catatan/`notes` penolakan jika kasus tidak sesuai wilayah sebelum melakukan PE), melaksanakan Penyelidikan Epidemiologi (PE) di lapangan, mencatat hasil pemeriksaan jentik (ABJ/HI/CI), dan menindaklanjuti fogging/logistik.
- **Analis Dinas Kesehatan (Dinkes):** Memantau kasus lintas wilayah kota/kabupaten, menginput kasus dari luar wilayah (misalnya kasus luar wilayah Kota Cirebon), melempar/meneruskan kasus ke wilayah atau Puskesmas yang sesuai, memverifikasi hasil PE dan laporan, serta memantau klaster transmisi.
- **Operator Rumah Sakit (RS):** Menginput laporan kasus DBD pasien masuk/rawat beserta data klinis dan memantau status tindak lanjut.
- **Admin:** Meninjau dan menyetujui registrasi akun (`PENDING` → `APPROVED`/`REJECTED`), menetapkan peran dan institusi, mengelola master kelurahan/batas wilayah, serta mengatur identitas portal.

## Product Purpose

WALI-EPI (SiLapor DBD) adalah sistem surveilans terpadu Demam Berdarah Dengue (DBD) berbasis wilayah untuk mempercepat triase kasus, penugasan lintas fasilitas kesehatan, penyelidikan epidemiologi (PE), dan respons pengendalian vektor dalam batas SLA ketat (24 jam respon penugasan, 72 jam pelaksanaan PE) tanpa kasus terlewat atau salah wilayah.

## Positioning

Alur surveilans DBD end-to-end berbasis batas wilayah kelurahan (PostGIS/GeoJSON) dengan auto-assign Puskesmas, input kasus luar wilayah & lempar kasus lintas wilayah oleh Dinkes, penolakan kasus ber-catatan (`notes`) oleh Puskesmas sebelum PE, kalkulasi entomologi otomatis (ABJ/HI/CI), deteksi klaster spasial-temporal (100m / 14 hari), dan notifikasi WhatsApp — dirancang agar leluasa diakses di web mobile lapangan sekaligus presisi di desktop command center.

## Operating Context

- **Mobile Web Lapangan:** Dipakai petugas Puskesmas di ponsel saat survei jentik/PE di rumah warga dan saat meninjau/menolak penugasan kasus. Seluruh alur inti harus leluasa diakses di layar kecil dengan target sentuh nyaman, navigasi cepat (`MobileBottomDock` & `MobileNav`), dan form panjang yang tetap ergonomis.
- **Desktop Command Center:** Dipakai operator RS, analis Dinkes, dan Admin untuk triase tabel kasus (`.ledger`), peta sebaran/klaster Leaflet, verifikasi PE, manajemen wilayah, dan ekspor rekap Excel/PDF.
- **Alur Inti:** RS / Poli Puskesmas / Dinkes (kasus luar wilayah atau manual) input kasus → auto-assign / Dinkes lempar atau disposisi ulang kasus (`SUBMITTED`, `PUSKESMAS_REJECTED`, `CROSS_BORDER_PENDING`) ke Puskesmas wilayah → Puskesmas terima atau tolak dengan `notes` wajib sebelum PE → pelaksanaan PE (ABJ/HI/CI) → verifikasi Dinkes → tindak lanjut fogging/logistik → tutup kasus.
- **Autentikasi & Akun:** Login tunggal menggunakan **email atau username** (Better Auth plugin `username`), registrasi mandiri dengan verifikasi OTP email + username opsional, persetujuan akun oleh Admin (`PENDING` → `APPROVED`/`REJECTED`), manajemen `@username` di `/admin/pengguna`, serta rate-limit & proteksi lockout brute-force.

## Capabilities and Constraints

- **Stack & Runtime:** Next.js 16 App Router (`src/`), React 19, Tailwind CSS v4, PostgreSQL + PostGIS, Drizzle ORM, better-auth, Zod v4, TanStack Query/Table, Recharts, react-leaflet, exceljs, `@react-pdf/renderer`.
- **Invarian Domain & Keamanan:** Rumus entomologi baku (`ABJ`, `HI`, `CI`), enkripsi PII AES-256-GCM (NIK, nama, alamat, telepon), CSP berbasis nonce (`src/proxy.ts`), isolasi tenant, dan alur status laporan/PE tidak boleh diubah atau dilemahkan oleh perubahan UI.
- **Data Klinis & Operasional Wajib:** NIK 16 digit, nama pasien, tanggal onset/masuk, trombosit & hematokrit, lokasi/kelurahan, status PE, status fogging, catatan penolakan/lempar wilayah, dan hitungan mundur SLA.
- **White-Label Daerah & Logo:** Nama aplikasi, tagline, nama instansi/daerah, logo web, favicon, footer, hotline darurat, dan email dukungan dapat diganti langsung dari web (`/pengaturan` → `BrandingSettings`: `APP_TITLE`, `APP_TAGLINE`, `INSTITUTION_NAME`, `APP_LOGO_URL`, `APP_FAVICON_URL`, `APP_FOOTER_TEXT`, `EMERGENCY_HOTLINE`, `SUPPORT_EMAIL`). Nilai bawaan bersifat netral (`WALI-EPI`, `Dinas Kesehatan`, hotline `119`) dan seluruh permukaan (landing, auth, shell dashboard, metadata/favicon, dan email OTP) membaca `getPortalBranding()` secara dinamis.
- **Bahasa:** Bahasa Indonesia klinis-operasional.

## Brand Commitments

- **Nama Produk:** WALI-EPI (SiLapor DBD), dengan identitas daerah, nama instansi, dan logo web yang dinamis mengikuti pengaturan portal (`/pengaturan`).
- **Aset Logo:** Tidak ada logo instansi statis yang dikunci di `public/`; logo dan favicon portal bersumber dari konfigurasi web (`APP_LOGO_URL`, `APP_FAVICON_URL`).

## Evidence on Hand

- Implementasi UI aktif di `src/app/` (landing `/`, auth `/masuk`, `/daftar`, `/lupa-password`, dan 29 rute dashboard di `src/app/(dashboard)/`), sistem token di `src/app/globals.css`, serta pengaturan branding di `src/app/(dashboard)/pengaturan/branding-settings.tsx`.
- Dokumen alur dan spesifikasi di `ALUR-WEBSITE.md`, `PROJECT_DESIGN.md`, dan `spesifikasi_desain_sistem_wali_epi.md`.
- Catatan: `design-system/wali-epi/MASTER.md` adalah artefak lama (Fira Sans/Code + `#0284C7`) yang tidak dipakai oleh `src/app/globals.css` dan `src/app/layout.tsx`.

## Product Principles

1. **Mobile web leluasa, desktop presisi:** Setiap alur inti (lapor, input luar wilayah, lempar kasus, tolak + notes, PE, verifikasi, peta) harus dapat diakses penuh dan nyaman di ponsel lapangan maupun layar lebar.
2. **Nol ambiguitas wilayah & status:** Penugasan, penolakan ber-catatan sebelum PE, lempar kasus lintas wilayah, dan hitungan mundur SLA selalu eksplisit.
3. **Kepadatan klinis yang tenang:** Angka tabular, kontras tinggi, dan hierarki jelas tanpa ornamen dekoratif yang mengganggu triase cepat.
4. **Identitas daerah fleksibel:** Nama daerah, instansi, dan logo web selalu mengikuti konfigurasi portal agar siap dipakai lintas daerah.

## Accessibility & Inclusion

- Target WCAG AA: kontras teks >= 4.5:1 (teks besar >= 3:1), fokus keyboard terlihat jelas (`:focus-visible`), pintasan `⌘K`, dukungan mode terang/gelap, target sentuh mobile yang nyaman, serta `prefers-reduced-motion` yang tetap mempertahankan kejelasan perubahan status.
