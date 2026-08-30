# RealtyNow — Documentation Hub

This directory is the **single source of truth** for how RealtyNow is built, operated, secured, and launched. Files are grouped by audience; start with the map below.

> Maintainers: every new doc goes here (not the repository root). Keep the table below updated when you add or rename a document.

---

## 1. Reference Map

| Document | Purpose | Audience |
| --- | --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | High-level system design, technology stack, and structural overview. | All engineers |
| [DESIGN.md](./DESIGN.md) | Design system & UI architecture: color tokens, typography, spacing, responsive standards. | Frontend / UI |
| [COMPONENTS.md](./COMPONENTS.md) | Component architecture and shared component inventory. | Frontend |
| [DATABASE.md](./DATABASE.md) | Database schema specification (36 tables), RLS model, and data-flow rules. | Backend / DB |
| [API.md](./API.md) | REST/RPC/edge-function surface: endpoints, payloads, auth, rate limits. **Code-exact; “Last verified” stamped.** | Backend / Integrations |
| [DEPENDENCIES.md](./DEPENDENCIES.md) | Runtime/dev/Deno dependencies, version drift findings, `src/lib` module map. | All engineers |
| [DEVELOPMENT_GUIDELINES.md](./DEVELOPMENT_GUIDELINES.md) | Hard invariants, the four gates, branch/commit rules, review checklist. | All engineers / AI agents |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Netlify + Docker/Kubernetes deployment, secrets matrix, release workflow. | Eng / Ops |
| [MAINTENANCE.md](./MAINTENANCE.md) | How-to recipes: add migration/edge function/table/route/test, regenerate assets, docs-sync. | Maintainers / AI agents |
| [AI_FEATURES.md](./AI_FEATURES.md) | AI feature specification & roadmap; the no-fabrication search guarantee. | Product & Backend |
| [PRODUCT.md](./PRODUCT.md) | Product overview and functional requirements. | Product / Stakeholders |
| [SCREENS.md](./SCREENS.md) | Screen routing & page inventory across all four roles. | Frontend / QA |
| [PWA_ICON_SETUP.md](./PWA_ICON_SETUP.md) | How to regenerate PWA icons. | Frontend / Ops |
| [WALKTHROUGH.md](./WALKTHROUGH.md) | Agent-portal walkthrough: leads, customer details, notification integration. | Onboarding / Support |

## 2. Security & Governance

| Document | Purpose | Audience |
| --- | --- | --- |
| [DATA_GOVERNANCE.md](./DATA_GOVERNANCE.md) | Data governance & compliance (DPDP/GDPR alignment), erasure pipeline, privacy controls. | Security / Legal / Eng |
| [INCIDENT_RUNBOOK.md](./INCIDENT_RUNBOOK.md) | Incident response & severity runbook for on-call. | Ops / On-call |
| [BACKUP_DR.md](./BACKUP_DR.md) | Backup & disaster-recovery plan with documented RPO/RTO. | Ops / DBA |

## 3. Launch & Operations

| Document | Purpose | Audience |
| --- | --- | --- |
| [LAUNCH_GATE.md](./LAUNCH_GATE.md) | Launch-gate checklist (Phase 4) — everything that must pass before go-live. | Eng / Product / Ops |
| [LAUNCH_VERIFICATION_REPORT.md](./LAUNCH_VERIFICATION_REPORT.md) | Recorded verification evidence against the launch gate. | Eng leadership |
| [ADMIN_LOGIN_PLAN.md](./ADMIN_LOGIN_PLAN.md) | Admin login-flow redesign plan. | Backend / Security |

---

## 4. Where Else Things Live

| Concern | Location |
| --- | --- |
| **AI-agent entry point (tool-agnostic)** | [`AGENTS.md`](../AGENTS.md) |
| Working rules for AI coding agents (Claude-specific) | [`CLAUDE.md`](../CLAUDE.md) |
| Auto-generated inventories (API/RPC/deps/snapshot) | [`docs/generated/`](./generated/) — regenerate via `node scripts/docs-sync.mjs` |
| Quickstart, scripts, and structure | [`README.md`](../README.md) |
| One-off data repair / backfill scripts | [`scripts/repair/`](../scripts/repair/) |
| Ad-hoc SQL diagnostics | [`scripts/db/`](../scripts/db/) |
| Maintained tooling | [`scripts/`](../scripts/) |
| Load tests | [`k6/`](../k6/) |
| Kubernetes manifests | [`k8s/`](../k8s/) |
| Schema migrations & edge functions | [`supabase/migrations/`](../supabase/migrations/), [`supabase/functions/`](../supabase/functions/) |

---

## 5. Document Conventions

- One file per topic; **no loose docs at the repository root** (moved here in the structure cleanup).
- `docs/DESIGN.md` and `docs/ARCHITECTURE.md` are the two complementary design docs — DESIGN is the token/UI spec, ARCHITECTURE is the system overview.
- SQL diagnostics belong in `scripts/db/`, never in `docs/`.
- Any doc embedding real credentials is forbidden (secret scanner enforces).
- `docs/generated/` is **machine-generated** (`scripts/docs-sync.mjs`); CI fails on drift (`--check`). Edit the generator or the code, not the output.