---
name: WALI-EPI Clinical Field Ledger
description: Calm, high-contrast clinical surveillance design system for Indonesian dengue reporting, field PE, and regional triage across mobile web and desktop.
colors:
  ground: "#fafafa"
  surface: "#ffffff"
  raised: "#f4f4f5"
  active: "#e6f7f5"
  border: "#e4e4e7"
  rule: "#f4f4f5"
  control: "#d4d4d8"
  text: "#09090b"
  muted: "#52525b"
  faint: "#71717a"
  accent: "#0d9488"
  accent-ink: "#ffffff"
  accent-soft: "#ccfbf1"
  viz-1: "#0284c7"
  viz-2: "#e11d48"
  viz-3: "#059669"
  viz-4: "#d97706"
  positive: "#059669"
  negative: "#e11d48"
  warning: "#d97706"
  info: "#0284c7"
  pill-positive-bg: "#ecfdf5"
  pill-positive-ink: "#065f46"
  pill-positive-border: "#a7f3d0"
  pill-negative-bg: "#fff1f2"
  pill-negative-ink: "#9f1239"
  pill-negative-border: "#fecdd3"
  pill-warning-bg: "#fffbeb"
  pill-warning-ink: "#92400e"
  pill-warning-border: "#fde68a"
  pill-info-bg: "#f0f9ff"
  pill-info-ink: "#075985"
  pill-info-border: "#bae6fd"
  pill-neutral-bg: "#f4f4f5"
  pill-neutral-ink: "#3f3f46"
  pill-neutral-border: "#e4e4e7"
  dark-ground: "#09090b"
  dark-surface: "#111114"
  dark-raised: "#18181b"
  dark-active: "#112a27"
  dark-border: "#27272a"
  dark-control: "#3f3f46"
  dark-text: "#fafafa"
  dark-muted: "#a1a1aa"
  dark-accent: "#14b8a6"
  dark-accent-ink: "#042f2e"
  dark-accent-soft: "#134e4a"
typography:
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  kpi:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.1
    fontFeature: "tnum"
  section:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0.01em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: "tnum"
rounded:
  sm: "6px"
  control: "8px"
  card: "14px"
  xl: "18px"
  pill: "999px"
spacing:
  gap: "16px"
  pad: "24px"
  control-height: "38px"
  row-height: "44px"
  topbar-height: "56px"
  sidebar-width: "248px"
  sidebar-collapsed: "68px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.control}"
    height: "{spacing.control-height}"
    padding: "0 14px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    height: "{spacing.control-height}"
    padding: "0 14px"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    height: "{spacing.control-height}"
    padding: "0 14px"
  button-destructive:
    backgroundColor: "{colors.pill-negative-bg}"
    textColor: "{colors.pill-negative-ink}"
    rounded: "{rounded.control}"
    height: "{spacing.control-height}"
    padding: "0 14px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    height: "{spacing.control-height}"
    padding: "4px 12px"
  card-surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "16px"
  status-pill:
    backgroundColor: "{colors.pill-neutral-bg}"
    textColor: "{colors.pill-neutral-ink}"
    rounded: "{rounded.pill}"
    height: "24px"
    padding: "0 10px"
---

# Design System: WALI-EPI Clinical Field Ledger

## Overview

**Creative North Star: "Clinical Field Ledger"**

WALI-EPI pairs a calm mineral-alabaster Zinc canvas with crisp 1px architectural hairlines and a deep clinical teal primary signal (`#0d9488` light / `#14b8a6` dark). The interface is built for high-stakes dengue surveillance across two equally critical environments: rapid field use on mobile web by Puskesmas officers and dense multi-case triage on desktop command centers by hospitals and Dinas Kesehatan.

Every surface prioritizes legibility, tabular numeric alignment, and unambiguous status hierarchy over decorative ornament. Regional identity (institution name, region title, and portal logo) is dynamically injected from portal settings rather than baked into static chrome.

**Key Characteristics:**
- Mineral Zinc neutral hierarchy (`#fafafa` ground, `#ffffff` surface, `#f4f4f5` raised) with dark mode parity (`#09090b` / `#111114` / `#18181b`).
- Deep Teal (`#0d9488` / `#14b8a6`) reserved strictly for primary actions, active navigation, and focus rings.
- CVD-validated 4-color categorical dataviz palette (`--viz-1..4`) separated from UI chrome.
- Tabular numerals (`font-variant-numeric: tabular-nums`) across all tables, KPIs, SLA countdowns, and timestamps.
- Mobile-first accessibility: sticky headers, bottom dock navigation (`MobileBottomDock`), and responsive ledger/card layouts.

