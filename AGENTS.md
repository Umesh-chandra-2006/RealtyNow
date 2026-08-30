# AGENTS.md — AI Agent Guide for the RealtyNow Repository

This file is the entry point for any AI coding agent working in this repository (opencode, Cursor, Claude Code, Copilot, etc.). `CLAUDE.md` holds the Claude-specific working rules; this file is tool-agnostic and covers the whole system.

Read this file first. Then read `CLAUDE.md` for ground rules, and the concrete module maps in `docs/`.

---

## What this project is

RealtyNow — a multi-role Indian real-estate marketplace (customers, agents, builders, admins).

- **Client:** React 18 + TypeScript + Vite 8, Tailwind, React Router v7 (data router), TanStack Query, i18next (10 languages), PWA + FCM push, Leaflet maps, Framer Motion, Sentry.
- **Backend:** Supabase — Postgres with **Row Level Security** (154 migrations), Auth, Storage, and **21 Deno edge functions** (`supabase/functions/*/index.ts`). Razorpay payments. AI via OpenRouter + a database-backed deterministic path.

## Repository map (top level)

| Path | Contents |
| --- | --- |
| `src/` | React SPA: `pages/`, `components/`, `lib/` (services), `locales/`, `contexts/` |
| `supabase/functions/` | Deno edge functions + `_shared/` helpers (CORS, rate limit, phone, admin-auth) |
| `supabase/migrations/` | Append-only SQL migrations (0001→0150) — never edit applied ones |
| `e2e/`, `src/**/*.test.ts` | Playwright + Vitest suites |
| `docs/` | The documentation hub (see `docs/README.md`) |
| `scripts/` | Tooling: `docs-sync.mjs`, `scan-secrets.mjs`, `optimize-images.mjs`, `db/`, `repair/` |
| `k8s/`, `Dockerfile`, `netlify.toml`, `.github/workflows/` | Deployment |

## Commands (run these before any commit)

```bash
npm run dev                     # dev server :5173
npm run typecheck               # tsc — must be 0 errors
npm test                        # Vitest (64 tests)
npm run lint:ci                 # eslint with warning budget — no NEW warnings
npm run build                   # production build (+ image optimization)
npm run e2e                     # Playwright (needs E2E backend)
node scripts/scan-secrets.mjs   # secret scanner — CI + pre-commit
node scripts/docs-sync.mjs --check   # CI gate: docs must match code surface
```

## Hard invariants (do not "fix" these away)

1. **No real secrets/keys in code** — scanner blocks them. `.env*`, `dist/`, `reports/`, `playwright-report/`, `test-results/` are gitignored.
2. **Public search reads only `v_properties_search`** — the redacted, published/live-only view. Never query raw `properties` for public search. Phones are `NULL` there by design.
3. **Billing is server-verified** — webhook HMAC + amount + state; client-supplied discounts ignored.
4. **Privileged ops are server-side** behind a verified `profiles.role ∈ {admin, super_admin}` + active check.
5. **AI must never fabricate** — property-search chats answer from the database, RealtyNow-only.
6. **No hardcoded user-facing English** — go through i18next; all 10 locales in `src/locales/`.
7. **One Supabase client** — `src/lib/supabase.ts`.

## Conventions to follow

- Data layer: properties/search via `v_properties_search`; mutations via RPC handlers (`admin_approve_property` etc.) which also write history.
- Edge functions: `_shared/cors.ts` (`getCorsHeaders`), `_shared/rate-limit.ts`, generic error strings, detail only in server logs. Multi-action functions switch on the **`x-action`** header.
- Design: match tokens in `docs/DESIGN.md` / `docs/ARCHITECTURE.md` (brand red `#b61f24`, navy neutrals, Plus Jakarta Sans + Inter).
- Doc discipline: after changing the API/DB/dependency surface, run `node scripts/docs-sync.mjs` and commit the regenerated `docs/generated/*`; bump “Last verified” in `docs/API.md` for edited deep-dives.

## Where to look (do not guess from names)

| Need | Read first |
| --- | --- |
| API surface / edge functions / RPCs | `docs/API.md` + `docs/generated/api-inventory.md` |
| Dependencies & module map | `docs/DEPENDENCIES.md` + `docs/generated/dependencies.md` |
| Schema & RLS | `docs/DATABASE.md` (schema) + migrations with `::` names |
| Editing rules | `docs/DEVELOPMENT_GUIDELINES.md`, `CLAUDE.md` |
| Deployment | `docs/DEPLOYMENT.md`, `k8s/README.md`, `.github/workflows/release.yml` |
| How-to recipes | `docs/MAINTENANCE.md` |
| AI features & guarantees | `docs/AI_FEATURES.md` |

## Verification loop for agents

1. Make the smallest change; mimic existing patterns; no unrelated refactors.
2. Run the four gates (typecheck, tests, lint:ci, secret scan) + `docs-sync --check`.
3. If you touched an edge function, re-verify payload/response against `docs/API.md`.
4. Summarize changed files + one-line result when done.