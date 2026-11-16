---
name: رواق CRM
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#434655'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#4648d4'
  on-secondary: '#ffffff'
  secondary-container: '#6063ee'
  on-secondary-container: '#fffbff'
  tertiary: '#006242'
  on-tertiary: '#ffffff'
  tertiary-container: '#007d55'
  on-tertiary-container: '#bdffdb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-xl:
    fontFamily: Cairo
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg:
    fontFamily: Cairo
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Cairo
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Cairo
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  title-md:
    fontFamily: Cairo
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 22px
  title-sm:
    fontFamily: Cairo
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Cairo
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Cairo
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Cairo
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Cairo
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-md:
    fontFamily: Cairo
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Cairo
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
  metric-display:
    fontFamily: Cairo
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
  headline-xl-mobile:
    fontFamily: Cairo
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 30px
  headline-lg-mobile:
    fontFamily: Cairo
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 26px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-sm: 0.75rem
  gutter-lg: 1.5rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xxs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style

This design system defines a high-density, modern enterprise customer relationship management platform architected strictly for right-to-left (RTL) workflows. The visual identity embodies precision, operational clarity, and executive command. 

Targeting Arabic-speaking enterprise sales leaders, pipeline directors, and account managers, the interface strips away ornamental visual noise in favor of analytical clarity, high information density, and instant cognitive triage. The design language merges disciplined enterprise minimalism with subtle structural depth: ultra-crisp borders, calculated baseline alignment, and a utilitarian hierarchy that balances intense tabular data with human readability. Every screen communicates trust, institutional stability, and modern technological refinement.

## Colors

The color palette is engineered specifically for dense data interfaces, balancing pure structural neutrals with semantic alert anchors:

- **Primary Canvas & Surfaces:** The root background operates on an ultra-light slate `#F8FAFC`, while elevated workspaces, metric cards, and data grids sit on crisp pure white `#FFFFFF` cards. Structural separation is maintained by precise `#E2E8F0` hairline dividers.
- **Brand & Action Primaries:** The primary accent is `#2563EB`, driving principal interactive cues and focused actions, cascading down to `#1D4ED8` for active and pressed states. Deep secondary accents leverage `#6366F1` (Indigo) for predictive forecasting and AI-driven pipeline stages.
- **Typography & Content Hierarchy:** Text hierarchy defaults to deep Slate `#0F172A` for primary headlines, data values, and active table rows. Secondary context, micro-labels, and column titles employ Muted Slate `#64748B`.
- **Status & Semantic Matrix:** Status badges utilize low-saturation tinted surfaces combined with high-contrast foreground glyphs:
  - **Success (Closed Won / Healthy):** `#10B981` text over an `#ECFDF5` container.
  - **Warning (At Risk / Pending Stage):** `#F59E0B` text over a `#FFFBEB` container.
  - **Danger (Churned / Bottleneck):** `#F43F5E` text over a `#FFF1F2` container.
  - **Insight (AI Lead Score):** `#6366F1` text over an `#EEF2FF` container.

## Typography

The type system is anchored on **Cairo** (with `system-ui, -apple-system, sans-serif` fallback), optimized for dense Arabic typographic texture and tabular legibility. Arabic letterforms require intentional vertical breathing space due to ascenders and descenders; the type scale enforces precise line heights to prevent overlapping diacritics in dense enterprise grids.

- **Numerals:** Financial values, metrics, and timestamps utilize tabular numbers (`font-variant-numeric: tabular-nums`) to maintain vertical scanning alignment across rows.
- **Hierarchy:** High-level dashboards pair `headline-xl` (page titles) with `metric-display` for KPI callouts. Analytical column labels and metadata rely strictly on `label-sm` and `label-md` with `fontWeight: 500-600` to guarantee scan speed across complex CRM funnels.

## Layout & Spacing

The layout is built for native RTL spatial distribution, where visual weight, navigation hierarchies, and data progression begin from the right canvas edge and expand leftward.

- **Grid Architecture:** 
  - **Desktop (1280px+):** 12-column fluid grid, `1.5rem` margins, `1rem` gutters. Metric cards leverage standard 3-column spans (4 cards per row) or 4-column spans (3 cards per row).
  - **Tablet (768px - 1279px):** 8-column layout, `1rem` margins, `0.75rem` gutters. Metric cards wrap into 2x2 formations.
  - **Mobile (<768px):** 4-column single-axis stack, `1rem` margin, collapsing wide deal matrices into horizontal card decks.
- **Density Philosophy:** Compact 4px spatial base unit (`space-xs` = 4px, `space-sm` = 8px, `space-md` = 12px, `space-lg` = 16px). This compact spacing structure allows high data throughput without clutter, ensuring that enterprise tables can present up to 15 visible rows per standard viewport height.

