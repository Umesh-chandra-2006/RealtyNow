-- ============================================================
-- 0151_residual_security_fixes.sql
-- Second-pass residual audit fixes (findings A-D, E-G).
--
-- A) HIGH — PII leak: lister's mobile exposed to anon via raw
--    properties SELECT. 0142 nulled phones in v_properties_search
--    but the canonical table policy still grants anon SELECT on
--    all columns. Fix: revoke SELECT on properties from anon
--    entirely (anon must use the redacted view).
--
-- B) HIGH — Self-publish bypass: owner/agent can UPDATE
--    status='published', is_live=true directly, skipping the
--    admin moderation workflow. Fix: BEFORE UPDATE trigger that
--    blocks non-staff from flipping to live/published states.
--
-- C) MEDIUM — IDOR: fn_create_payment_and_invoice is callable by
--    any authenticated user with an arbitrary p_user_id. Fix:
--    restrict EXECUTE to service_role only (payment-gateway edge
--    function already calls this via service_role; no client code
--    needs direct access).
-- ============================================================

-- A) PII leak: revoke raw properties SELECT from anon
--    anon callers must use v_properties_search (phones are NULL there).
--    authenticated and service_role retain full access for dashboards/edge fns.
REVOKE SELECT ON public.properties FROM anon;

-- B) Self-publish bypass: block non-staff from publishing directly
CREATE OR REPLACE FUNCTION public.prevent_self_publish()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when the row is being promoted to a live/published state.
  -- Draft→submitted, submitted→changes_requested, etc. are unaffected.
  IF (NEW.status IN ('published', 'live')
      OR NEW.is_live = true
      OR NEW.approval_status = 'Approved')
     AND auth.uid() IS NOT NULL
     AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'Publishing requires moderation; use the approval workflow.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_self_publish ON public.properties;
CREATE TRIGGER prevent_self_publish
  BEFORE UPDATE OF status, is_live, approval_status
  ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_publish();

-- C) IDOR: restrict fn_create_payment_and_invoice to service_role only
--    (the payment-gateway edge function computes the amount and calls this
--    via service_role; no authenticated client code needs direct access).
REVOKE EXECUTE ON FUNCTION public.fn_create_payment_and_invoice(
  UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, JSONB, NUMERIC, UUID
) FROM authenticated;
