-- ============================================================
-- 0143_harden_payment_discount.sql
-- Corrective migration from the codebase security audit.
--
-- Finding: supabase/functions/payment-gateway create-order accepted a client-
-- supplied `discount_pct` and forwarded it unchanged to
-- fn_create_payment_and_invoice, letting any caller grant themselves an
-- arbitrary (e.g. 100%) discount. The edge function no longer trusts the
-- client; it validates a coupon server-side and passes the resulting
-- p_discount_amount here. This migration extends the RPC to honour that
-- server-computed amount and to record the validated coupon, instead of
-- recomputing a discount from an unverified percentage.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_create_payment_and_invoice(
  p_user_id          UUID,
  p_package_id       UUID,
  p_amount           NUMERIC,
  p_payment_type     TEXT DEFAULT 'upfront',
  p_billing_cycle    TEXT DEFAULT 'monthly',
  p_gateway          TEXT DEFAULT 'razorpay',
  p_discount_pct     NUMERIC DEFAULT 0,
  p_split_schedule   JSONB DEFAULT NULL,  -- [{due_date, amount}, ...]
  p_discount_amount  NUMERIC DEFAULT 0,   -- server-validated discount (INR)
  p_coupon_id        UUID DEFAULT NULL    -- validated discount_campaigns.id
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_package      public.packages%ROWTYPE;
  v_payment_id   UUID;
  v_invoice_id   UUID;
  v_ap_id        UUID;
  v_tax          NUMERIC;
  v_subtotal     NUMERIC;
  v_discount_amt NUMERIC;
  v_total        NUMERIC;
  v_expires_at   TIMESTAMPTZ;
  v_inv_number   TEXT;
  v_item         JSONB;
BEGIN
  SELECT * INTO v_package FROM public.packages WHERE id = p_package_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not found or inactive'; END IF;

  -- Security: the amount charged must never be derived from a client-supplied
  -- percentage. p_discount_amount is the server-validated discount; the legacy
  -- p_discount_pct is ignored for the financial calculation so a browser can
  -- never discount itself.
  v_subtotal     := p_amount;
  v_discount_amt := GREATEST(0, COALESCE(p_discount_amount, 0));
  IF v_discount_amt > v_subtotal THEN
    v_discount_amt := v_subtotal;
  END IF;
  v_subtotal     := v_subtotal - v_discount_amt;
  v_tax          := ROUND(v_subtotal * 0.18, 2);
  v_total        := v_subtotal + v_tax;
  v_expires_at   := now() + (v_package.duration_days || ' days')::INTERVAL;

  INSERT INTO public.agent_packages (agent_id, package_id, status, billing_cycle, started_at, expires_at)
  VALUES (p_user_id, p_package_id, 'pending', p_billing_cycle, now(), v_expires_at)
  RETURNING id INTO v_ap_id;

  v_item := jsonb_build_array(jsonb_build_object(
    'description', v_package.name || ' Package (' || p_billing_cycle || ')',
    'quantity', 1,
    'unit_price', p_amount,
    'amount', p_amount
  ));

  v_inv_number := 'INV-' || LPAD(nextval('public.invoice_number_seq')::TEXT, 6, '0');
  INSERT INTO public.invoices (
    invoice_number, user_id, agent_package_id, items,
    subtotal, tax_pct, tax_amount, discount_amount, total, currency,
    status, issued_at, due_at
  ) VALUES (
    v_inv_number, p_user_id, v_ap_id, v_item,
    v_subtotal, 18, v_tax, v_discount_amt, v_total, 'INR',
    'issued', now(), now() + INTERVAL '7 days'
  ) RETURNING id INTO v_invoice_id;

  INSERT INTO public.payments (
    user_id, amount, currency, status, payment_type, gateway,
    package_id, agent_package_id, invoice_id,
    subtotal, tax_pct, tax_amount, discount_pct, discount_amount,
    description, updated_at
  ) VALUES (
    p_user_id, v_total, 'INR', 'pending', p_payment_type, p_gateway,
    p_package_id, v_ap_id, v_invoice_id,
    v_subtotal, 18, v_tax,
    CASE WHEN v_discount_amt > 0 THEN ROUND((v_discount_amt / NULLIF(p_amount,0)) * 100, 2) ELSE 0 END,
    v_discount_amt,
    v_package.name || ' Package Subscription',
    now()
  ) RETURNING id INTO v_payment_id;

  UPDATE public.invoices SET payment_id = v_payment_id WHERE id = v_invoice_id;
  UPDATE public.agent_packages SET payment_id = v_payment_id WHERE id = v_ap_id;

  IF p_payment_type IN ('split','emi') AND p_split_schedule IS NOT NULL THEN
    INSERT INTO public.payment_schedule (payment_id, user_id, installment_no, due_date, amount)
    SELECT
      v_payment_id,
      p_user_id,
      (ROW_NUMBER() OVER ())::INT,
      (item->>'due_date')::DATE,
      (item->>'amount')::NUMERIC
    FROM jsonb_array_elements(p_split_schedule) AS item;
  END IF;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'invoice_id', v_invoice_id,
    'invoice_number', v_inv_number,
    'agent_package_id', v_ap_id,
    'total', v_total,
    'tax', v_tax,
    'discount', v_discount_amt
  );
END;
$$;

-- Keep execution scoped to the server + authenticated flows as before.
GRANT EXECUTE ON FUNCTION public.fn_create_payment_and_invoice(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, JSONB, NUMERIC, UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.fn_create_payment_and_invoice(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, JSONB, NUMERIC, UUID) FROM PUBLIC, anon;

-- Drop the OLD 8-argument overload from migration 0031: it recomputed the
-- discount from the client-supplied p_discount_pct, so it would re-open the
-- same client-controlled-discount hole. It is no longer referenced anywhere
-- (payment-gateway now passes p_discount_amount / p_coupon_id). Removing it
-- guarantees the only remaining entry point is the hardened 10-arg version.
DROP FUNCTION IF EXISTS public.fn_create_payment_and_invoice(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, JSONB);
