# RealtyNow - Design System & Architecture

## Overview
RealtyNow is a modern, responsive real estate web application built with React, Vite, and Tailwind CSS. The design emphasizes a premium, trust-building aesthetic with a vibrant brand red, deep navy neutrals, and clean typography. The UI is designed to be dynamic and engaging with subtle micro-animations and smooth page transitions.

## Technology Stack
- **Framework:** React 18, Vite
- **Styling:** Tailwind CSS, Framer Motion (Animations)
- **Icons:** Lucide React
- **Data & Auth:** Supabase (`@supabase/supabase-js`, `@supabase/auth-ui-react`)
- **Forms & Validation:** React Hook Form, Zod
- **Maps:** Leaflet, React Leaflet
- **Internationalization:** i18next
- **State Management & Data Fetching:** Tanstack React Query
- **Routing:** React Router DOM
- **Charts:** Recharts

## Brand Identity & Colors

The color palette is designed to be striking, professional, and accessible.

### Primary (Brand Red)
The core brand color represents energy, action, and premium real estate.
- **Primary / 600:** `#b61f24` (Main Brand Color - Buttons, Highlights)
- **Primary / 500:** `#d93b3f`
- **Primary / 700:** `#991a1e` (Hover states)
- **Primary / 950:** `#3d080a`

### Secondary (Navy / Charcoal)
Used for backgrounds, text, and structural elements.
- **Navy / 900:** `#18181b` (Dark text, headers)
- **Navy / 700:** `#3f3f46` (Subtext)
- **Navy / 50:** `#fafafa` (App background)

### Feedback & Status Colors
- **Success:** `#22b558` (Green)
- **Warning:** `#f58318` (Orange)
- **Error:** `#ef4444` (Red)

## Typography

- **Display Font:** `Plus Jakarta Sans` - Used for primary headings (h1, h2), hero sections, and key statistics to give a premium, geometric feel.
- **Body Font:** `Inter` - Used for body text, UI elements, and descriptions for maximum readability.

## Shadows & Elevation

The application uses a refined shadow system to create depth and hierarchy, moving away from flat design:
- **Card Shadow:** `0 1px 2px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)`
- **Card Hover:** `0 8px 32px rgba(0,0,0,0.12)`
- **Red Glow (Brand Elevation):** `0 8px 24px rgba(182,31,36,0.32)` (Used on primary CTA buttons)
- **Nav/Header:** `0 6px 24px rgba(0,0,0,0.08)`
- **Glassmorphism:** `0 8px 32px rgba(0,0,0,0.08)`

## Gradients & Backgrounds

- **Hero Gradient:** `linear-gradient(135deg, #b61f24 0%, #991a1e 60%, #7f181c 100%)`
- **Hero Radial:** Subtle radial glow for emphasis `radial-gradient(ellipse at 60% 40%, rgba(255,160,162,0.18) 0%, transparent 65%)`
- **Card Shine:** Glassy overlay `linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)`

## Border Radii

Rounded corners are generous to create a friendly, modern feel:
- **xl:** `0.875rem` (14px) - Buttons, small cards, inputs
- **2xl:** `1.125rem` (18px) - Standard property cards, modals
- **3xl:** `1.5rem` (24px) - Large sections, hero images
- **4xl:** `2rem` (32px) - Feature blocks

## Animations & Motion

Framer Motion and Tailwind keyframes are used heavily to bring the interface to life.
- **Fade In:** `fade-in 0.5s ease-out`
- **Fade Up / Right:** `fade-up 0.6s ease-out`
- **Scale In:** `scale-in 0.3s ease-out` (Used on card hovers and image reveals)
- **Floating / Shimmer:** For skeleton loaders and dynamic background elements.
- **Count Up:** Used for statistics and metrics to create an engaging data presentation.

## Layout & Structure

- **Responsive:** Mobile-first design using standard Tailwind breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`).
- **Dark Mode:** Supported via Tailwind's `class` strategy.

## Iconography
- **Library:** Lucide React
- **Usage:** Consistent stroke width (usually 2px) and sizes (16px for inline, 20px for buttons, 24px for features).
