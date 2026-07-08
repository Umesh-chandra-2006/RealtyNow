---
name: RealtyNow
description: Premium Real Estate Portal inspired by Editorial Luxury.
colors:
  primary: "#8B0000"
  neutral-bg: "#F8FAFC"
  neutral-fg: "#0F172A"
  secondary: "#0A1128"
  accent: "#8B0000"
  muted: "#64748B"
  border: "#E2E8F0"
  destructive: "#DC2626"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(2.2rem, 6vw, 4.5rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "#700000"
  card:
    backgroundColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "12px 16px"
---

# Design System: RealtyNow

## 1. Overview & Identity
RealtyNow implements a highly curated, premium look inspired by modern editorial luxury real estate. The design focuses on rich crimson accents against dark navy slate backdrops and clean white listing layouts. 

The user interface balances elegant serif display headers with a structured layout, generous negative space, and clear, functional search widgets to evoke high confidence, trust, and luxury.

---

## 2. Color Palette & Rules
* **Crimson Red (`#8B0000`)**: Action accents, CTA buttons, active tabs, and primary action links. Never used for general copy.
* **Navy Slate (`#0A1128`)**: Background for hero sections, headers, visual breaks, and footers.
* **Ice Slate Background (`#F8FAFC`)**: General viewport background for property card grids.
* **Pure White (`#FFFFFF`)**: Card surfaces, search inputs, and listing details.
* **Charcoal Ink (`#0F172A`)**: General primary text and body copy.

---

## 3. Dark Theme Ambient Elements
For pages with high editorial value (such as Services index, Careers, Press, and legal audits), we use ambient dark styling overlays:
* **Aurora Blurs (`.aurora-glow`)**: Absolutely positioned container blurs with low opacity (10%-15%) crimson and navy glows to create depth in the backdrop.
* **Sheen Hover Cards (`.sheen-glow`)**: CSS linear gradient background shines that slide across card surfaces on user hover actions.
* **Gradient Borders (`.gradient-border`)**: Translucent border styles utilizing CSS linear gradients to accent cards seamlessly.

---

## 4. Typography Rules
* **The Serif Ground Rule**: All displays, titles, and section headers (`H1`, `H2`, `H3`) use `Playfair Display` to reinforce the architectural, luxury aesthetic.
* **The Legibility Rule**: All metadata, numbers, forms, labels, and listing details use `Inter` for clean readability.