## Elevation & Depth

This design system avoids exaggerated drop shadows, relying on a composite strategy of 1px structured borders and subtle ambient diffusion:

- **Base Layer (Level 0):** Background canvas `#F8FAFC`. Zero elevation, non-interactive foundation.
- **Card & Grid Layer (Level 1):** Solid `#FFFFFF` surfaces bounded by a crisp `1px solid #E2E8F0` border. Depth is reinforced with a faint ambient shadow: `box-shadow: 0 1px 2px 0 rgba(15, 23, 42, 0.04)`.
- **Flyout & Hover Layer (Level 2):** Quick-peek contact cards, interactive row hovers, and table sticky headers use an elevated edge: `box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`.
- **Modal & Drawer Layer (Level 3):** Right-side sliding detail sheets (RTL sliding from screen-right toward center) and contextual command palettes (`0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)`).

## Shapes

The design system adopts a disciplined soft geometry (`roundedness: 1`). Enterprise tools require structured box containment to maximize usable surface area inside high-density tables and Kanban columns.

- **Micro Components (0.25rem / 4px):** Badges, tag chips, checkboxes, table cell selectors, and nested KPI trend indicators.
- **Standard UI Elements (0.375rem - 0.5rem / 6px - 8px):** Input text boxes, dropdown triggers, buttons, and action bars.
- **Containers & Panels (0.5rem / 8px):** Metric summary cards, data grid wrappers, modal dialogues, and CRM pipeline swimlanes.
- **Circular (Full Pill):** Avatar initials, quick-action notification counters, and radial stage markers only.

## Components

### Buttons & Action Bars
- **Primary:** Background `#2563EB`, text `#FFFFFF`, 0.375rem border radius. Hover: `#1D4ED8`. Active: `#1E40AF`.
- **Secondary:** Surface `#FFFFFF`, border `1px solid #E2E8F0`, text `#0F172A`. Hover: `#F8FAFC`.
- **Tertiary / Ghost:** Borderless, text `#64748B`, hover background `#F1F5F9`.
- **RTL Icon Placement:** Leading action icons sit immediately to the right of text labels (`margin-left: 0.5rem`).

### Metric & KPI Cards
- Pure white `#FFFFFF` surface enclosed by `1px solid #E2E8F0` outline.
- **Top Row (RTL):** Metric label right-aligned in `label-md` (`#64748B`), with contextual icon or action dots left-aligned.
- **Middle Row:** High-contrast value in `metric-display` (`#0F172A`).
- **Footer Row:** Mini-sparkline or percentage change chip (`+14.2%` with `#10B981` text over `#ECFDF5` container) indicating trend trajectory compared to previous deal cycle.

### Data Grids & Lists
- **Header:** Sticky `#F8FAFC` row, `1px solid #E2E8F0` bottom boundary, `label-sm` uppercase-equivalent tracking in `#64748B`.
- **Cell Height:** 44px compact row density. Alternating row hovers render `#F8FAFC`.
- **Cell Content:** Text aligns strictly to the right. Numerical values use `tabular-nums` alignment. Selected rows render with a `2px solid #2563EB` border marker along the rightmost cell edge.

### Status Badges & Tag Chips
- Height: 22px; padding: `0 8px`; border-radius: 4px; font size: 11px; weight: 600.
- Semantic tint pairing:
  - **مكتملة (Won):** Text `#10B981`, Background `#ECFDF5`, Border `1px solid #A7F3D0`.
  - **مؤجلة (On Hold):** Text `#F59E0B`, Background `#FFFBEB`, Border `1px solid #FDE68A`.
  - **خسارة (Lost):** Text `#F43F5E`, Background `#FFF1F2`, Border `1px solid #FECDD3`.
  - **مؤهل (Qualified):** Text `#2563EB`, Background `#EFF6FF`, Border `1px solid #BFDBFE`.

### Input Fields & Select Menus
- Background `#FFFFFF`, border `1px solid #CBD5E1`, text `#0F172A`, inner padding: `0.5rem 0.75rem`.
- Focus state: Border `#2563EB`, outline ring `0 0 0 2px rgba(37, 99, 235, 0.15)`.
- Trailing icons, clear buttons, and calendar trigger icons are placed at the far left of the field to respect RTL input flow.

### Checkboxes & Radios
- Size: 16px x 16px with a 3px border radius for checkboxes and full circle for radios.
- Unchecked: `1px solid #CBD5E1` on `#FFFFFF`.
- Checked: Background `#2563EB` with `#FFFFFF` glyph; smooth scale transition.