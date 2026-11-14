# Design Tokens: WALI-EPI

### Knobs
- **CRAFT_LEVEL:** 8 (Pixel-perfect polish)
- **MOTION_INTENSITY:** 4 (150-250ms subtle transitions, zero bounce, prefers-reduced-motion)
- **VISUAL_DENSITY:** 7 (Clinical surveillance workstation & dense data)
- **DESIGN_VARIANCE:** 4 (Symmetric, high-trust, structured split panels)

---

### Layer 1: Primitive Tokens

#### Colors
- Primary: `#0284C7` (Sky 600 - Clinical Teal/Blue)
- Accent / Positive: `#16A34A` (Green 600 - Normal/Aman/ABJ ≥95%)
- Destructive / Critical: `#DC2626` (Red 600 - SLA Kritis/Kasus Berat/Fogging)
- Warning: `#D97706` (Amber 600 - Suspek/Pending PE)
- Neutral Slate Ramp:
  - Surface Light: `#F8FAFC`
  - Surface Dark: `#0B0F17`
  - Border Light: `#E2E8F0`
  - Border Dark: `#1E293B`

#### Typography
- Heading & Display: `Geist`, `Fira Code` (font-mono untuk data numerik/NIK/SLA)
- Body: `Geist Sans`, system-ui
- Tracking: `-0.02em` (`tracking-tight`) untuk heading di atas 20px

#### Radius Scale
- Input / Buttons: `6px` (`rounded-md` / `var(--radius-field)`)
- Cards & Split Panels: `10px` (`rounded-lg` / `var(--radius-card)`)
- Dialogs / Drawers: `14px` (`rounded-xl` / `var(--radius-dialog)`)

---

### Layer 2: Semantic Tokens
- `--bg-surface`: Latar kartu utama
- `--border-subtle`: Border pembagi data
- `--text-primary`: Kontras tinggi untuk judul & isi
- `--text-secondary`: Keterangan pembantu & metadata
- `--status-critical`: SLA terlewat atau klaster merah
- `--status-warning`: Menunggu investigasi PE
- `--status-positive`: PE selesai & ABJ normal

---

### Layer 3: Component Rules
- Data Table: TanStack Table v9 dengan row height 40px (desktop) dan card view (mobile)
- Chart: Recharts v3 dengan gradient subtle (15% → 0%), legend eksplisit, direct labeling
- Sticky Rails: Max height 360px untuk mencegah clipping pada viewport laptop
- Primary Action Bars: Diletakkan tepat di bawah alur pengisian form utama dengan live status indicator
