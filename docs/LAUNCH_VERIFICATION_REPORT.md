# Launch Gate Verification Report — Phase 4

**Date:** 30 August 2026
**Scope:** Full re-verification of every remediation phase and each automated gate
before go-live, per `docs/LAUNCH_GATE.md`.
**Method:** Re-ran all gates against the committed tree; inspected the Phase 4
deliverables (ops docs, CI/CD, k8s manifests).

---

## 1. Automated gates — all PASS

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | ✅ exit 0 |
| Lint (CI, regression guard) | `npm run lint:ci` (`eslint . --max-warnings 244`) | ✅ exit 0 — 0 errors, 244 warnings (existing baseline, no new) |
| Unit tests | `npx vitest run` | ✅ 6 files / 61 tests passed |
| Build | `npm run build` (image optimization + vite) | ✅ exit 0, built in ~33 s |
| Secret scan | `node scripts/scan-secrets.mjs` | ✅ pass — no new known-leaked / high-entropy secrets (pre-existing WARNs in migrations `0060`/`0068` remain until key rotation + history purge) |

## 2. Phase 4 deliverables — verified present

| Deliverable | File(s) | Status |
|---|---|---|
| Backup/DR with RPO & RTO | `docs/BACKUP_DR.md` | ✅ drafted (PITR + nightly, RPO≤24h / RTO≤4h targets, restore runbook) |
| Incident response runbook | `docs/INCIDENT_RUNBOOK.md` | ✅ drafted (SEV levels, alerts, on-call template, per-component runbooks) |
| Consolidated launch gate | `docs/LAUNCH_GATE.md` | ✅ drafted (go/no-go with environment/people actions separated) |
| CI hardened | `.github/workflows/ci.yml` + `lint:ci` script | ✅ lint `--max-warnings`; e2e job wired (runs when a test backend is provisioned; non-blocking otherwise) |
| CD with rollback | `.github/workflows/release.yml` | ✅ image build/push to GHCR + `kubectl set image` + `rollout undo` on failure |
| Container prod manifests | `k8s/` (namespace, deployment, service, hpa, kustomization, README) | ✅ 2–8 replicas autoscaling, probes match Dockerfile, hardened securityContext |

## 3. Remaining obligations (the deployment-side `[ ]` — NOT code)

These cannot be executed from this repo; they are the go/no-go conditions in
`docs/LAUNCH_GATE.md` and **must** be completed before broad launch:

1. Rotate/revoke exposed secrets (anon + service_role, Mapbox, MSG91, Firebase) and
   purge git history of migrations `0060`/`0068`; regenerate seeded admin passwords.
2. Provision and run the k6 load tests against the deployed env; confirm budgets
   (search p95<800ms/<1% err; payment p95<1200ms/<5% err); right-size DB/concurrency.
3. Set live secrets (`RESEND_API_KEY`/`EMAIL_FROM`, Razorpay, Sentry DSN) and
   configure real CDN for static assets.
4. Staff on-call + DR owner; fill runbook contacts; run a **DR restore drill**.
5. E2E: provision a test Supabase backend + set `E2E_*` secrets to enable the e2e job.

## 4. Gate verdict

**CODE: GO.** All engineering deliverables across Phases 0–4 are present and every
automated gate is green. Launch readiness is now limited solely by the environment/
people actions in §3 (secret rotation, load-test run, secret/email/CDN provisioning,
backup drill, on-call staffing) — those are operationally required but outside the
codebase.

Signature / owner: ____________________

## 5. Post-report correction (container path) — 30 Aug 2026

Follow-up review found the container **securityContext did not match the base image**:
`k8s/deployment.yaml` demanded `runAsNonRoot: true` + `readOnlyRootFilesystem: true` +
`capabilities.drop: [ALL]`, but the stock `nginx:1.27-alpine` image runs the master as
**root** on **port 80** and writes to `/var/cache` — the pod would crash-loop and never
pass probes. Fixed (hardening, not relaxation):

- `nginx.conf` → full main config: `listen 8080` (unprivileged), `pid`/temp paths under
  `/tmp`, log to stderr, immutable-cache strategy preserved.
- `Dockerfile` → serve as `USER 101:101`, `COPY nginx.conf` as primary config,
  `EXPOSE 8080`, healthcheck on `:8080`.
- `k8s/deployment.yaml` → `containerPort: 8080`, probes on `:8080`, writable `emptyDir`
  at `/tmp`, `runAsUser/runAsGroup: 101` (matches image USER) alongside the existing
  non-root/read-only/cap-drop constraints.
- `docker-compose.yml` → `8080:8080`, healthcheck on `:8080`; `k8s/README.md` documents
  the non-root runtime model.

The container now satisfies its own hardening constraints. **Re-verify with a real
`docker build`/`docker run` and a k8s (kind/minikube) apply before go-live.**

