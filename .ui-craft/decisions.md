# Design Decision Log: WALI-EPI

### [2026-11-14] Layout & Form Polish Pass
- **Root Cause Fix on Tabs**: Radix Tabs default orientation `horizontal` caused horizontal flex wrap. Diperbaiki di `src/components/ui/tabs.tsx` menjadi `flex flex-col` default dengan `data-[orientation=vertical]:flex-row`. Form `/pengaturan` kini 100% full-width tanpa ruang kosong.
- **Surveillance Workstation Ergonomics on `/laporan/baru`**:
  - Sidebar diringkas dari ~750px menjadi ~340px untuk mencegah clipping di layar laptop 13"-14".
  - Tombol aksi utama (Submit & Batal) dipindahkan dari dasar sidebar yang tersembunyi ke Bottom Primary Action Bar tepat di bawah Section 3 dengan indikator kelengkapan live checklist.
- **Strict Validation**:
  - NIK wajib 16 digit angka dengan sanitasi spasi & tanda hubung.
  - Nomor HP format Indonesia (`08...` atau `628...`).
  - Error messages tampil langsung di bawah masing-masing field input.
- **Zero Test Files Compliance**: Seluruh file test dan skrip vitest dihapus permanen sesuai arahan proyek.
