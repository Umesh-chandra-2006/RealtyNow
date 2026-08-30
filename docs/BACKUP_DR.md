# Backup & Disaster Recovery (RPO / RTO)

**Status:** Draft — operational plan. **Not legal advice.** Owned by the platform
owner; assign a named DR owner and test the restore procedure before launch.

This document defines what to back up, how often, and the recovery-time / recovery
point objectives (RTO / RPO) RealtyNow targets. It closes the
"Backups / disaster recovery — UNVERIFIED" gap in the launch-readiness scorecard.

---

## 1. Assets & where they live

| Asset | Host | Recovery mechanism |
|---|---|---|
| PostgreSQL data (app schema, RLS, profiles, listings, payments, `auth.users`) | Supabase (managed Postgres) | Supabase **daily back-ups** (managed, PITR on paid plans) |
| Object storage (property images, avatars, docs) | Supabase Storage / S3-compatible | Storage replication/bucket versioning + export |
| Edge functions (Deno) + migrations | Git repo (`supabase/`) | Re-deploy from source; config via `supabase/config.toml` |
| Static SPA bundle (`dist/`) | Container image (Docker/nginx) | Immutable image, re-deploy from registry |
| Config / env | Vault / CI secrets (never in git) | Managed secrets; documented in `.env.example` (inert placeholders only) |

## 2. Backup frequency & retention (targets)

| Data | Frequency | Retention | Notes |
|---|---|---|---|
| Postgres (app) | Daily full backup + continuous PITR (paid) | ≥ 7–30 days rolling | Verify a restore at least monthly |
| Auth/identity (`auth.users`) | Included in the above | Same | Tied to erasure: `fn_request_account_erasure` deletes here |
| Storage objects | Daily incremental / bucket versioning | ≥ 7 days + snapshot on content-edit | Restore-tested before launch |
| Static bundle | Every deploy = new immutable image | Last N image tags | Nothing to \"back up\" beyond the container registry |
| Env secrets | Vault exporters / config snapshots | Rotated + versioned | Never commit plaintext |

**Objectives (recommend/discuss with stakeholders):**
- **RPO**: ≤ 24 h (daily backup) — tighten to minutes if you enable continuous PITR.
- **RTO**: ≤ 4 h for app availability; ≤ 24 h for full data restore determination.

These are defaults — agree the exact RPO/RTO with the business owner and record it
here before relying on them.

## 3. Restore procedure (runbook)

### 3.1 Supabase Postgres
1. From Supabase dashboard → Database → Backups, select the restore point (daily or
   PITR timestamp).
2. Restore to a **new** project/instance first; validate before pointing traffic.
3. Run `scripts/scan-secrets.mjs`-safe config re-apply; re-set edge-function secrets.

### 3.2 Storage
1. Restore buckets from the object-store backup/versioning.
2. Verify image URLs resolve against the SPA (`images`/`cover_image_url` columns).

### 3.3 Edge functions & migrations
1. `supabase link` to the restored/blank project.
2. `supabase db push` (migrations are append-only; replays cleanly).
3. `supabase functions deploy` from `supabase/functions`.

### 3.4 Static SPA
1. Re-deploy the last-known-good container image tag (or rebuild from `main`).

## 4. DR / failover & registry
- Supabase handles DB HA for the managed region. Document the chosen region and a
  cross-region decision (cost vs. RPO).
- The load-balanced nginx deployment (see `k8s/`) provides stateless web HA — a
  failed pod/instance is replaced by the autoscaler; no local state.

## 5. Pre-launch checklist
- [ ] Enable paid PITR + storage versioning; document chosen region.
- [ ] Perform and **document a real restore drill** (DB + storage) — record time taken.
- [ ] Confirm RPO/RTO with stakeholders; record them in §2.
- [ ] Assign a DR owner and a communication tree in `INCIDENT_RUNBOOK.md`.
- [ ] Add a scheduled (cron) backup-verification check that asserts the last backup
      succeeded and alerts on failure.
