# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Token-Efficient Working RulesQ

- Minimize token usage.
- Read only files required for the current task.
- Never scan the entire repository unless explicitly requested.
- Do not reread files already inspected unless necessary.
- Make the smallest possible change.
- Preserve existing architecture and functionality.
- Do not refactor unrelated code.
- Do not generate documentation unless requested.
- Avoid lengthy explanations.
- Do not provide full code in chat after editing files.
- After completing a task, respond with:
  1. Changed files
  2. One-line result
- Ask questions only when implementation is genuinely blocked.

## Commands

```bash
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build         # Type-checks are NOT run automatically — run `typecheck` separately
npm run typecheck     # tsc --noEmit -p tsconfig.app.json
npm run lint           # eslint .
npm run preview        # Preview the production build
```

Testing is wired up via npm scripts — run the full unit suite or single files:

```bash
npm test                               # vitest run — unit tests (jsdom; config: vitest.config.ts, setup: src/test/setup.ts)
npx vitest run path/to/file.test.ts    # Single unit-test file
npm run lint:ci                        # eslint . --max-warnings 244 — fails on new warnings above the current baseline
npm run e2e                            # Playwright E2E in e2e/ (auto-starts `npm run dev` on :5173)
npx playwright test e2e/auth.spec.ts   # Single E2E spec
```

Tests live under `src/` (currently 7 unit test files / 64 tests) plus the vitest setup (`src/test/setup.ts`); E2E specs live in `e2e/`. The CI quality job also runs `node scripts/scan-secrets.mjs` after install and fails on new known-leaked/high-entropy secrets. Add unit tests next to the module they cover, or under `src/lib/__tests__/`.

Supabase is managed via the CLI against migrations in `supabase/migrations/` and edge functions in `supabase/functions/*/index.ts` (Deno runtime — do not expect Node types/imports to resolve there; `npm:`/`jsr:` specifiers are normal).

## Architecture

**Stack**: React 18 + Vite + TypeScript, Tailwind CSS, React Router v7 (data router via `createBrowserRouter`), Tanstack Query, Supabase (Postgres + Auth + Storage + Edge Functions), i18next, Framer Motion, Leaflet/react-leaflet for maps.

### Role-based routing (`src/App.tsx`)

Every route is nested under a single `RootLayout` (error boundary + global floating widgets: `AIAssistant`, `CompareFloatingPanel`, `PwaInstallPrompt`). Two route families branch from there:

- **Public routes** (`PublicRoute`) — wrapped in `PublicLayout`, lazy-loaded, no auth required.
- **Protected routes** (`ProtectedRoute allowRoles={[...]}`) — gate on `useAuth()` from `src/lib/auth.tsx` and redirect to the correct dashboard home if the user's `profile.role` isn't allowed. Four roles exist (`src/lib/types.ts`: `UserRole`): `customer` (`/portal/*`), `agent` (`/agent/*`), `builder` (`/builder/*`), `admin` (`/admin/*`). Admin sessions additionally self-expire after 3 hours via `localStorage['adminSessionStart']`.

All four dashboard areas (portal/agent/builder/admin) share `src/components/dashboard-layout.tsx` (`DashboardLayout`, `PageHeader`, `StatCard`) rather than duplicating chrome — check there first before adding new dashboard UI patterns.

### Data layer

- `src/lib/supabase.ts` — the single Supabase client instance; import `supabase` from here everywhere.
- `src/lib/properties.ts` — the property search/query service. `buildPublishedQuery`/`fetchPublishedProperties` read from the `v_properties_search` Postgres view (joins `properties` with `cities`, `localities`, `property_types`, `builders`, `projects`, and owner/agent profiles, plus a concatenated `search_text` column used for free-text `ilike` search). Status filtering for "live" listings is `status.eq.published OR is_live.eq.true` — reuse this helper rather than querying `properties` directly for search/listing UIs. Mutations (approve/reject/assign/resubmit) go through Postgres RPCs (`admin_approve_property`, etc.), not raw updates, because they also write `property_status_history`.
- Property lifecycle status (`PropertyStatus` in `src/lib/types.ts`) flows through an approval pipeline: `draft → submitted/pending_verification → published` (or `rejected`/`changes_requested`, with `customer_resubmit_property` looping back).
- Full schema reference lives in `docs/DATABASE.md` (36 tables) and `docs/API.md` (REST/RPC/edge function surface) — consult these before guessing column names instead of grepping migrations.

### AI features (`src/lib/ai.ts`)

Single entry point `callAI(task, payload)` used by every AI-driven UI (`ai-assistant.tsx` floating widget, `pages/public/ai-hub.tsx`, description/SEO generators, etc.). Resolution order per call:
1. If `VITE_AI_API_KEY`/`VITE_OPENROUTER_API_KEY` is set client-side, call OpenRouter directly with a task-specific system/user prompt from `getSystemAndUserPrompt`.
2. Otherwise POST to the Supabase edge function at `functions/v1/ai-agent` (note: the deployed function directory is actually `supabase/functions/ai-assistant`, and `src/lib/supabase.ts` separately exports `AI_FUNCTION_URL` pointing at `.../ai-assistant` — these three don't currently agree; check which path is actually live before assuming server-side AI calls succeed).
3. Otherwise fall back to a deterministic canned response (`fallbackAIResponse`) so the UI never dead-ends.

The `chat` task intercepts property-search-shaped messages (BHK/locality/city/buy-rent phrasing) and answers them **directly from `v_properties_search`**, bypassing the LLM entirely, specifically so results can never be fabricated or reference non-RealtyNow platforms — see `isPropertySearchIntent`/`answerRealtyNowPropertySearch` in `ai.ts`. Any change to chat behavior must preserve this RealtyNow-only, no-fabrication guarantee (mirrored in the edge function's own `chat` system prompt). Planned/unimplemented AI phases are tracked in `docs/AI_FEATURES.md`.

### i18n

`src/lib/i18n/` (i18next + `language-context.tsx`) drives all user-facing copy across 10 languages; the active language code is persisted in `localStorage['realtynow_language']`. AI prompts append a "respond entirely in `<language>`" instruction based on this, and non-AI strings use the `t()` translator — don't hardcode new user-facing English strings.

### Brand/design system

`docs/ARCHITECTURE.md` and `docs/DESIGN.md` define the token system (brand red `#b61f24`, navy neutrals, specific shadow/radius/gradient scales, Plus Jakarta Sans + Inter). Match these instead of introducing ad hoc Tailwind colors when building UI.
