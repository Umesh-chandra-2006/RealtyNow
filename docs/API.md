# RealtyNow — API & Backend Reference

This document is the authoritative, **code-verified** reference for every server-side surface of RealtyNow:

- Supabase **Deno edge functions** (21) — each entry verified directly against its `supabase/functions/*/index.ts`.
- Database **RPC functions** (24 client-facing, exact signatures; full 131-item inventory generated).
- PostgREST **table endpoints** and the RLS-based access model.

> **Exactness guarantee:** counts and inventories come from `scripts/docs-sync.mjs`, which reads the code and writes `docs/generated/api-inventory.md` + `.snapshot.json`. CI runs `docs-sync --check` and **fails the build if this document's surface drifts**. The hand-written deep-dives below are stamped with a verification date; re-verify after any edge-function change and bump it.

Last verified: **2026-08-30**. Generated inventory: `docs/generated/api-inventory.md`.

---

## 0. Conventions

### Base URLs

| Surface | URL |
| --- | --- |
| Edge functions | `https://<project-ref>.supabase.co/functions/v1/<function-name>` |
| PostgREST REST | `https://<project-ref>.supabase.co/rest/v1/<table>` |
| Supabase Auth | `https://<project-ref>.supabase.co/auth/v1/...` |

### Auth model

| Caller | Key | What it can do |
| --- | --- | --- |
| Anonymous browser | `apikey: <anon>` header | Public search, counters, OTP, AI chat (rate-limited). RLS + redacted views only. |
| Signed-in user | `Authorization: Bearer <jwt>` | Own data, role-scoped operations. RLS enforced. |
| Admin (verified) | JWT + `profiles.role ∈ {admin, super_admin}` | Everything in admin edge functions (checked *inside* each function). |
| Server (edge functions) | `SUPABASE_SERVICE_ROLE_KEY` | RLS bypass — **never shipped to the browser**. |
| Cron / webhook | `x-cron-secret` / Razorpay HMAC | Scheduled jobs / payment confirmations only. |

### Common edge-function patterns

- **CORS:** all functions apply `getCorsHeaders(req)` from `_shared/cors.ts` (allow-list: `www.realtynow.in`, `realtynow.in`, `realtynow.netlify.app`, `localhost:5173/3000`, `127.0.0.1`). Preflight `OPTIONS` returns `200` with CORS headers.
- **Error shape:** JSON `{ success: false, error: <generic message> }`; raw detail is logged server-side only — never returned to the client.
- **`x-action` convention:** multi-purpose functions switch on the `x-action` request header (not the body). The client must send it.
- **Rate limiting:** where present, via `_shared/rate-limit.ts` (rejects with `429`).

---

## 1. Edge Functions — Deep Dives (21)

### 1.1 Public-facing

#### `property-og` — social-share Open Graph metadata (public HTML)
- **Method:** `GET` (`OPTIONS` preflight).
- **Auth:** none (public). Serves HTML for crawlers (WhatsApp/Facebook/Twitter/LinkedIn) + meta-refresh redirect for browsers.
- **Request:** `?id=<property_uuid>` or path `/property-og/<uuid>` (also accepts slug).
- **Response:** `text/html`; `Cache-Control: public, max-age=3600, s-maxage=86400`. Missing/id-not-found → branded fallback page with redirect (HTTP 200), never leaks property data.
- **Notes:** always uses the RealtyNow brand logo for `og:image` (never the property photo); includes Schema.org `RealEstateListing` JSON-LD. Reads `v_properties_search` (public/published rows only).
- **Rate limit:** none (edge/CDN-cached).

#### `track-analytics` — property views & ad counters (throttled)
- **Method:** `POST` (`OPTIONS` preflight).
- **Auth:** anonymous allowed; per-IP rate caps enforced.
- **Request:** `{ action: 'view' | 'click' | 'impression', propertyId?, adId?, ... }`.
- **Caps (per IP):** view **120/hr**, click **180/hr**, impression **300/hr**. DB-side dedupe (5-min per viewer) from migration 0148.
- **Purpose:** all client counters (`trackPropertyView`, `trackAdImpression`, `trackAdClick`) route here — see `src/lib/properties.ts`, `src/lib/advertisements.ts`.

