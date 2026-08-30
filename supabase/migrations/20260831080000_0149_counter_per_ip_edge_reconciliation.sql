-- =============================================================================
-- Migration: 20260831080000_0149_counter_per_ip_edge_reconciliation.sql
-- Description: Reconciliation documenting the per-IP rate cap for the counter
-- RPCs (Audit High #11, follow-up to 0148).
--
-- Decision (user + merged report reconciliation): keep anonymous counting
-- enabled (anonymous visitors are the core ad and property-view audience) and
-- tighten further with a per-IP rate cap.
--
-- WHY THIS MIGRATION IS A DOCUMENTATION/RECONCILIATION MARKER:
--   * Postgres functions have no client IP (0148 already notes this), so a
--     true per-IP cap CANNOT be enforced inside record_property_view /
--     increment_ad_click / increment_ad_impression.
--   * The per-IP cap is instead enforced by the new `track-analytics` edge
--     function, which reads the request IP (x-forwarded-for / x-real-ip) and
--     applies checkRateLimit (fn_check_rate_limit, service_role-only) BEFORE
--     forwarding to the RPC with the caller's own credentials.
--   * 0148 keeps `anon` grants and per-user rate limits + record_property_view
--     dedupe; this migration only re-affirms the explicit grants idempotently so
--     the SQL state matches the edge-function enforcement path.
--
-- Client wiring (src/lib):
--   * src/lib/properties.ts  trackPropertyView        -> track-analytics (view)
--   * src/lib/advertisements.ts trackAdImpression     -> track-analytics (impression)
--   * src/lib/advertisements.ts trackAdClick          -> track-analytics (click)
-- =============================================================================

-- Re-affirm the explicit (non-default-PUBLIC) grants, idempotent with 0148.
GRANT EXECUTE ON FUNCTION public.record_property_view(UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_ad_click(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_ad_impression(UUID) TO anon, authenticated, service_role;