## Colors

A restrained Zinc neutral scale anchors dense clinical data while Deep Teal signals primary action and four semantic pill ramps communicate triage state.

### Primary
- **Deep Teal** (`#0d9488` light / `#14b8a6` dark): Primary CTA buttons, active navigation highlights (`--active`: `#e6f7f5` / `#112a27`), focus rings, and primary progress/accent bars.

### Semantic & DataViz
- **Positive / Verified** (`#059669` light / `#34d399` dark; pill `#ecfdf5` / `#065f46`): Approved accounts, completed PE, verified reports.
- **Negative / Critical** (`#e11d48` light / `#fb7185` dark; pill `#fff1f2` / `#9f1239`): Rejected cases, overdue SLA, destructive actions.
- **Warning / Pending** (`#d97706` light / `#fbbf24` dark; pill `#fffbeb` / `#92400e`): Pending assignment, approaching SLA deadline, out-of-region review.
- **Info / DataViz Primary** (`#0284c7` light / `#38bdf8` dark; pill `#f0f9ff` / `#075985`): Informational badges and primary chart series (`--viz-1`).

### Neutral
- **Ground** (`#fafafa` light / `#09090b` dark): App shell canvas behind cards and panels.
- **Surface** (`#ffffff` light / `#111114` dark): Cards, sticky headers, sidebar, inputs, and popovers.
- **Raised** (`#f4f4f5` light / `#18181b` dark): Table headers (`.ledger thead th`), row hover states, secondary buttons, disabled inputs.
- **Border & Control** (`#e4e4e7` / `#d4d4d8` light; `#27272a` / `#3f3f46` dark): 1px structural hairlines and input/outline borders.
- **Text Hierarchy** (`#09090b` primary, `#52525b` muted, `#71717a` faint light; `#fafafa`, `#a1a1aa`, `#71717a` dark).

### Named Rules
**The Chrome-Data Separation Rule.** Never reuse `--viz-1..4` chart colors for navigation chrome, and never use `--accent` teal as a generic chart series when `--viz-1..4` applies.

## Typography

**Display & Body Font:** `Geist` (`--font-geist-sans`, fallback `ui-sans-serif, system-ui, sans-serif`)
**Mono Font:** `Geist Mono` (`--font-geist-mono`, fallback `ui-monospace, monospace`)

**Character:** Clean geometric neo-grotesque paired with crisp monospace for NIK, case codes, coordinates, and SLA timers.

### Hierarchy
- **KPI** (`600`, `34px`, `line-height: 1.1`, `tabular-nums`): Dashboard summary metrics (`--fs-kpi`).
- **Title** (`600`, `20px` mobile / `24px` `md+`, `letter-spacing: -0.02em`): Sticky `PageHeader` titles (`--fs-title`).
- **Section** (`600`, `14px`): Panel and card section headings (`--fs-section`).
- **Body** (`400`, `14px`, `line-height: 1.5`): Default UI copy, table cells, and form labels (`--fs-body`).
- **Label / Small** (`500`, `12px`): Eyebrows, table headers, status pills (`11.5px`), and helper text (`--fs-small`).

### Named Rules
**The Tabular Ledger Rule.** Every table (`table`), numeric cell (`.ledger .num`), KPI, timestamp, and `[data-numeric]` element enforces `font-variant-numeric: tabular-nums`.

## Layout

Desktop (`md+`, `>= 768px`) locks the shell to `100dvh` (`md:fixed md:inset-0 md:flex-row md:gap-3 md:p-3`) with a collapsible sidebar (`248px` expanded / `68px` collapsed), `56px` top bar, and independently scrollable main pane with sticky `PageHeader` (`px-4 py-4 md:px-[24px]`).

Mobile (`< 768px`) switches to a natural vertical flow (`min-h-dvh flex-col`) with `MobileNav` header, `16px` horizontal gutters (`--gap`), and a fixed role-aware `MobileBottomDock` for one-thumb access to primary field actions.

## Elevation & Depth