#### `get-map-config` — map provider/keys bootstrap
- **Method:** `GET` / `POST` (`OPTIONS` preflight).
- **Auth:** public for anonymous users — they receive the OpenStreetMap fallback; a generated provider key is returned only to authenticated admins.
- **Response:** `{ provider: 'google' | 'osm', apiKey? | null, ... }`.
- **Rate limit:** 120 req/min.

### 1.2 Admin-gated (verified `profiles.role ∈ {admin, super_admin}`, active)

All functions in this section: `Authorization: Bearer <jwt>` required, role and active-status re-checked per call, generic error messages, service-role writes behind the auth gate.

#### `admin-agent-verification` — RERA verification of agents
- **Method:** `POST`. Header `x-action`: `verify | reject | under-review | get-document`.
- **Auth:** `Authorization: Bearer <jwt>`; requires `profiles.role ∈ {admin, super_admin}` AND `status = active` (403 otherwise).
- **Body:** `{ agentId, reason? }` — `reason` mandatory for `reject`.
- **`get-document`:** returns `{ url }` — a 600-second signed URL for the agent's private RERA doc in the `agent-documents` bucket (never exposed publicly).
- **Response:** `{ success: true }` or `{ success: false, error }`. Errors: 401/403/404/400/500.
- **Rate limit:** none (admin-gated).

#### `admin-customers` — customer CRM (admin)
- **Method:** `POST`. Header `x-action`: `list | get | update-status | update-profile | delete`.
- **Auth:** admin/super_admin + active (same check as above).
- **Body (per action):**
  - `list`: `{ search?, status?, dateFrom?, dateTo? }` → `{ success, customers[], filteredCount, stats { total, active, inactive, newThisMonth } }`.
  - `get`: `{ customerId }` → `{ customer, activity { propertiesListed, savedProperties, enquiries, appointments } }`.
  - `update-status`: `{ customerId, status }` — valid: `active | inactive | suspended | blocked`.
  - `update-profile`: `{ customerId, first_name?, last_name?, email?, phone?, bio?, company? }`.
  - `delete`: `{ customerIds: string[] }` (role-restricted to `customer`).
- **Rate limit:** none (admin-gated).

#### `admin-security` — admin 2FA + account management
- **Method:** `POST`. Header `x-action` (see below).
- **Auth:** valid JWT; caller must be admin/super_admin **or** on the authorized-admin-mobile list (`_shared/admin-auth.ts`; self-heals profile → admin). Suspended accounts blocked.
- **Actions (self-service):** `get-me`, `get-status`, `setup-secret-code` (`{ code }`, 6–12 chars), `verify-secret-code` (`{ code }`), `reset-secret-code` (`{ currentCode, newCode }`), `logout`, `log-otp-login`.
- **Lockout:** 5 failed attempts → locked 15 minutes (bcrypt hash, `admin_security` table).
- **Actions (super_admin only):** `super-reset-secret-code` (`{ targetAdminId, newCode }`), `create-admin` (`{ mobile, role?, first_name?, last_name? }`), `update-admin-status` (`{ targetAdminId, status }`), `list-admins`, `list-login-logs` (`{ adminId? }`).
- **Audit:** every event writes `admin_login_logs` (admin_id, ip, device, action, status).
- **Rate limit:** none beyond the lockout (admin-gated).

