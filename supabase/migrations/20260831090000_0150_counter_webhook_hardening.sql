-- =============================================================================
-- Migration: 20260831090000_0150_counter_webhook_hardening.sql
-- Description: Close the last two counter/webhook hardening residuals and
-- document the v_properties_search security_invoker decision.
--
-- 1. record_property_view was created in 0137 before the 0148 hardening sweep
--    and was never REVOKE'd from PUBLIC (only the two ad RPCs were). Removing
--    default-PUBLIC execute so the function is callable only by the roles we
--    deliberately grant (anon/authenticated/service_role) — same landing as the
--    ad counters in 0148.
--
-- 2. Documented decision (NOT applied): v_properties_search is intentionally a
--    security-definer view. Its column list is fully enumerated and hard-redacts
--    PII (listed_by_mobile / owner_phone are literal NULLs) and its WHERE clause
--    hard-filters to published/live rows (0142/0144). Switching it to
--    `security_invoker = on` would require granting anon/authenticated SELECT on
--    the base tables (properties, profiles, ...) — widening anonymous PostgREST
--    access from the already-redacted view to the raw tables — for no functional
--    gain, because for anonymous callers the view's own filter + redaction and
--    the underlying RLS policies produce identical rows. 0139 remains the right
--    tool for the OTHER bypass-prone views; the redacted, enumerated search view
--    is deliberately exempt.
--
-- 3. The txn-invoice-services "refunded -> success" guard is enforced in code
--    (supabase/functions/txn-invoice-services/index.ts), not here.
-- =============================================================================

REVOKE ALL ON FUNCTION public.record_property_view(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_property_view(UUID, UUID) TO anon, authenticated, service_role;