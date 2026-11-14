# Design Brief: WALI-EPI

### 1. Product purpose
Sistem surveilans epidemiologi kewaspadaan dini demam berdarah dengue (DBD) terintegrasi untuk pelaporan kasus rumah sakit, penyelidikan epidemiologi (PE) puskesmas, dan pemantauan klaster transmisi dinas kesehatan kota/kabupaten.

### 2. Primary user
Petugas surveilans Puskesmas dan tim epidemiologi Dinas Kesehatan yang bekerja di lapangan menggunakan smartphone dan di workstation kantor menggunakan laptop (layar 13"-15"), melakukan triase laporan kasus dalam SLA ketat 24-72 jam.

### 3. Principles
1. **Clinical Precision over Decorative Whimsy**: Tata letak terstruktur, data tabular mono untuk angka kritis (NIK 16 digit, trombosit, hitungan mundur SLA, koordinat GPS), tanpa ornamen palsu atau ilustrasi kartun.
2. **Speed & Zero Ambiguity**: Formulir dan alur aksi menempatkan kontrol utama di alur baca alami dengan feedback validasi instan, tanpa menyembunyikan tombol aksi di ujung scroll.
3. **Resilient Field Ergonomics**: Semua kontrol interaktif memiliki touch target minimum 44×44px, navigasi mobile dock yang aman, dan layout adaptif anti-cutoff.
4. **Zero AI Slop**: Desain berbasis Swiss/Minimalist design, palet dominan 90%+ netral dengan 1 aksen klinis (Deep Teal `#0284C7`) dan warna status fungsional (Merah `#DC2626` untuk peringatan/SLA kritis, Hijau `#16A34A` untuk selesai/ABJ normal).

### 4. Voice & Tone
- Bahasa Indonesia baku, ringkas, klinis, dan instruktif.
- Status dan badge menggunakan terminologi epidemiologi resmi Kemenkes (DBD, DD, SSD, PE 100m, ABJ, HI, CI).

### 5. Non-Negotiable Constraints
- Validasi Zod v4 ketat pada client & server (NIK 16 digit, No HP format ID).
- Zero test files di repository (aturan eksplisit pengguna).
- Full dark & light mode support dengan kontras WCAG 2.1 AA (minimal 4.5:1).
- Komponen vector SVG Lucide, dilarang menggunakan emoji untuk ikon struktural.
