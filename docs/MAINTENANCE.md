# RealtyNow — Maintenance Playbook

“How do I update <X>?” — concrete, correct recipes for the routine maintenance a future maintainer (or AI agent) performs. Modules first, then data, then tooling.

---

## 1. Add or change a database migration

```bash
# 1. New file, next sequence number (append-only — never edit an applied migration)
supabase/migrations/YYYYMMDDHHMMSS_0155_<slug>.sql
```

1. Include `CREATE TABLE`/`ALTER`, **and its RLS policies in the same file** (every app table has RLS enabled).
2. For new function privileges, mirror the hardening pattern:
   ```sql
   REVOKE ALL ON FUNCTION public.my_fn(...) FROM PUBLIC;
   GRANT EXECUTE ON FUNCTION public.my_fn(...) TO anon, authenticated, service_role;
   ```
3. If it changes the API surface (functions/views/RPCs/tables), run `node scripts/docs-sync.mjs` and commit the regenerated `docs/generated/*`.
4. Apply locally: `supabase db reset` (or `supabase migration up`), then verify with `npm test` and a smoke query via `scripts/db/` if relevant.

## 2. Add an edge function

```bash
supabase functions new <name>   # scaffolds supabase/functions/<name>/index.ts
```

1. Follow the house pattern: `getCorsHeaders(req)` from `../_shared/cors.ts`, OPTIONS preflight, generic `fail()` messages (detail to `console.error`), rate limit via `_shared/rate-limit.ts` where abuse-prone.
2. Admin-gated functions: implement `resolveAdmin(req, supabase)` exactly like `admin-customers`/`admin-security` (Bearer JWT → `auth.getUser()` → `profiles.role ∈ {admin,super_admin}` + `status = active`), then service-role writes.
3. Deploy: `supabase functions deploy <name> --project-ref <ref>`.
4. Update `docs/API.md` deep-dive + “Last verified”; run `node scripts/docs-sync.mjs` (adds it to the generated inventory automatically).

## 3. Add a table used by the client

1. Migration with table + RLS + grants (see #1).
2. Add typed access in `src/lib/` (thin service near its concern) using the single `supabase` client (`src/lib/supabase.ts`).
3. If it's a public listing/search surface — it must go through `v_properties_search`, not the raw table.
4. Run docs-sync (the `.from('tbl')` scan picks it up) and commit regenerated docs.

## 4. Add a page / route

1. Components under `src/pages/` + shared UI from `src/components/`.
2. Register in the data router in `src/App.tsx`, nested under `PublicRoute` or `ProtectedRoute allowRoles={[...]}` per role.
3. User-facing strings via i18next — add keys to `src/lib/i18n/` **and** locale packs for all 10 languages (`src/locales/`). Run `npm run build` to ensure no missing-key breakage.
4. Record it in `docs/SCREENS.md`.

## 5. Add a test

- Unit/regression: `src/lib/__tests__/<module>.test.ts` (Vitest + Testing Library). Cover the invariant (e.g., published-only queries).
- E2E: `e2e/<flow>.spec.ts` (Playwright; dev server auto-starts on :5173).
- Then: `npm test` / `npx playwright test e2e/<spec>.ts`.

## 6. Regenerate PWA icons / optimized images

```bash
npm run images           # sharp-based: writes public/optimized/ (gitignored), used by build & netlify caching
npm run generate-icons   # regenerates PWA icons in public/ from source assets (scripts/generate-pwa-icons.js)
```

## 7. Device / data maintenance scripts

| Task | Location |
| --- | --- |
| One-off data repairs / backfills | `scripts/repair/*.cjs` (see file headers; some embed keys — treat as scratch) |
| Ad-hoc SQL diagnostics | `scripts/db/*.sql` — copy to a new file, never edit shared ones |
| Image optimization | `scripts/optimize-images.mjs` |
| Secret scanning | `scripts/scan-secrets.mjs` (+ pre-commit hook in `scripts/githooks/`) |
| Load testing | `k6/load-search.js`, `k6/load-payment.js` (never commit tokens/results — gitignored) |

## 8. Keep the documentation honest

All inventory docs (`api-inventory.md`, `dependencies.md`, `.snapshot.json`) are generated:

```bash
node scripts/docs-sync.mjs          # regenerate
node scripts/docs-sync.mjs --check  # CI gate — fails on drift
```

After any surface change:
1. Bump the “Last verified” date in `docs/API.md` if you edited a deep-dive.
2. Update the relevant curated doc (`docs/DEPENDENCIES.md`, `docs/DATABASE.md`, `docs/ADMIN_LOGIN_PLAN.md`, etc.).
3. Regenerate + commit `docs/generated/*`.

## 9. Ops cadence (see the operations plan)

- **Weekly:** secret scan pass, dependency review (`docs/generated/dependencies.md` drift — consolidate Deno versions), Sentinel/Sentry check.
- **Pre-launch:** rotate the legacy secrets & purge history; populate Sentry/Resend/WhatsApp/Razorpay keys; DR restore drill; refund live-test; k6 right-sizing; CDN/WAF.
- Details and owners: the Operational Hardening Plan (audit folder) / `docs/LAUNCH_GATE.md` / `docs/INCIDENT_RUNBOOK.md` / `docs/BACKUP_DR.md`.