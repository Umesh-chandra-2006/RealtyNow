-- =============================================================================
-- Migration: 20260831070000_0148_counter_analytics_hardening.sql
-- Description: Harden the ad/view counter RPCs against scripted inflation.
--
-- Audit High #11 (ad/property-view counters gamed): increment_ad_impression,
-- increment_ad_click, and record_property_view had no throttling, no dedupe,
-- no per-user limits (and were default-PUBLIC / granted to anon).
--
-- Decision (user + merged report reconciliation): keep anonymous counting
-- enabled — anonymous visitors are the core audience for ads and property views —
-- but add:
--   * per-user rate limiting via the existing public.fn_check_rate_limit
--     (keyed on auth.uid() for signed-in users),
--   * a per-viewer dedupe window on record_property_view so a single user (or
--     a burst) can no longer inflate a property's view_count,
--   * explicit, auditable EXECUTE grants on the ad RPCs (remove default-PUBLIC).
-- NOTE: DB functions have no client IP, so anonymous callers cannot be uniquely
-- rate-limited at this layer; the meaningful per-user limits apply to signed-in
-- sessions. Anonymous burst inflation is additionally bounded by record_property_view
-- dedupe where feasible.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. record_property_view — add SET search_path + per-viewer dedupe + rate limit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_property_view(p_property_id UUID, p_viewer_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_views   INTEGER;
  v_effective   UUID;
  v_rate        JSONB;
BEGIN
  -- Effective identity for dedupe: prefer the real session user, else the
  -- caller-supplied viewer (null for an anonymous visitor).
  v_effective := COALESCE(auth.uid(), p_viewer_id);

  -- Per-user rate limit for signed-in callers (limit view-recording bursts).
  IF auth.uid() IS NOT NULL THEN
    SELECT public.fn_check_rate_limit(
      auth.uid()::TEXT, 'record_property_view', 120, 3600
    ) INTO v_rate;
    IF (v_rate->>'allowed')::BOOLEAN = false THEN
      RETURN 0; -- within window quota: do not record/increment, stay quiet
    END IF;
  END IF;

  -- Per-viewer dedupe window: do not re-count the same viewer for the same
  -- property within 5 minutes (prevents scripted inflation of view_count).
  IF EXISTS (
    SELECT 1 FROM public.property_views pv
    WHERE pv.property_id = p_property_id
      AND pv.viewer_id IS NOT DISTINCT FROM v_effective
      AND pv.viewed_at > now() - interval '5 minutes'
  ) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.property_views (property_id, viewer_id)
  VALUES (p_property_id, v_effective);

  UPDATE public.properties
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_property_id
  RETURNING view_count INTO v_new_views;

  RETURN COALESCE(v_new_views, 0);
EXCEPTION
  WHEN OTHERS THEN
    UPDATE public.properties
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = p_property_id
    RETURNING view_count INTO v_new_views;
    RETURN COALESCE(v_new_views, 0);
END;
$$;

-- Keep the existing (now explicit) grants; anon stays enabled by decision.
GRANT EXECUTE ON FUNCTION public.record_property_view(UUID, UUID) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. increment_ad_click — add SET search_path + per-user rate limit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_ad_click(p_ad_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate JSONB;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT public.fn_check_rate_limit(
      auth.uid()::TEXT, 'ad_click', 180, 3600
    ) INTO v_rate;
    IF (v_rate->>'allowed')::BOOLEAN = false THEN
      RETURN;
    END IF;
  END IF;

  UPDATE public.advertisements
  SET clicks = COALESCE(clicks, 0) + 1,
      updated_at = now()
  WHERE id = p_ad_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. increment_ad_impression — add SET search_path + per-user rate limit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_ad_impression(p_ad_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate JSONB;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT public.fn_check_rate_limit(
      auth.uid()::TEXT, 'ad_impression', 300, 3600
    ) INTO v_rate;
    IF (v_rate->>'allowed')::BOOLEAN = false THEN
      RETURN;
    END IF;
  END IF;

  UPDATE public.advertisements
  SET impressions = COALESCE(impressions, 0) + 1,
      updated_at = now()
  WHERE id = p_ad_id;
END;
$$;

-- Remove the implicit default-PUBLIC execute on the ad RPCs and re-grant
-- explicitly to the roles that legitimately call them (anon stays enabled).
REVOKE ALL ON FUNCTION public.increment_ad_click(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_ad_impression(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_ad_click(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_ad_impression(UUID) TO anon, authenticated, service_role;
