# RealtyNow — Development Guidelines & Code-Editing Rules

Rules for anyone (human or AI) writing code in this repository. If you break one of the **hard invariants**, the change is wrong regardless of tests.

---

## 1. Hard invariants (never violate)

1. **Never commit real credentials.** `scripts/scan-secrets.mjs` blocks known-leaked / high-entropy secrets in pre-commit and CI. No `.env` values, keys, JWTs, or admin hashes in source; migration 0060/0068 contain legacy secrets pending rotation — do not add more.
2. **Public search reads only `v_properties_search`.** Never query raw `properties` for public search/listings. The view enforces the published/live boundary and redacts PII (phones are `NULL`). See `src/lib/properties.ts`.
3. **Billing truth is server-side.** Payment webhooks verify HMAC + amount; discounts are computed server-side; `discount` payloads from the client are ignored. Never trust a client-supplied price/discount/status.
4. **Privileged operations live server-side.** Admin moderation, subscription activation, and payout actions happen in edge functions or scoped RPCs — behind a verified `profiles.role ∈ {admin, super_admin}` check, never in browser code.
5. **AI answers for property-search questions come from the database** (`v_properties_search`), RealtyNow-only, never fabricated — both in `src/lib/ai.ts` and the `ai-assistant` edge function.
6. **No user-facing English hardcoding.** All user-facing copy goes through i18next (`t()`); add strings to `src/lib/i18n/` and locale packs.
7. **One Supabase client.** Import `supabase` from `src/lib/supabase.ts`. Don't construct instances ad hoc in components.

---

## 2. The four gates (run before every commit)

```bash
npm run typecheck      # TypeScript — must be 0 errors
npm test               # Vitest — all tests green
npm run lint:ci        # ESLint with warning budget (244) — no NEW warnings
node scripts/scan-secrets.mjs   # no known-leaked / high-entropy secrets
node scripts/docs-sync.mjs --check   # if you changed server surface/DB, docs must match
```

CI enforces all of these on push/PR.

---

## 3. Working conventions

### Where things live (abridged)
- Client UI: `src/pages/`, `src/components/` (public routes vs `/portal|agent|builder|admin/*`).
- Data services: `src/lib/*.ts` (thin wrappers around the one Supabase client).
- Edge functions: `supabase/functions/<name>/index.ts` (Deno; `npm:`/`jsr:`/`esm.sh` specifiers are normal; no Node types).
- Schema: `supabase/migrations/NNNN_*.sql` — **append-only**, never edit an applied migration.
- Tests: `src/**/*.test.ts` next to the module; E2E in `e2e/`.

### Code style
- Lean on existing shared components (`dashboard-layout.tsx`, `StatCard`, `PageHeader`) instead of duplicating dashboard chrome.
- Match the design tokens in `docs/DESIGN.md` / `docs/ARCHITECTURE.md` (brand red `#b61f24`, navy neutrals, Plus Jakarta Sans + Inter) — no ad hoc Tailwind colors.
- TypeScript everywhere; keep `tsconfig.app.json` strict-passing.
- No new dev-dependency without a purpose in `docs/DEPENDENCIES.md` (and keep it in the generated matrix).
- Edge functions: use `_shared/cors.ts` (`getCorsHeaders(req)`), `_shared/rate-limit.ts`, `_shared/phone.ts`; return generic error strings; log detail server-side. Do not hand-roll per-function CORS wildcards.

### Authorization pattern (edge functions)
1. Read `Authorization: Bearer <jwt>`; verify with `supabase.auth.getUser()`.
2. Load the caller's `profiles` row; check `role` **and** `status = active` per call (never cache trust across requests).
3. Only then use the service-role client for writes. New admin functions must mirror `admin-customers`/`admin-security` `resolveAdmin` — including `super_admin` where applicable.
4. Never infer trust from “client is logged in” alone.

### Database changes
- New table/column → new migration + RLS policies in the **same** migration, with an explicit `REVOKE ... FROM PUBLIC` where needed.
- Role-changing logic must use `auth.uid()`, never run as `postgres`/definer without a guard (see 0141).
- After editing anything the docs inventory tracks (functions, tables, RPCs, deps): run `node scripts/docs-sync.mjs` and commit the regenerated `docs/generated/*`.

---

## 4. Commit & branch conventions

- Branch names: `fix/<slug>`, `feat/<slug>`, `chore/<slug>`, `security/<slug>`.
- One concern per commit; run the four gates first. Message format follows existing history (e.g., `A3-fix: ...`, `Phase 4 fix: ...`) — imperative, concise, no filler.
- **Never commit** `dist/`, `node_modules/`, `playwright-report/`, `test-results/`, `reports/`, `.env*`, scratch content (they're gitignored).
- Pre-commit githook (`.githooks/`) runs the secret scan; keep it wired via `git config core.hooksPath`.

---

## 5. Review checklist

- [ ] Gates green (typecheck, tests, lint:ci, secret scan, docs-sync).
- [ ] No secrets, no `.env` values, no admin hashes.
- [ ] Public search still view-only; PII still redacted.
- [ ] Billing paths still server-verified (HMAC/amount/state).
- [ ] Admin function added? → role + active status check + `super_admin` where needed.
- [ ] i18n: no hardcoded user-facing English.
- [ ] Docs inventory regenerated if the API/DB surface changed.
- [ ] Edge-function change? → `docs/API.md` deep-dive + “Last verified” bumped.