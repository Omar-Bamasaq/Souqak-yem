# Design System – Suqaq Marketplace

## 1. Color System
- Brand (primary):
  - brand.500 `#0b89ed` – primary actions
  - brand.600 `#0846fe` – hover/active
  - brand.700 `#0526a3` – emphasis text/icons
- Accent (secondary highlights):
  - accent.500 `#e11d48` – badges, highlights
- Surface neutrals:
  - surface.50 `#f7f8fb` – page background
- States:
  - success.600, warning.600, danger.600 with light .50 backgrounds for badges

## 2. Typography
- Family: Tajawal (RTL-first), fallback system sans
- Scale (Tailwind text):
  - Title: text-3xl (hero), text-2xl (section)
  - Body: text-sm default, text-xs for meta
  - Emphasis: font-extrabold for prices/titles

## 3. Spacing & Radii
- Spacing: 4/8/12/16/20/24 px (Tailwind utilities)
- Radii:
  - rounded-xl (14px), rounded-2xl (18px)
- Shadows:
  - card: subtle multi-shadow for elevation

## 4. Buttons
- Base: `.ds-btn`
- Primary: `.ds-btn-primary`
- Secondary: `.ds-btn-secondary`
- Outline: `.ds-btn-outline`
- Danger: `.ds-btn-danger`
- Sizes: `.ds-btn-sm`, `.ds-btn-lg`

## 5. Cards & Sections
- Cards:
  - `.ds-card` – compact
  - `.ds-card-lg` – spacious
  - `.ds-section` – content blocks

## 6. Inputs
- `.ds-input`, `.ds-select` with brand focus-ring

## 7. Badges
- `.ds-badge-*` variants: info/success/warning/danger/brand

## 8. Micro-interactions
- Hover lift: `.y-hover`
- Hero gradient: `.y-hero`
- Price/featured chips: `.y-chip` or `.ds-badge-brand`

## 9. Skeletons & Empty States
- `.ds-skeleton`, `.ds-skeleton-line`, `.ds-skeleton-thumb`
- Empty state: centered `ds-card-lg` with neutral copy

## 10. Usage
- Prefer utility-first Tailwind with these component classes for consistency.
- Avoid inline colors; rely on brand/accent and ds- classes.

This system is designed for scalability across web and mobile (CSS variables mirrored in :root for cross-platform theming).
