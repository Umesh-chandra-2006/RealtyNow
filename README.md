# RealtyNow

**India's multi-role real-estate marketplace** — one product serving home buyers/sellers, agents, builders, and platform administrators through a single codebase.

RealtyNow is a full-stack web application built on **React 18 + Vite + TypeScript** with a **Supabase** backend (Postgres + Row Level Security, Auth, Storage, and 22 Deno edge functions) and a schema managed through **154 versioned SQL migrations**. It ships as a **PWA**, is localized for **10 Indian languages**, and is deployable to Netlify or as a container (`Docker` / Kubernetes) for high-availability operation.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security & Compliance](#security--compliance)
- [Documentation](#documentation)
- [License](#license)

---

## Features

| Area | Highlights |
| --- | --- |
| **Role-based portals** | Customer (`/portal/*`), Agent (`/agent/*`), Builder (`/builder/*`), Admin (`/admin/*`) — gated by row-level security and route guards. |
| **Property discovery** | Search & listing built on the `v_properties_search` Postgres view (published/live only, server-capped at 500 rows), advanced filters, saved/search agents and builders. |
| **Listing lifecycle** | `draft → submitted → published` approval pipeline with change requests, admin moderation, and SEO metadata generation. |
| **Monetization** | Paid subscriptions and advertising with **Razorpay** payments; server-verified amounts, webhook HMAC, and idempotent state transitions. |
| **AI assistance** | Floating AI assistant and AI hub that answer property-search questions **directly from the database** (never fabricated, RealtyNow-only results) and generate descriptions/SEO copy. |
| **PWA + push** | Installable, offline-capable app with Firebase Cloud Messaging notifications. |
| **i18n** | 10 Indian languages via i18next; user-facing strings go through the `t()` translator, never hardcoded. |
| **Privacy governance** | DPDP/GDPR-aligned data governance, PII redaction in public surfaces, and an on-demand account-erasure pipeline. |

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite 8, Tailwind CSS, React Router v7 (data router), TanStack Query |
| UI/UX | Framer Motion, Lucide icons, Embla carousels, Leaflet/react-leaflet maps, Recharts |
| Backend | Supabase: Postgres (RLS), Auth, Storage, Edge Functions (Deno, 22 functions) |
| Payments | Razorpay (webhooks, server-side amounts) |
| Messaging | Firebase Cloud Messaging, Resend (email), WhatsApp (pending provider) |
| AI | OpenRouter / AI-agent edge function with a deterministic database-backed fallback |
| Observability | Sentry |
| Ops | Docker, docker-compose, Kubernetes (deploy/HPA/service/kustomize), GitHub Actions (CI/CD + CDN) |
| Quality | Vitest, Playwright, ESLint, TypeScript, secret scanning |

---

## Architecture Overview

```
React SPA  ──►  Supabase
                 ├─ Postgres (RLS + 154 migrations)
                 ├─ Auth (email/OTP, 3-hr admin session expiry)
                 ├─ Edge Functions (22) — payments, AI, counters, moderation…
                 └─ Storage (images, uploads)
Netlify / Nginx (PWA + static assets)
Docker / Kubernetes (containerized web tier, autoscaling)
```

- **Client** uses a single Supabase client (`src/lib/supabase.ts`) and reads search data only through the published-only `v_properties_search` view — never the raw `properties` table for search/listings.
- **Privileged operations** (admin moderation, payments, subscription activation) are server-side in edge functions or `SECURITY DEFINER`-scoped RPCs, never in browser code.
- **Entering code?** Read [CLAUDE.md](./CLAUDE.md) first for working rules, the role-based routing map, data-layer conventions, and AI-feature guarantees.

---

## Getting Started

Prerequisites:

- Node.js **20+**
- Supabase CLI (for local Supabase + edge functions)
- A Supabase project (local or hosted)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# fill in your Supabase URL + anon key (and Razorpay/AI keys as needed)

# 3. Start the dev server
npm run dev                # http://localhost:5173

# 4. (Recommended) Run the quality gates before committing
npm run typecheck && npm test && npm run lint:ci
```

---

## Environment Variables

See `.env.example` for the full list. Minimum required:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (safe for the client) |
| `VITE_SENTRY_DSN` | Error tracking (leave empty for dev) |
| `RESEND_API_KEY` / `VITE_AI_API_KEY` / payment keys | Provider integration (server/deploy only — never commit) |

> **Never commit real keys.** A pre-commit hook and CI step (`scripts/scan-secrets.mjs`) block new known-leaked or high-entropy secrets; see [Security & Compliance](#security--compliance).

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server on `http://localhost:5173` |
| `npm run build` | Optimize images → production build → deploy manifest |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | TypeScript (`tsc --noEmit -p tsconfig.app.json`) |
| `npm run lint` | ESLint |
| `npm run lint:ci` | ESLint with a warning budget (`--max-warnings 244`) |
| `npm test` | Vitest unit/regression suite (7 files / 64 tests) |
| `npm run e2e` | Playwright end-to-end specs (`e2e/`) |
| `npm run generate-icons` | Regenerate PWA icons from source assets |
| `npm run images` | Optimize images for production (sharp) |

Supabase utilities (via the Supabase CLI): edge functions live in `supabase/functions/*/index.ts` and schema in `supabase/migrations/*.sql`. DB diagnostics live in `scripts/db/` and one-off maintenance scripts in `scripts/repair/`.

---

## Project Structure

```
├── src/                    # React application
│   ├── components/         # Shared UI + dashboard layout
│   ├── contexts/           # Auth, language, admin session…
│   ├── hooks/
│   ├── lib/                # Supabase client, services, utils, i18n
│   ├── locales/            # 10 language locale packs
│   ├── pages/              # Public + portal (customer/agent/builder/admin) routes
│   ├── test/               # Vitest setup
│   ├── App.tsx             # Role-based routing tree
│   └── main.tsx
├── e2e/                    # Playwright specs (auth, routing, crawler)
├── supabase/
│   ├── functions/          # 22 Deno edge functions
│   ├── migrations/         # 154 versioned SQL migrations
│   └── config.toml
├── scripts/                # Maintained tooling (optimize-images, scan-secrets…)
│   ├── db/                 # Ad-hoc SQL diagnostics
│   └── repair/             # One-off data repair/backfill scripts
├── reports/                # Generated lint/report dumps
├── docs/                   # Professional documentation (see hub)
├── k6/                     # Load-test scripts
├── k8s/                    # Kubernetes manifests (web tier)
├── public/                 # Static assets, PWA icons
└── scratch/                # Ignored dev sandbox (never committed content)
```

---

## Testing

| Suite | Tool | Where |
| --- | --- | --- |
| Unit / regression | Vitest (jsdom) | `src/**/*.test.ts`, e.g. `src/lib/__tests__/` |
| End-to-end | Playwright | `e2e/*.spec.ts` (auto-starts dev server) |
| Lint | ESLint | whole repo, warning-budget enforced in CI |
| Secret scanning | `scripts/scan-secrets.mjs` | CI + pre-commit hook (blocks known-leaked / high-entropy secrets) |

```bash
npm test                          # run unit suite
npx vitest run path/to/file.test.ts
npm run lint:ci
npm run e2e
node scripts/scan-secrets.mjs
```

CI (`ci.yml`) gates on typecheck, lint, tests, and secret scan; release is automated to containers with a rollback path.

---

## Deployment

### Netlify
`netlify.toml` + `public/_redirects` configure the SPA build, caching, and immutable assets. Deploy with `netlify deploy --prod` after `npm run build`.

### Containers / Kubernetes
- `Dockerfile` — non-root, read-only-rootfs-compatible image (logs to stdout).
- `docker-compose.yml` — single-container local/production preview.
- `k8s/` — deployment, HPA autoscaling, service, namespace, kustomization.
- `.github/workflows/release.yml` — build → GHCR → `kubectl` with rollback.

Production domains: `https://www.realtynow.in` (NDC allowed — see `scripts/` CORS allow-list).

---

## Security & Compliance

- **Row Level Security** on all application tables; role-column changes restricted for normal users.
- **Redacted public surfaces** — no PII/phone columns in public search output (365-degree verified).
- **Server-verified billing** — webhook HMAC, amount matching, idempotent and refund-safe transitions, server-side discounts.
- **Rate limiting** on auth, OTP, payments, AI, maps, and counter endpoints (per IP/user).
- **Secret scanning** in CI + pre-commit; rotate-and-purge policy for any leaked credential.
- **DPDP / GDPR** data-governance design — see `docs/DATA_GOVERNANCE.md`.

---

## Documentation

A professional documentation set lives in [`docs/`](./docs/README.md) — architecture, database schema, API surface, design system, data governance, backup/DR, incident runbooks, launch gates, AI roadmap, and screen inventory. Start at the [Documentation Hub](./docs/README.md).

---

## License

Private / proprietary. No public license is granted.