#### `bulk-import-admin` — admin bulk property import
- **Method:** `POST`. Header `x-action`: `import | history`.
- **Auth:** admin/super_admin + active.
- **`import` body:** `{ purposeValue, fileName?, duplicateStrategy? ('skip'|'update'|'replace'|'create_new'), rows: [{ rowNumber, raw, payload, errors, duplicateOfPropertyId?, duplicateReason?, strategy? }] }`.
  - Server-side duplicate detection (reference_id, rera_number, title+city), owner resolution from `profiles.phone`, chunked inserts (25/chunk). Returns the completed job summary synchronously.
- **`history`:** `{}` → past `bulk_import_jobs` for this admin.
- **Rate limit:** none (admin-gated, chunked by design).

#### `process-application` — approve/reject/suspend agent & builder applications
- **Method:** `POST`.
- **Auth:** mandatory `Authorization: Bearer <jwt>`; admin role checked before any action.
- **Body:** `{ application_id, type, action ('approve'|'reject'|'stage_change'), remarks?, new_stage?, verification_state? }`.
- **Response:** `{ success: true }`; **400 + generic message** on failure (never inner error text).
- **Rate limit:** 20 req/min per caller.

---

### 1.3 Property moderation (admin) — `approveProperty`, `rejectProperty`, `verifyProperty`, `generatePropertySeo`

All four share the same shape:

- **Method:** `POST`.
- **Auth:** `Authorization: Bearer <jwt>`; requires `profiles.role ∈ {admin, super_admin}` **and active**; operations performed with the service-role key.
- **Body:** `{ property_id, reason?, remarks? }` — `reason` required for `rejectProperty`.
- **Response:** `{ success: true }`. Errors are generic; detail stays in server logs.
- All four append `property_status_history` entries and/or run AI verification/SEO generation; **any user's role changing at runtime does not grant access** (role re-read per call).
- **Rate limit:** none (admin-gated).

---

### 1.4 Authenticated-user flows

#### `otp-auth` — mobile OTP sign-in & admin provisioning
- **Method:** `POST`. Header `x-action` — e.g. `send`, `verify`, `request-agent-access` (+ admin provisioning).
- **Auth:** public for OTP send/verify (rate-limited); admin provisioning requires validated admin identity.
- **Request:** `{ phone/accessToken/intent..., }` per action; OTP codes single-use, short TTL.
- **Rate limit:** per-IP throttle on public actions (≈10 req/min); admin actions behind real auth.
- **Responses:** `{ success }`; failure → generic `401/400` with no code leakage.

#### `upload-profile-photo` — avatar upload (image-verified)
- **Method:** `POST` (multipart).
- **Auth:** optional — authenticated users upload to their account-bound folder; the pre-auth lead flow uploads to a shared `pending/` location (per accepted design decision).
- **Verification:** server-side magic-byte image sniffing (rejects scripts/non-images), file-size cap.
- **Rate limit:** per-IP and per-user limits; destination folder is **server-chosen** (never caller-controlled in the pending path).
- **Response:** `{ url }` pointing into the `profile-images` bucket.

#### `getVerificationStatus` — AI verification status for a property
- **Method:** `GET ?property_id=<uuid>` or `POST { property_id }`.
- **Auth:** `Authorization: Bearer <jwt>` (requires a real session).
- **Response:** latest `ai_verifications` row, newest first, or `{ success: true, verification: null, verification_status: 'Pending AI' }`.
- **Notes:** queries with the **caller's own JWT** so RLS decides access (owner/admin only) — no service key.
- **Errors:** 401 (no auth), 400 (missing property), 500 (generic).

#### `send-push` — push notifications (FCM HTTP v1)
- **Method:** `POST`.
- **Auth:** client-registered device tokens (`push_tokens`).
- **Request:** `{ token?, tokens?, title, body, data?, ... }` to a user or broadcast.
- **Response:** `{ success }`; real FCM delivery (no fake success).
- **Rate limit:** 30 req/min.