Hybrid hairline-first elevation: structural separation relies primarily on `1px solid var(--border)` hairlines and subtle tonal shifts (`--ground` → `--surface` → `--raised`), reinforced by two Zinc-950-tinted shadow tiers:
- `--elev-soft`: `0 1px 2px rgb(9 9 11 / 0.04), 0 6px 20px -12px rgb(9 9 11 / 0.08)` (cards, `.surface` panels).
- `--elev-pop`: `0 2px 6px rgb(9 9 11 / 0.06), 0 20px 44px -16px rgb(9 9 11 / 0.16)` (toasts, popovers, skip-link, floating overlays).

## Shapes

- **Cards & Panels:** `14px` (`--radius-card`) with `1px solid var(--border)`.
- **Controls & Inputs:** `8px` (`--radius-control`) at `38px` standard height (`--control-height`).
- **Status Pills:** `999px` (`--radius-pill`) at `24px` height with a `6px` leading status dot.
- **Small / XL Accents:** `6px` (`--radius-sm`) and `18px` (`--radius-xl`).

## Components

### Buttons (`src/components/ui/button.tsx`)
- **Primary (`default`):** `--accent` background, `--accent-ink` text, `8px` radius, `13.5px` medium, `active:translate-y-px`, `focus-visible:ring-2 ring-ring/35`.
- **Outline / Secondary / Ghost / Destructive:** Hairline bordered (`--control` or `--border` or `--pill-negative-border`) with `--raised` or `--active` hover states.

### Cards & Panels (`src/components/ui/card.tsx`, `.surface`)
- **Corner Style:** `14px` (`--radius-card`).
- **Background & Border:** `--surface` with `1px solid var(--border)` and `--elev-soft`.
- **Internal Padding:** `16px` (`--spacing(4)` default) or `12px` (`size="sm"`).

### Inputs / Fields (`src/components/ui/input.tsx`)
- **Style:** `38px` height, `8px` radius, `1px solid var(--control)`, `--surface` background, `13.5px` text, `--faint` placeholder.
- **Focus & Error:** `focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/25`; `aria-invalid` shifts border and ring to `--negative`.

### Navigation (`Sidebar`, `TopBar`, `MobileNav`, `MobileBottomDock`)
- **Desktop:** `248px` / `68px` sidebar + `56px` top bar + `⌘K` command palette.
- **Mobile:** Top `MobileNav` drawer + bottom `MobileBottomDock` highlighting one role-specific primary action (`Lapor`, `Buat PE`, `Verifikasi`, `Admin`).

### Status Indicator (`StatusText`, `src/components/shell/status-text.tsx`)
- **Routine (`neutral`, `good`):** Calm `6px` dot + `12px` medium text (no tinted pill border) so routine states do not compete with SLA alerts.
- **Urgent (`warn`, `bad`):** `24px` height, `999px` radius, `1px` semantic border (`--pill-warning-*` / `--pill-negative-*`), `6px` dot, `12px` medium text.
<!-- 2026-11-25: "esekusi semua" (plan-revamp-dasbor.md) -->

### Clinical Ledger Table (`.ledger`, `src/app/globals.css`)
- **Style:** Sticky `36px` `--raised` header (strict 4px grid), `44px` body rows separated by `1px solid var(--rule)`, hover gated behind `@media (hover: hover) and (pointer: fine)` (`120ms ease`), right-aligned tabular `.num` cells.
<!-- 2026-11-25: "esekusi semua" (plan-revamp-dasbor.md) -->

## Learned Taste & Operational Standards

### Surfaces & Layout
- **Operational triage pages use Hybrid B+C (`ResizablePanelGroup` ~36% SLA queue | ~64% inline `ReportDossierContent`) with an opt-in `?view=map` command toggle; `RUMAH_SAKIT` stays on Variant B table + `SpringSheet` without the map toggle.**
  Why: keeps active cases and inline actions above the fold while reserving full-height Leaflet maps for geospatial workflows and avoiding redundant spatial queries.
  <!-- 2026-11-25: "esekusi semua" + "/learn-taste fix all and write all" -->
- **Never auto-select row 0 on list/triage routes; load patient PII (`getReport`) strictly opt-in when `?selected=<uuid>` is explicitly in the URL.**
  Why: preserves `READ_PII` audit trail integrity and prevents mobile `SpringSheet` from auto-opening on page load.
  <!-- 2026-11-25: "esekusi semua" (plan-revamp-dasbor.md) -->
