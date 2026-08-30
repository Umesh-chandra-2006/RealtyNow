# RealtyNow — Dependencies & Modules

> The exhaustive, generated matrices (every package with version range + every file that imports it, Deno externals per edge function, `src/lib` module list) are in **`docs/generated/dependencies.md`** — produced by `scripts/docs-sync.mjs` from the code itself. This file adds the curated *purpose* layer and the drift findings that matter for maintainers.

## 1. Runtime dependencies (client)

| Package | Purpose | Where you'll find it |
| --- | --- | --- |
| `@sentry/react` | Error / performance monitoring | `src/lib/sentry.ts`, `main.tsx` |
| `@supabase/supabase-js` | Single Supabase client (auth, REST, storage, RPC) | `src/lib/supabase.ts` (single instance), all data services |
| `@supabase/auth-ui-react` / `-shared` | Auth form primitives | `src/components/auth/` |
| `@tanstack/react-query` | Server-state cache / data fetching | `src/lib/queryClient.ts`, every data hook |
| `axios` | HTTP client (map/geo, misc) | `src/lib/google-location-service.ts`, `src/lib/googleMaps.ts` |
| `dompurify` | Sanitize rendered HTML (saved/rich content) | `src/lib/` (sanitization helper) |
| `firebase` | Cloud Messaging (push) | `src/lib/firebase.ts`, `src/lib/push.ts` |
| `framer-motion` | Animations / transitions | everywhere in components |
| `html-to-image`, `html2pdf.js`, `xlsx` | Export/share/downloads (image, PDF, Excel) | share services, admin exports |
| `i18next` + `react-i18next` + detectors/backends | 10-language localization | `src/lib/i18n/`, `src/locales/` |
| `leaflet` / `react-leaflet` / `@types/leaflet` | Maps | map components |
| `lucide-react` | Icon set | all components |
| `papaparse` | CSV parsing | bulk-import flows |
| `qrcode.react`, `recharts` | QR codes, charts | admin/agent dashboards |
| `react-router-dom` | Routing (v7 data router) | `src/App.tsx` |
| `react-hook-form` + `@hookform/resolvers` + `zod` | Forms + validation | all forms |
| `react-helmet-async` | SEO meta tags | pages |
| `date-fns`, `clsx`, `embla-carousel-*`, `@floating-ui/react`, `rollup` | Utilities, carousels, popovers | utilities/components |

## 2. Dev dependencies

| Package | Purpose | Where |
| --- | --- | --- |
| `typescript`, `vite`, `@vitejs/plugin-react` | Build toolchain | `vite.config.ts`, `tsconfig*.json` |
| `vitest`, `jsdom`, `@testing-library/*`, `@types/dompurify` | Unit/regression tests (64 tests) | `src/**/*.test.ts` |
| `@playwright/test` | E2E (3 specs) | `e2e/` |
| `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-plugin-unused-imports`, `typescript-eslint`, `globals`, `prettier` | Lint/format | `eslint.config.js`, `.prettierrc` |
| `tailwindcss`, `postcss`, `autoprefixer` | Styling | `tailwind.config.js`, `postcss.config.js` |
| `sharp` | Image optimization pipeline | `scripts/optimize-images.mjs` |
| `@tanstack/react-query-devtools` | Dev query inspector | dev only |
| `@types/google.maps`, `@types/papaparse`, `@types/react`, `@types/react-dom` | Type defs | typecheck |

## 3. Deno externals (edge functions) — ⚠️ version drift

These are imported directly in edge-function code, **not** managed by `package.json`. The scan surfaced inconsistent versions:

| Specifier | Used by | Recommendation |
| --- | --- | --- |
| `npm:@supabase/supabase-js@2.57.4` | 9 functions | Canonical — prefer everywhere |
| `https://esm.sh/@supabase/supabase-js@2` / `@2.21.0` / `@2.39.0` / `@2.45.4` | `get-map-config`, `otp-auth`, `payment-gateway`, `process-application`, `process-renewals`, `property-workflow`, `send-push`, `txn-invoice-services`, `upload-profile-photo` | ⚠️ **Consolidate to one pinned version** (follow-up task) |
| `https://deno.land/std@0.168.0/http/server.ts` (5 fns) vs `@0.177.0` (3 fns) | mixed `serve` imports | ⚠️ Pick one std version |
| `https://deno.land/std@0.168.0/node/crypto.ts` | `payment-gateway`, `txn-invoice-services` (HMAC) | Keep pinned to HMAC implementation |
| `npm:bcryptjs@2.4.3` | `admin-security` | Keep (pin) |

## 4. Internal module map

### `src/lib/` (60+ modules — canonical listing generated)

| Group | Modules |
| --- | --- |
| **Auth/session** | `auth.tsx`, `admin-auth.ts`, `supabase.ts`, `sentry.ts` |
| **Properties/listings** | `properties.ts` (search via `v_properties_search`), `property-images.ts`, `profile-photo.ts`, `listing-drafts.ts`, `listing-limits.ts`, `listing-config.ts` |
| **Search** | `search-engine.ts` (`SEARCH_HARD_CAP=500`), `search-service.ts`, `search-analytics.ts`, `saved-filters.ts` |
| **Ads/monetization** | `advertisements.ts`, `paid-campaigns-api.ts`, `subscriptions.ts`, `featured-properties-api.ts`, `rewards/referrals` (`create_referral` etc.) |
| **Payments/billing** | `payment/` helpers used by checkout; server truth is edge functions |
| **AI** | `ai.ts` (single `callAI` entry; no-fabrication search answers) |
| **Maps/geo** | `geo-coordinates.ts`, `googleMaps.ts`, `google-location-service.ts`, `location-service.ts`, `indian-cities.ts`, `indian-location-data.ts` |
| **i18n** | `i18n/` dir |
| **Realtime/state** | `realtime.ts` (canonical), `realtimeManager.ts` (unused vestige), `queryClient.ts`, `ttl-cache.ts`, `scroll-restoration.ts` |
| **Validation/format** | `phone.ts` (canonical Indian mobile normalization), `validation.ts`, `price-validation.ts`, `plot-pricing.ts`, `utils.ts`, `types.ts`, `join-helpers.ts`, `indian-cities.ts` |
| **Per-role domain** | `role-crm-api.ts`, `builder-audit.ts`, `bulk-import-jobs.ts`, `bulk-import-payload.ts`, `crm` helpers, `support.ts`, `favorites.ts`, `compare.ts`, `shares.ts` / `share-service.ts`, `service-status.ts` |
| **Integrations** | `firebase.ts`, `push.ts`, `msg91.ts`, `elevenlabs.ts`, `realtime/server` types, `enterprise-types.ts`, `featured-properties-api.ts` |

### `supabase/functions/_shared/` (edge-function helpers)

`cors.ts` (allow-list CORS), `rate-limit.ts`, `phone.ts`, `admin-auth.ts` (authorized admin mobiles), plus small `json/fail` helpers per function.

### Only-touch-if-you-know rules

- **Never** add a second Supabase client — import from `src/lib/supabase.ts`.
- **Never** bypass `v_properties_search` for public search/listings.
- Phone handling goes through `phone.ts` (`normalizeIndianMobile`) / `_shared/phone.ts`.
- Client-facing copy goes through i18next — no hardcoded user-facing strings.