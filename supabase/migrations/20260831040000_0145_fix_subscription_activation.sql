-- ===========================================================================
-- 0145 — Fix subscription activation: service-role path + amount verification
-- ===========================================================================
-- Reported by the Phase 0/1 verification report:
--   * Migration 0141 made activate_subscription_payment service_role-only, but
--     (a) the browser checkout still called it under the user JWT (permission
--     denied on every sign-up) and (b) the guard `auth.uid() = p_customer_id`
--     REJECTS the intended service-role edge-function path too, because a
--     service_role call carries no user JWT (auth.uid() IS NULL), so the
--     trusted server path could never run.
--   * The RPC recorded the client-supplied p_amount with no verification, so a
--     dishonest caller could self-grant a plan for any amount / fabricated
--     payment ids.
--
-- Fix:
--   1. Recreate activate_subscription_payment so the guard EXPLICITLY allows
--      service_role (the edge-function server path), in addition to the owner
--      / admin. It remains service_role-only (REVOKE from anon/authenticated).
--   2. Enforce a server-side amount floor inside the RPC: the recorded amount
--      must be >= the plan's base price. The authoritative amount is computed
--      by the edge function after Razorpay signature verification; this check
--      is defense-in-depth that a plan is never recorded below its price.
--   3. Restore EXECUTE to `authenticated` on the READ-ONLY
--      get_active_customer_subscription only. This read path is safe: the
--      function only ever returns rows owned by the calling user (or admin),
--      so the account portal read works again under the user JWT.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.activate_subscription_payment(
    p_customer_id UUID,
    p_plan_id UUID,
    p_amount NUMERIC,
    p_gateway TEXT,
    p_gateway_order_id TEXT,
    p_gateway_payment_id TEXT
)
RETURNS UUID AS $$
DECLARE
    v_plan RECORD;
    v_sub_id UUID;
    v_payment_id UUID;
    v_expiry TIMESTAMPTZ;
BEGIN
  -- Allowed callers:
  --   * service_role  — the trusted payment-gateway edge function path
  --                     (a service-role call carries no user JWT, auth.uid() IS NULL).
  --   * the account owner (auth.uid() = p_customer_id)
  --   * an admin / staff (public.is_admin())
  IF NOT (auth.role() = 'service_role'
          OR auth.uid() = p_customer_id
          OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not authorized to activate this subscription.';
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  -- Defense-in-depth: never record a payment below the plan's base price.
  -- (The authoritative amount is computed and verified by the edge function;
  -- this guard catches under-charge even from a misconfigured server path.)
  IF p_amount IS NULL OR p_amount < v_plan.price THEN
    RAISE EXCEPTION 'Amount below plan price.';
  END IF;

  v_expiry := now() + (v_plan.validity_days || ' days')::INTERVAL;

  UPDATE public.customer_subscriptions
  SET status = 'EXPIRED', updated_at = now()
  WHERE customer_id = p_customer_id AND status = 'ACTIVE';

  INSERT INTO public.customer_subscriptions (
      customer_id, plan_id, amount_paid, currency, start_date, expiry_date,
      status, listings_used, enquiries_used
  ) VALUES (
      p_customer_id, p_plan_id, p_amount, v_plan.currency, now(), v_expiry,
      'ACTIVE',
      (SELECT count(*)::INT FROM public.properties WHERE owner_id = p_customer_id AND status <> 'draft'),
      0
  ) RETURNING id INTO v_sub_id;

  INSERT INTO public.subscription_payments (
      subscription_id, customer_id, plan_id, payment_gateway, gateway_order_id,
      gateway_payment_id, amount, currency, status
  ) VALUES (
      v_sub_id, p_customer_id, p_plan_id, COALESCE(p_gateway, 'Razorpay'),
      p_gateway_order_id, p_gateway_payment_id, p_amount, v_plan.currency, 'SUCCESS'
  ) RETURNING id INTO v_payment_id;

  INSERT INTO public.property_limits (user_id, monthly_quota, reset_date, updated_at)
  VALUES (p_customer_id, v_plan.listing_limit, v_expiry, now())
  ON CONFLICT (user_id) DO UPDATE
  SET monthly_quota = v_plan.listing_limit,
      reset_date = v_expiry,
      updated_at = now();

  INSERT INTO public.notifications (
      user_id, title, message, type, read, created_at
  ) VALUES (
      p_customer_id, 'Subscription Activated!',
      'Your ' || v_plan.name || ' subscription is now active for ' || v_plan.validity_days || ' days with ' || v_plan.listing_limit || ' property listing capacity.',
      'subscription', false, now()
  );

  RETURN v_sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Keep activation service_role-only. The browser must go through the edge
-- function, which verifies the Razorpay signature BEFORE calling this RPC.
REVOKE EXECUTE ON FUNCTION public.activate_subscription_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;

-- The account portal must still read its own subscription under the user JWT.
-- get_active_customer_subscription is read-only and owner/admin-scoped, so it
-- is safe to restore to authenticated.
GRANT EXECUTE ON FUNCTION public.get_active_customer_subscription(UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_active_customer_subscription(UUID) FROM PUBLIC, anon;
