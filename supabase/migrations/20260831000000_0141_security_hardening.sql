-- ============================================================
-- 0141_security_hardening.sql
-- Corrective migration: closes Critical privilege-escalation and
-- payment-bypass gaps found during the codebase security audit.
--
-- WHAT & WHY (per finding):
--   1. prevent_self_role_escalation  (0116/0117) never fired: it is SECURITY
--      DEFINER, so `current_user` inside it is always the function owner
--      (`postgres`, which is on the allowlist), making the guard a no-op.
--      A browser user could self-promote profiles.role to 'admin'.
--      FIX: base the decision on auth.uid() + is_admin(), never current_user.
--   2. prevent_view_count_tampering (0122) has the identical defect; fixed
--      the same way.
--   3. activate_subscription_payment / get_active_customer_subscription /
--      enforce_property_limit (0138): SECURITY DEFINER, PUBLIC-executable by
--      default, no ownership check -> anyone could mint a paid subscription
--      with no payment, and read another user's subscription data.
--      FIX: require auth.uid() = p_customer_id (or admin), add SET search_path,
--      and REVOKE EXECUTE from PUBLIC/anon/authenticated (service_role + the
--      payment-gateway edge function are the only legitimate callers).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Fix broken role-escalation guard
--    Decision is now made on the *calling user* (auth.uid()/is_admin()),
--    not on current_user (which is always the SECURITY DEFINER owner).
--    Legitimate role changes happen only via trusted service-role flows,
--    which call with no user JWT and therefore auth.uid() IS NULL here,
--    so they are still allowed. A real end-user session (anon/authenticated
--    with an auth.uid()) cannot change roles unless they are already admin
--    acting through the app.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Changing profiles.role directly is not permitted. Role changes must go through a trusted server-side flow.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_self_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_self_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_escalation();

-- Defense-in-depth: no end-user role may change the role column at all.
-- (service_role/postgres still can, via the trusted flows.)
REVOKE UPDATE (role) ON public.profiles FROM anon, authenticated;

-- ------------------------------------------------------------
-- 2. Fix broken view_count tampering guard (same root cause)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_view_count_tampering()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.view_count IS DISTINCT FROM OLD.view_count
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'view_count can only be changed via the property view tracking function.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_view_count_tampering ON public.properties;
CREATE TRIGGER trg_prevent_view_count_tampering
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.prevent_view_count_tampering();

