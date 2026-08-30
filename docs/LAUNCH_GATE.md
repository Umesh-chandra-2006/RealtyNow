# Launch Gate Checklist — Phase 4

The consolidated go/no-go gate. Each line maps to a remediation phase and the
launch-readiness scorecard. `[x]` = done and verified in this repo; `[ ]` = an
**environment action** (requires a deployed project, credentials, or a person),
which the code work has prepared but cannot be executed from this repo.

---

## Phase 0 — Blockers (security & billing)
- [x] Access control / role isolation (customers can never become admins).
- [x] Payments verified server-side; order totals stored in DB; discounts not
      client-controlled.
- [x] PII redacted from public search (`v_properties_search`, phone fields dropped).
- [x] Search cannot leak unpublished/private listings.
- [x] Admin/profile-upload/push/AI endpoints fail closed.
- [ ] **Rotate + revoke exposed secrets** (anon + service_role, Mapbox, MSG91,
      Firebase) and purge git history of migrations `0060`/`0068`
      (`git filter-repo`). [REQUIRED — environment action]
- [ ] Regenerate admin passwords for the `0068` seeded accounts.

## Phase 1 — Rate limiting, observability, auth hardening
- [x] Rate limiting on auth / AI / payment / push edge functions.
- [x] OTP throttle + server-side lockout.
- [x] Test foundation (61 unit tests), CI workflow.
- [ ] **Provision Sentry / APM + alert thresholds** (runbook `docs/INCIDENT_RUNBOOK.md`). 

## Phase 2 — Scale & delivery
- [x] DB-side index/query fixes (migration `0144`) + pagination pushed down.
- [x] Image pipeline (sharp AVIF/WebP) + responsive src-set (`src/lib/images.ts`).
- [x] Dockerfile + nginx + compose; CDN cache headers (`netlify.toml`, `web.config`).
- [ ] **Put static assets behind a real CDN** (Cloudflare/CloudFront) + cache purge
      on deploy. [environment action]
- [ ] **Right-size managed DB and edge-function worker concurrency** after the load
      test. [environment action]

## Phase 3 — Operations & compliance
- [x] Transactional email via Resend (`_shared/email.ts`), honest invoice + notification
      channels.
- [x] Data-governance doc (`docs/DATA_GOVERNANCE.md`) — DPDP-2023/GDPR aligned.
- [x] Self-service erasure (`fn_request_account_erasure`, migrations `0146`/`0147`,
      portal danger-zone UI) + FK-violation fallback.
- [x] Legal pages routed (privacy, terms, cookie, refund, listing policy).
- [ ] **Set `RESEND_API_KEY`/`EMAIL_FROM` secrets** and verify launch domain.
      [environment action]
- [ ] **Run `k6/load-search.js` + `k6/load-payment.js`** against the deployed env and
      confirm budgets (search p95<800ms/<1% err; payment p95<1200ms/<5% err).
      [environment action]

## Phase 4 — Launch gate (this phase)
- [x] Pre-launch ops docs: `BACKUP_DR.md` (RPO/RTO), `INCIDENT_RUNBOOK.md`.
- [x] Harden CI/CD: e2e in CI, lint `--max-warnings`, deploy workflow w/ rollback.
- [x] Container prod manifests (`k8s/` deployment + service + HPA).
- [x] Full gate re-verification (typecheck, lint, vitest, build, secret scan) + this doc.
- [ ] **Staff on-call + DR owner; run a DR restore drill; fill runbook contacts.**
      [people action]

---

## Go / No-Go summary
Count the unchecked items above. **Do not go live** until every `[ ]` (environment/
people action) that touches security, payments, or data (secret rotation, backup
drill, on-call) is complete and the k6 budgets pass. The codebase is launch-ready;
these are the deployment-side obligations the repo cannot perform for you.