#### `ai-assistant` — AI chat & generation (server path)
- **Method:** `POST`. `{ task, payload }` — tasks include `chat`, `generate_description`, `estimate_price`, `parse_search`, SEO, etc.
- **Auth/publicity:** powers the public AI widget & admin generators; per-user **20 req/min**.
- **Guarantee:** `chat` answers property-shape questions **directly from `v_properties_search`** — results are RealtyNow-only and never fabricated (mirrors `src/lib/ai.ts`).
- **Response:** `{ result }`. See `docs/generated/api-inventory.md` and `docs/AI_FEATURES.md`.

#### `payment-gateway` — customer payments (orders, discounts, Razorpay orders)
- **Method:** `POST`. Header `x-action` — order creation, promo validation, etc.
- **Auth:** browser client (anon key) with the merchant keys server-side only.
- **Security:** **request `discount` input is ignored**; discounts computed server-side from validated `discount_campaigns`; server amount floors; Razorpay key/secret never reach the browser.
- **Rate limit:** 30 req/min.

---

### 1.5 Webhooks / scheduled jobs

#### `txn-invoice-services` — Razorpay payment webhook + invoice/payment updates
- **Method:** `POST`.
- **Auth:** **Razorpay HMAC signature** in headers — invalid signature → `401` (no processing).
- **Guards:** paid amount matched to stored invoice within ₹0.01; only valid `pending → confirmed` transitions; idempotent re-delivery; **refunded payments can never flip back to success**. WhatsApp send path returns honest `501` until a provider is configured.
- **Rate limit:** 30 req/min (defense in depth).

#### `process-renewals` — scheduled subscription-renewal batch
- **Method:** `POST`.
- **Auth:** `x-cron-secret` (cron trigger only) **plus** a defensive rate guard (max 6 runs/hr).
- **Purpose:** extends active paid listings, sends renewal reminders, handles expiry/stale state.

---

## 2. Database RPCs — Client-Facing (exact signatures)

Called from the browser via `POST /rest/v1/rpc/<name>` with the caller's JWT (RLS applies inside).