-- ------------------------------------------------------------
-- 3. Harden subscription RPCs (0138)
--    activate_subscription_payment: only the account owner (or an admin)
--    may activate their own subscription. Called by the payment-gateway
--    edge function with the caller's identity; service_role is the trusted
--    server path. Exact, verified payment amount enforcement is done by the
--    payment flow; this RPC now at least cannot be used cross-user or anon.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_customer_subscription(p_customer_id UUID)
RETURNS TABLE (
    subscription_id UUID,
    plan_id UUID,
    plan_name TEXT,
    plan_slug TEXT,
    status TEXT,
    amount_paid NUMERIC,
    currency TEXT,
    start_date TIMESTAMPTZ,
    expiry_date TIMESTAMPTZ,
    remaining_days INT,
    listing_limit INT,
    listings_used INT,
    enquiry_limit INT,
    enquiries_used INT,
    visibility_level TEXT,
    premium_placement BOOLEAN,
    photoshoot_support BOOLEAN,
    account_manager BOOLEAN,
    field_assistance BOOLEAN,
    phone_privacy BOOLEAN,
    features_list JSONB
) AS $$
BEGIN
  -- Caller may only read their own subscription (or an admin/staff).
  IF NOT (auth.uid() = p_customer_id OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not authorized to view this subscription.';
  END IF;
  RETURN QUERY
    SELECT
        cs.id AS subscription_id,
        sp.id AS plan_id,
        sp.name AS plan_name,
        sp.slug AS plan_slug,
        CASE
            WHEN cs.expiry_date < now() THEN 'EXPIRED'
            WHEN cs.expiry_date < (now() + interval '5 days') THEN 'EXPIRING_SOON'
            ELSE cs.status
        END AS status,
        cs.amount_paid,
        cs.currency,
        cs.start_date,
        cs.expiry_date,
        GREATEST(0, EXTRACT(DAY FROM (cs.expiry_date - now()))::INT) AS remaining_days,
        sp.listing_limit,
        (SELECT count(*)::INT FROM public.properties p WHERE p.owner_id = p_customer_id AND p.status <> 'draft') AS listings_used,
        sp.enquiry_limit,
        cs.enquiries_used,
        sp.visibility_level,
        sp.premium_placement,
        sp.photoshoot_support,
        sp.account_manager,
        sp.field_assistance,
        sp.phone_privacy,
        sp.features_list
    FROM public.customer_subscriptions cs
    JOIN public.subscription_plans sp ON sp.id = cs.plan_id
    WHERE cs.customer_id = p_customer_id
      AND cs.status = 'ACTIVE'
      AND cs.expiry_date > now()
    ORDER BY sp.listing_limit DESC, cs.expiry_date DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
  -- Only the account owner (or an admin/staff) may activate their own plan.
  -- service_role calls carry no user JWT (auth.uid() IS NULL) and are the
  -- trusted server-side path from the payment-gateway edge function.
  IF NOT (auth.uid() = p_customer_id OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not authorized to activate this subscription.';
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found';
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

-- enforce_property_limit is a SECURITY DEFINER trigger that reads quota data;
-- add search_path and keep its behaviour, but scope is unchanged (it runs on
-- property inserts/updates). Recreate to add search_path for safety.
CREATE OR REPLACE FUNCTION public.enforce_property_limit()
RETURNS TRIGGER AS $$
DECLARE
    limit_record RECORD;
    v_sub RECORD;
    v_current_count INT;
    v_quota INT := 5;
BEGIN
    IF NEW.status = 'draft' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'draft' THEN
        RETURN NEW;
    END IF;

    SELECT sp.listing_limit, cs.expiry_date
    INTO v_sub
    FROM public.customer_subscriptions cs
    JOIN public.subscription_plans sp ON sp.id = cs.plan_id
    WHERE cs.customer_id = NEW.owner_id
      AND cs.status = 'ACTIVE'
      AND cs.expiry_date > now()
    ORDER BY sp.listing_limit DESC
    LIMIT 1;

    IF FOUND THEN
        v_quota := v_sub.listing_limit;
    ELSE
        SELECT * INTO limit_record FROM public.property_limits WHERE user_id = NEW.owner_id;
        IF FOUND AND limit_record.override_enabled THEN
            RETURN NEW;
        END IF;
        IF FOUND THEN
            v_quota := limit_record.monthly_quota;
        END IF;
    END IF;

    SELECT count(*) INTO v_current_count
    FROM public.properties
    WHERE owner_id = NEW.owner_id
      AND status <> 'draft'
      AND id <> NEW.id;

    IF v_current_count >= v_quota THEN
        RAISE EXCEPTION 'PROPERTY_LIMIT_EXCEEDED: You have reached your listing limit of % properties. Please upgrade your subscription to add more properties.', v_quota;
    END IF;

    INSERT INTO public.property_limits (user_id, monthly_quota, used_quota, updated_at)
    VALUES (NEW.owner_id, v_quota, v_current_count + 1, now())
    ON CONFLICT (user_id) DO UPDATE
    SET used_quota = v_current_count + 1,
        monthly_quota = GREATEST(public.property_limits.monthly_quota, v_quota),
        updated_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- 4. Lock down execution of the subscription RPCs:
--    PostgreSQL grants EXECUTE to PUBLIC on new functions by default, which
--    is how anon/authenticated could invoke them. Restrict to service_role
--    (trusted server path). The payment-gateway edge function runs under the
--    service key; the app's own portal reads via the safe ownership checks
--    above (still reachable by the account owner through RLS-protected
--    service-role/authenticated flows as needed).
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_active_customer_subscription(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_customer_subscription(UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.activate_subscription_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;