- **One-page mobile-first command screens lock to `h-dvh` (`100dvh`) with bottom thumb-reachable navigation (`env(safe-area-inset-bottom)`), `SpringSheet` for secondary panels (`<lg`), and pan-locked Leaflet maps on coarse pointers until explicitly unlocked.**
  Why: prevents mobile browser chrome clipping, keeps primary navigation in thumb reach, and eliminates scroll-vs-map drag conflicts.
  <!-- 2026-11-25: "/mobile-native sesuaikan landing page one-page ini untuk viewport HP (iOS & Android)" -->

### Color & Signals
- **Use a 2px left SLA ribbon (`border-l-2` with `--negative`, `--warning`, `--accent`) plus monospaced `tabular-nums` countdown instead of full-fill colored SLA pills.**
  Why: separates urgent 24h/72h breaches cleanly without turning the queue into rainbow badge noise.
  <!-- 2026-11-25: "esekusi semua" (plan-revamp-dasbor.md) -->

### Motion & Interaction
- **Use compositor-only CSS transitions (`transform`, `opacity`, `clip-path`, color) with `--ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`) under `300ms`; never use `transition-all` or Motion `layoutId` on tabs.**
  Why: prevents main-thread frame drops during RSC/URL updates; tab indicators must snap in `0ms` (`data-instant="true"`) on keyboard navigation (`ArrowLeft`/`ArrowRight`/`Home`/`End`) and under `prefers-reduced-motion`.
  <!-- 2026-11-25: "esekusi semua" (Emil Kowalski motion polish) -->
- **Every tappable control uses immediate press feedback (`active:scale-[0.97]`, `150ms var(--ease-out)`); action buttons use subtle `opacity-70 blur-[1.5px]` crossfade while pending; all `:hover` effects are gated by `@media (hover: hover) and (pointer: fine)`.**
  Why: gives tactile response on pointer-down without sticky phantom hovers on touch devices.
  <!-- 2026-11-25: "/mobile-native" + "esekusi semua" -->
- **Mobile drawers and case-detail sheets always use `SpringSheet` (`src/components/ui/drawer.tsx`) with 1:1 drag tracking and velocity-based swipe-to-dismiss.**
  Why: native touch feel across `< 768px` viewports without custom drag jitter.
  <!-- 2026-11-25: "/gestures ubah panel detail kasus dan filter peta di dashboard baru menjadi drawer/sheet yang bisa di-drag" -->

### Copy & Resilience
- **Keep Indonesian UI copy in EYD V / KBBI standard (`antrean`, `Perdarahan`, `keberapa`, `antinyamuk`), never hardcode regional names or `119` where `branding.*` applies, and always guard long branding/URLs/emails with `min-w-0`, `[overflow-wrap:anywhere]`, `title` on `truncate`, and `onError` logo fallback.**
  Why: keeps white-label deployments resilient at `320px`, `1280×720`, and `200%` zoom without clipped CTAs or broken images.
  <!-- 2026-11-25: "/break-ui landing page & penulisan" + "/learn-taste fix all and write all" -->

## Do's and Don'ts

### Do:
- **Do** use CSS custom properties from `src/app/globals.css` (`--ground`, `--surface`, `--accent`, `--pill-*`) so light and dark themes stay synchronized.
- **Do** ensure every mobile workflow (case triage, rejection with notes, out-of-region forwarding, PE entry) works comfortably within `< 768px` viewports without horizontal page overflow or clipped actions.
- **Do** read portal branding (`APP_TITLE`, `INSTITUTION_NAME`, `APP_LOGO_URL`) from settings rather than hardcoding regional names or static logos.
- **Do** preserve `tabular-nums` on all clinical counts, NIKs, dates, and SLA timers.

### Don't:
- **Don't** follow legacy `design-system/wali-epi/MASTER.md` (Fira Sans/Code + `#0284C7` primary); `src/app/globals.css` and `src/app/layout.tsx` are the live source of truth.
- **Don't** use decorative gradients, pie charts, or structural emojis in clinical tables or triage cards.
- **Don't** rely on `animate-bounce` or global `0.01ms` reduced-motion kills that erase state-change feedback.
