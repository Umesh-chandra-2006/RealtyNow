# Data Governance & Compliance (DPDP / GDPR alignment)

**Status:** Draft — internal engineering/compliance reference. **Not legal advice.**
Review with a qualified privacy/DPO before reliance. User-facing summaries live in
`src/pages/public/privacy-policy.tsx` (and `cookie-policy.tsx`, `terms-and-conditions.tsx`).

This document maps what RealtyNow collects, where it lives, how long it is kept,
how consent is managed, and how erasure works — so the engineering team and any
reviewer can verify DPDP Act 2023 (India) and GDPR alignment against the real schema.

---

## 1. Legal basis & scope

- **Indian DPDP Act, 2023** — primary jurisdiction; RealtyNow processes Indian
  personal data (obtained). Consent-based for most processing; legal-obligation /
  legitimate-interest for payments, fraud prevention, and security.
- **GDPR** — applies to EU/EEA users if/when offered. This doc flags GDPR-specific
  duties where they differ (e.g. Data Protection Officer, EEA representative,
  EU data-transfer safeguards).
- Roles: RealtyNow is a **Data Fiduciary** (processor of user data); users are
  **Data Principals**. Third parties (Razorpay, Resend, Firebase, Supabase, MSG91,
  Google) are **Data Processors**.

## 2. Data inventory (what we collect & where it lives)

| Category | Fields | Primary store(s) |
|---|---|---|
| Identity | name, email, phone, avatar | `auth.users`, `profiles` |
| Account/role | role, status, agent_id | `profiles` |
| Listings | property data incl. owner/contact details | `properties`, `property_images`, `property_documents` |
| Enquiries/leads | contact form submissions | `enquiries` |
| Payments | Razorpay order/payment refs, invoice data | `txn_payments`, `txn_invoices` |
| Notifications | in-app + push + email delivery | `notifications`, `notification_delivery_log`, `push_tokens` |
| Support | tickets, messages | support tables (tickets) |
| Device/push | FCM tokens | `push_tokens` |
| Analytics/views | property view counts, search activity | `property_views`, search logs |
| PII NOT exposed | mobile/owner phones | **removed from anon-visible `v_properties_search` (Phase 0.4)** |

> **PII-redaction verification (Phase 0.4):** `listed_by_mobile`/`owner_phone` are
> dropped/null in the public search view and `security_invoker = on` is set, so
> anonymous search responses contain no phone fields. Confirm by removing
> `administrator`/`owner` from the view's applicable roles in the newest migration.

### Client-side avoided data
Hardcoded admin phone numbers are removed from client code (`src/lib/admin-auth.ts`,
`DEFAULT_ADMIN_PHONES` is empty) — admin enumeration data is server-side only.

## 3. Consent management

- **Explicit consent** required for: marketing/updates, push notifications, data
  sharing for targeted use.
- Consent storage: consent choices are recorded in the user's profile / consent
  fields and configurable from the account settings UI.
- **Withdrawal:** user can withdraw consent (turn off marketing/push) at any time.
  Marketing/push dispatch should re-check consent before sending.

## 4. Data retention

| Data | Retention | Driver |
|---|---|---|
| Account/profile | Until account deletion (or inactivity dormancy policy) | Service delivery |
| Payment records | Legal/statutory period (e.g. tax/audit, typically 5–8 yr in India) | Legal obligation |
| Invoices | Same as payments | Legal obligation |
| Enquiries/leads | Reasonable period for follow-up; purge on request | Legitimate interest |
| Property listings | Until delisted/deleted by owner/admin | Service |
| Push tokens | Live until `is_active=false` (auto-deactivated on FCM not-found) | Service |
| Notification delivery logs | Rolling retention; prune after a set period | Ops |
| Search/analytics logs | Aggregated/anonymised; raw PII not retained beyond need | Analytics |

## 5. Right-to-erasure / deletion flow (current mechanism)

- `profiles.id` is `REFERENCES auth.users(id) ON DELETE CASCADE`, and related rows
  (`properties`, `enquiries`, `notification`, `txn_*`, `push_tokens`) use cascade
  where appropriate. **Deleting the `auth.users` row is the erasure primitive.**
- An admin/service-role deletion of `auth.users` should cascade to the principal's
  personal data. Verify each child FK is `ON DELETE CASCADE` (or handled explicitly)
  before relying on this in production.
- Exceptions that may be *retained* after erasure: financial/tax records required by
  law (anonymised where possible), and audit/fraud-prevention logs.

**TODO (implement before public launch):**
- [ ] Add a self-service "Request account deletion" / "Request data copy (portability)"
      flow in the portal (admin-verified), or at minimum a documented manual DPIA path.
- [ ] Add an RPC `fn_delete_my_account()` that, for the calling `auth.uid()`, hard-
      deletes personal rows and the `auth.users` row within the same transaction.
- [ ] Retention/pruning job for `notification_delivery_log` and search logs.
- [ ] Controller contact + DPDP grievance-officer email published (privacy-policy page).

## 6. Cross-border & processors

- Data is processed primarily via hosted providers; ensure sub-processor terms cover
  the DPDP obligations and that transfers to non-adequate jurisdictions have
  appropriate safeguards (SCCs / contractual language) where GDPR applies.

## 7. Security controls (summary)

- TLS everywhere; anon/search surface strips PII (see §2).
- Server-side authorization for payments, admin actions, uploads (Phases 0–1).
- Rate limiting on auth/AI/payment/push edge functions (Phase 1).
- Credentials never committed; `scripts/scan-secrets.mjs` pre-commit + CI gate
  (rotation of the re-issued keys pending — see audit).

## 8. Review checklist before launch

- [ ] Legal review of this doc + user-facing policy pages.
- [ ] Confirm exact DPDP notice (language, purpose, grievance officer) stages.
- [ ] Confirm GDPR EU/EEA applicability decision.
- [ ] Complete erasure + portability flows (Section 5 TODOs).
- [ ] Confirm retention/pruning jobs scheduled.
