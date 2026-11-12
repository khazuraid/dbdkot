# APP SHEET — Achromatic ledger

seed 1411719201 · drawn 2026-11-11 · kind analytics · light

This is the style for this product. Adopt it whole and keep its move intact; everything the sheet does not fix comes from the
shared defaults in references/app-screens.md. Redraw only for a reason you can state (it contradicts the brand, or the product is
used in a way the style does not suit) and say why in your report. The values were measured on real product screens: use them
as given rather than rounding them towards your habits.

## 1. The style

The chrome holds no colour at all; money and counts are set in ink, the one chart hue marks the screen's main data element, and the only other hue is a small signal where a figure changed.

**The move:** No brand colour anywhere in the chrome: the one primary action is near-black (a grey pill, #e5e5e5, is the secondary), the main data element (today's series, the booked bars, the current period) takes the one chart hue, #1d5fbf, and everything else is drawn in ink with the comparison or the part after the cursor in grey, zero balances are set in grey, and the only hue on the screen is a small triangle or a short coloured number where a figure changed.

**Colour budget:** under 1% coloured pixels; the chrome is ink, the one chart hue goes on the main data element, and the only other hue is a small change signal.
**Off-style here:** a brand-coloured primary button; tinted cards or tinted KPI tiles; a coloured chart where one series in ink says it; bold on anything but money; a chart with no y-scale (the study's one example of this look hid magnitude behind hover and was flagged); a grey pill as the only button for the screen's main job: in testing an Approve repeated in grey on every row left the screen without a primary.
Distilled from 4 screens: a seller home, a per-agent insights page, a generated report, a settings page with usage numbers. The studied screens of this kind used 11-12px card radii, which §9.4 counts among the rare middle values; the library sets the tight pair (8 and 6) so the style lands on the bimodal rule. After testing, the chart hue moved from an unused third series colour onto the main data element: a screen whose only hue was a delta read as a kit.

**Its face.** Choose one of these (or one of your own of the same weight) before you build, write it in your notes next to
the screen's question, and check that it shows on the first screen. Without one the screen reads as a well-applied kit.

- A ground from the product's world in place of #f8f8f8, one level off white and low in chroma: a stone (#f4f3f1) for a bakery or a shop, a sage (#f2f5f2) for a garden or a greenhouse, a blue-grey (#f2f4f7) for a ledger or a meter. Cards stay white; a warm tint stays under the cream check (saturation under about 15%).
- The one chart hue (#1d5fbf, or the brand's own hue at 3:1 or more on white) on the screen's main data element: today's line, the booked bars, the current period's column, the margin that breaks. The chrome stays ink and the hue stays under 1% of the screen.
- Every figure in Geist Mono, as the style's decision, so money and counts read as a ledger's columns while the text stays Geist. Lint and the inspector flag mono; give the reason in the report.

## 2. Tokens

```css
:root {
    --ground: #f8f8f8;
    --surface: #ffffff;
    --raised: #eeeeee;
    --border: #e6e6e6;
    --rule: #f0f0f0;
    --control: #d4d4d4;
    --text: #0a0a0a;
    --muted: #6b6b6b;
    --accent: #141414;
    --positive: #2e7d32;
    --negative: #c4242a;
    --warning: #92400e;
    --chart-1: #141414;
    --chart-2: #8a8a8a;
    --chart-3: #1d5fbf;
    --pill-positive-bg: #dcfae5;
    --pill-positive-ink: #04250e;
    --pill-negative-bg: #ffedea;
    --pill-negative-ink: #831c1e;
    --pill-warning-bg: #fffbeb;
    --pill-warning-ink: #92400e;
    --pill-neutral-bg: #eeeeee;
    --pill-neutral-ink: #3d3d3d;
    --radius-card: 8px;
    --radius-control: 6px;
    --row-height: 44px;
    --sidebar-width: 256px;
    --gap: 12px;
    --pad: 24px;
    --control-height: 36px;
    --fs-title: 24px;
    --fs-section: 16px;
    --fs-kpi: 30px;
    --fs-body: 14px;
    --fs-small: 12px;
}
```

Density: sparse. One gap value, horizontally and vertically. No shadow on anything at rest.

## 3. Type — Geist

```html
<link rel="preconnect" href="https://fonts.googleapis.com" /><link
    rel="preconnect"
    href="https://fonts.gstatic.com"
    crossorigin
/>
<link
    href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;700&family=Geist+Mono:wght@400;500&display=swap"
    rel="stylesheet"
/>
```

`font-family: "Geist", Inter, system-ui, sans-serif`. Weights 400, 500, 700. Sizes: title 24px · section 16px · kpi 30px · body 14px · small 12px. 700 is for money figures only; every other number is 400-500. Second face: Geist Mono, for IDs and keys only.
Numbers: `font-variant-numeric: tabular-nums` on every table, KPI and anything that updates. Sentence case; no tracked capitals.

## 4. Shell — Icon rail

An unlabelled rail of 50-60px carries the brand mark at the top and 15-18px outline icons on a 34-49px pitch; groups are split by 20px hairlines, utilities sit at the bottom. The rail sits on the page ground with a 1px edge, or is white with a faint 4px shadow on a grey ground. It saves about 180px of width against a labelled sidebar, so it suits products with few destinations and screens that need the width. Icons need tooltips and an accessible name.
Numbers: railWidth 50-60, median 55; icon 15-18px outline; pitch 34-49; active icon colour alone, or a full-bleed 50px band at a 2% tint, or a 1px accent bar on the rail's border; groups short 20px hairlines, no labels; utilities pushed to the bottom after a gap of about 200px.
On a phone: The rail becomes a bottom bar with the same four or five icons, each with a short label under it.

## 5. Screens

### analytics — Per-period and running-total pairs

Title at 24-32px with one sentence under it saying what the filters do, then one filter row of 36-38px controls (one filled or near-black, the rest borderless or text, a reset link last) and 16-24px to the KPIs. KPI row: 3 equal cards in the content column (3 x 372 + 2 x 17 = 1152 in the study) or one divided container; a 16px label over the value with the change written as a phrase on the value's baseline ('+8 in the last 90 days'), grey when it is zero. Then one row per metric: the per-period column chart on the left and its cumulative line on the right, at equal width (2 x 568 + 16 = 1152) and with the same x ticks; square bars, a 2px straight line, integer ticks from zero, no legend because each chart has one series. One gap value horizontally and vertically.
On a phone: Pairs stack, the cumulative chart directly under its per-period chart; KPI cards become a single column of label-value rows.

### list

No pattern in the library for this screen. Compose it from the rules in references/app-screens.md.

### detail — Tabbed object detail in a sheet

Inside the sheet: a breadcrumb row at 16/600 (the parent in grey, the current page as the h1, a 24px grey type chip after it) with its actions on the right (a text button and an outlined 32px dropdown). Under it, the object's tabs at 14px with a 2px ink underline that runs 8px past the label, on a 1px rule that spans the sheet. 30px below, the filter row: a label above a 300x32 select on the left; the freshness stamp ('Last updated July 21, 2026') and a 40px refresh button on the right, centred on the select's line. Then 3 KPI cards (value 36/400, its label at 16/600 under it, the period in words) and 2 chart cards, all on one 24px gutter so the rows share column lines. Do not stretch a short card to its neighbour's height (it left 250px of dead white) and do not list legend series that have no data.
On a phone: Breadcrumb shortens to a back link and the h1; tabs scroll; KPI cards stack as label-value rows; charts full width.

## 6. Always

Real data for this product, written before the markup: names, amounts that add up, dates in order, units on every figure,
honest zeros and dashes. One chart answers one question. No gradients, glows, glass, icons in tinted squares, sparklines on KPIs,
rainbow charts, emoji, lorem or Acme. `<skill>/assets/app.css` and `<skill>/assets/charts.js` are a neutral start set to these
rules. Check with `node <skill>/scripts/lint.mjs <files>` and `node <skill>/scripts/inspect.mjs <page>`: this sheet switches both
to app rules.

Saved to /Users/fikri/Aplikasi/dbd/app-dbd/.taste-skill/direction.json · reprint with `node draw.mjs --show`