| RPC | Signature | Purpose |
| --- | --- | --- |
| `admin_approve_property` | `(p_property_id UUID, p_admin_id UUID DEFAULT auth.uid())` | Admin approves + publishes a listing. |
| `admin_assign_agent` | `(p_property_id UUID, p_agent_id UUID, p_admin_id UUID DEFAULT auth.uid())` | Admin assigns an agent to a property. |
| `admin_get_properties` | `()` | Admin listing list (admin-scoped). |
| `admin_make_property_live` | `(p_property_id UUID, p_admin_id UUID DEFAULT auth.uid())` | Force a property live (published). |
| `admin_reject_property` | `(p_property_id UUID, p_admin_id UUID DEFAULT auth.uid(), p_reason TEXT DEFAULT 'Property submission rejected by admin.')` | Admin rejects with reason. |
| `admin_reveal_partner_bank_account_number` | `(p_bank_account_id uuid)` | Masked → plaintext bank number (audited). |
| `admin_send_notification` | `(p_title TEXT, p_body TEXT, p_user_id UUID DEFAULT NULL, p_broadcast BOOLEAN DEFAULT false, p_link TEXT DEFAULT NULL)` | Targeted/broadcast in-app notification. |
| `create_referral` | `(p_referral_type text, p_category text DEFAULT NULL, p_details jsonb DEFAULT '{}', p_force boolean DEFAULT false)` | Create a referral. |
| `customer_resubmit_property` | `(p_property_id UUID)` | Owner resubmits a rejected/changes-requested listing. |
| `fn_assign_lead` | `(p_lead_id UUID, p_agent_id UUID, p_assigned_by UUID DEFAULT auth.uid())` | Assign CRM lead to agent. |
| `fn_get_crm_dashboard_stats` | `(p_agent_id UUID DEFAULT NULL)` | Agent CRM dashboard stats. |
| `fn_get_renewal_analytics` | `(p_user_id UUID DEFAULT NULL)` | Renewal analytics. |
| `fn_mark_notifications_read` | `(p_notification_ids UUID[] DEFAULT NULL)` | Mark notifications read. |
| `fn_request_account_erasure` | `()` | DPDP erasure request (cutover path, 0146/0147). |
| `fn_request_withdrawal` | `(p_amount NUMERIC, p_bank_details JSONB)` | Wallet withdrawal request. |
| `fn_set_service_status` | `(p_key text, p_active boolean, p_reason text DEFAULT NULL)` | Toggle feature/service switch. |
| `fn_update_lead_status` | `(p_lead_id UUID, p_new_status TEXT, p_reason TEXT DEFAULT NULL, p_value NUMERIC DEFAULT NULL, p_actor_id UUID DEFAULT auth.uid())` | Transition lead status. |
| `get_active_advertisements` | `(p_target_page TEXT, p_position TEXT, p_device_type TEXT DEFAULT 'All Devices')` | Active ads for a page slot. |
| `get_active_customer_subscription` | `(p_customer_id UUID)` | Customer's active subscription. |
| `log_property_share` | `(p_property_id UUID, p_platform TEXT)` | Record a share event. |
| `submit_contact_enquiry` | `(p_name TEXT, p_phone TEXT, p_email TEXT DEFAULT NULL, p_message TEXT DEFAULT NULL, p_source TEXT DEFAULT 'contact_page', p_customer_id UUID DEFAULT NULL, p_property_id UUID DEFAULT NULL, p_tags TEXT[] DEFAULT NULL)` | Contact-page enquiry. |
| `submit_contact_lead` | `(p_property_id UUID, p_agent_id UUID DEFAULT NULL, p_name TEXT DEFAULT NULL, p_phone TEXT DEFAULT NULL, p_email TEXT DEFAULT NULL, p_message TEXT DEFAULT NULL)` | Lead capture. |
| `submit_partner_application` | `(p_application jsonb)` | Agent/build partnerships. |
| `submit_visit_request` | `(p_property_id UUID, p_agent_id UUID DEFAULT NULL, p_name TEXT DEFAULT NULL, p_phone TEXT DEFAULT NULL, p_email TEXT DEFAULT NULL, p_preferred_date DATE DEFAULT NULL, p_time_slot TEXT DEFAULT NULL, p_visit_type TEXT DEFAULT 'Property Visit', p_message TEXT DEFAULT NULL)` | Site-visit booking. |

> The full 131-function inventory (including all internal helpers, triggers, and `SECURITY DEFINER` service functions) is generated into `docs/generated/api-inventory.md`.

---

## 3. PostgREST Table Endpoints

- Every table is reachable at `/rest/v1/<table>`; permissions are enforced by **Row Level Security** (enabled on all app tables, from migration 0001), not by endpoint ambiguity.
- The public search surface is intentionally the **`v_properties_search` view** — its enumerated column list redacts PII (both phone columns are literal `NULL` for non-owners) and its `WHERE` clause hard-filters to `published`/live rows (0142/0144). Client search must use this view (see `src/lib/properties.ts`).
- Client-query targets and the full table inventory are generated into `docs/generated/api-inventory.md`.

---

## 4. Storage Buckets

| Bucket | Access | Notes |
| --- | --- | --- |
| `profile-images` | auth + anonymous `pending/` | Server-verified uploads only (`upload-profile-photo`). |
| `agent-documents` | admin signed URLs only | RERA docs never publicly readable (`admin-agent-verification`). |
| property images (`images`/property bucket) | public read | Optimized at build (`scripts/optimize-images.mjs`). |

---

## 5. Keeping This Document Exact

1. Change code → run `node scripts/docs-sync.mjs` (regenerates `docs/generated/*` + snapshot).
2. If an edge function's payload/response/limits changed, update its deep-dive and bump **“Last verified”**.
3. CI runs `node scripts/docs-sync.mjs --check` — any drift (new/removed function, table, RPC, dependency) **fails the build** until the docs catch up.