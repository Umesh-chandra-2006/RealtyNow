# Incident Response & Runbook

**Status:** Draft — fill in the named owners/contacts before go-live. This closes the
"Monitoring & alerting / incident response — ABSENT" gap in the launch-readiness
scorecard.

---

## 1. Severity levels

| Severity | Definition | Response target | Channel |
|---|---|---|---|
| **SEV-1** | Full outage / data loss / active security breach | ≤ 15 min to respond | Phone + on-call page |
| **SEV-2** | Major degradation, e.g. payments failing, search down, DB overloaded | ≤ 1 h | On-call page + Slack |
| **SEV-3** | Minor degradation / isolated incidents | ≤ 1 business day | Slack |
| **SEV-4** | Low-risk / cosmetic | Optional | Ticket |

## 2. Monitoring & alert sources (to wire before launch)
- **App errors / front-end**: Sentry (init `VITE_SENTRY_DSN`) — error rate alerts.
- **Edge function / API**: metrics on `http_req_duration` & `http_req_failed`
  (mirror the k6 budgets: search p95<800ms, payment p95<1200ms, error<1-5%).
- **Uptime**: synthetic check on the SPA origin and `/rest/v1/health`-style probes.
- **Scheduled checks**: backup-verification cron (§5 of `BACKUP_DR.md`), secret
  scanner on CI.
- **Rate-limit alarms**: watch for sustained `429`/throttle spikes (abuse).

## 3. Roles & on-call (assign before launch)
- **On-call (1st responder)**: triage, initial mitigation.
- **Backup on-call**: coverage when primary is unavailable.
- **Escalation**: platform owner, then vendor (Supabase/Razorpay/Resend) support.

Fill in names/rotations here: ____________________

## 4. Response flow
1. **Detect** — monitor alert or user report.
2. **Confirm + assess** — severity via §1; check status page of dependencies
   (Supabase / Razorpay / Resend / FCM).
3. **Mitigate** — apply runbook step below for the suspected component; prefer
   **rollback** over long debugging.
4. **Communicate** — update the incident channel; notify leadership for SEV-1/2.
5. **Post-mortem** — record timeline, root cause, prevention (within 1 week).

## 5. Component runbooks (highest-risk first)

### 5.1 Payments failing (SEV-1/2)
- Check `payment-gateway` edge-function metrics + Razorpay status page.
- Verify `RAZORPAY_KEY_ID/SECRET` secrets are present and valid.
- Server-side amount/idempotency already enforced (Phase 0) — never accept
  client-controlled totals.
- If webhook issues: verify HMAC secret + order-total stored in DB.

### 5.2 Search slow / DB overload (SEV-2)
- Review `v_properties_search` query cost; confirm indexes (migration `0144`) are
  applied.
- Check for a runaway/missing index or a full-table `ILIKE` storm in `pg_stat_activity`.
- Mitigation: add indexes, push pagination/limit down, enable PG full-text if needed.

### 5.3 Auth/OTP (SEV-2)
- Verify MSG91 OTP provider secrets + rate limits.
- If mass failure, check Supabase auth status; OTP endpoints are rate-limited
  (Phase 1).

### 5.4 Static SPA outage (SEV-1)
- Re-deploy last-known-good image tag (see `BACKUP_DR.md` §3.4) — stateless, fast.

### 5.5 Email (SEV-3)
- Verify `RESEND_API_KEY` + sender domain; deliveries log to
  `notification_delivery_log` with `channel=email`.

### 5.6 Security incident / PII exposure (SEV-1, escalate)
- Contain (revoke keys / disable access), preserve evidence (DB/audit snapshots),
  invoke the incident process and legal per DPDP/GDPR breach-notification duties.

## 6. Contacts & escalation tree
| Role | Name | Phone / Slack | 
|---|---|---|
| On-call | | |
| Backup on-call | | |
| Platform owner | | |
| Supabase support | | |
| Razorpay support | | |
| Resend support | | |
