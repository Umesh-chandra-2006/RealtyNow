-- ==============================================================================
-- Migration: 20260826180000_0138_realtynow_subscription_system.sql
-- Description: Establishes the RealtyNow Property-First Subscription Architecture
--              (Plan -> Price -> Validity -> Listing Limits -> Visibility -> Enquiries -> Benefits)
-- ==============================================================================

-- 1. SUBSCRIPTION PLANS TABLE
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'INR',
    tax_gst_pct NUMERIC(5,2) NOT NULL DEFAULT 18.00,
    validity_days INT NOT NULL DEFAULT 30,
    listing_limit INT NOT NULL DEFAULT 5,
    enquiry_limit INT NOT NULL DEFAULT 20,
    visibility_level TEXT NOT NULL DEFAULT 'Standard' CHECK (visibility_level IN ('Standard', 'Enhanced', 'Premium')),
    premium_placement BOOLEAN NOT NULL DEFAULT false,
    photoshoot_support BOOLEAN NOT NULL DEFAULT false,
    account_manager BOOLEAN NOT NULL DEFAULT false,
    field_assistance BOOLEAN NOT NULL DEFAULT false,
    phone_privacy BOOLEAN NOT NULL DEFAULT false,
    features_list JSONB NOT NULL DEFAULT '[]'::jsonb,
    display_order INT NOT NULL DEFAULT 1,
    is_popular BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. CUSTOMER SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.customer_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
    amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'INR',
    start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    expiry_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    listings_used INT NOT NULL DEFAULT 0,
    enquiries_used INT NOT NULL DEFAULT 0,
    auto_renew BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure all columns exist even if table was previously created with legacy schema
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'customer_subscriptions' 
          AND column_name = 'user_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'customer_subscriptions' 
          AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE public.customer_subscriptions RENAME COLUMN user_id TO customer_id;
    END IF;
END $$;

ALTER TABLE public.customer_subscriptions
    ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS listings_used INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS enquiries_used INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_customer_subs_user ON public.customer_subscriptions(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_subs_expiry ON public.customer_subscriptions(expiry_date);

-- 3. SUBSCRIPTION PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES public.customer_subscriptions(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
    payment_gateway TEXT NOT NULL DEFAULT 'Razorpay',
    gateway_order_id TEXT,
    gateway_payment_id TEXT,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'PENDING',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure all columns exist on subscription_payments
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'subscription_payments' 
          AND column_name = 'user_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'subscription_payments' 
          AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE public.subscription_payments RENAME COLUMN user_id TO customer_id;
    END IF;
END $$;

ALTER TABLE public.subscription_payments
    ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.customer_subscriptions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS payment_gateway TEXT NOT NULL DEFAULT 'Razorpay',
    ADD COLUMN IF NOT EXISTS gateway_order_id TEXT,
    ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT,
    ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_sub_payments_customer ON public.subscription_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_order ON public.subscription_payments(gateway_order_id);

-- 4. PROPERTY SUBSCRIPTION ASSOCIATIONS TABLE
CREATE TABLE IF NOT EXISTS public.property_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
    visibility_level TEXT NOT NULL DEFAULT 'Standard',
    premium_placement BOOLEAN NOT NULL DEFAULT false,
    active_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_property_subscription UNIQUE (property_id, subscription_id)
);

-- 5. RLS POLICIES
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_subscriptions ENABLE ROW LEVEL SECURITY;

-- subscription_plans: Public read active plans, Admin full access
DROP POLICY IF EXISTS "Public can view active subscription plans" ON public.subscription_plans;
CREATE POLICY "Public can view active subscription plans"
    ON public.subscription_plans FOR SELECT
    USING (is_active = true OR (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'developer'))));

DROP POLICY IF EXISTS "Admins have full access to subscription plans" ON public.subscription_plans;
CREATE POLICY "Admins have full access to subscription plans"
    ON public.subscription_plans FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'developer')));

-- customer_subscriptions: User can view their own subscriptions, Admin full access
DROP POLICY IF EXISTS "Customers can view their own subscriptions" ON public.customer_subscriptions;
CREATE POLICY "Customers can view their own subscriptions"
    ON public.customer_subscriptions FOR SELECT
    USING (customer_id = auth.uid() OR (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'developer'))));

DROP POLICY IF EXISTS "Customers can insert their own subscriptions" ON public.customer_subscriptions;
CREATE POLICY "Customers can insert their own subscriptions"
    ON public.customer_subscriptions FOR INSERT
    WITH CHECK (customer_id = auth.uid() OR (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'developer'))));

DROP POLICY IF EXISTS "Admins have full access to customer subscriptions" ON public.customer_subscriptions;
CREATE POLICY "Admins have full access to customer subscriptions"
    ON public.customer_subscriptions FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'developer')));

-- subscription_payments: Customer can view their own, Admin full access
DROP POLICY IF EXISTS "Customers can view their own payments" ON public.subscription_payments;
CREATE POLICY "Customers can view their own payments"
    ON public.subscription_payments FOR SELECT
    USING (customer_id = auth.uid() OR (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'developer'))));

DROP POLICY IF EXISTS "Customers can insert their own payments" ON public.subscription_payments;
CREATE POLICY "Customers can insert their own payments"
    ON public.subscription_payments FOR INSERT
    WITH CHECK (customer_id = auth.uid() OR (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'developer'))));

DROP POLICY IF EXISTS "Admins have full access to subscription payments" ON public.subscription_payments;
CREATE POLICY "Admins have full access to subscription payments"
    ON public.subscription_payments FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'developer')));

-- 6. RPC: GET ACTIVE CUSTOMER SUBSCRIPTION
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
        (
            SELECT count(*)::INT 
            FROM public.properties p 
            WHERE p.owner_id = p_customer_id AND p.status <> 'draft'
        ) AS listings_used,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: ACTIVATE SUBSCRIPTION UPON CONFIRMED PAYMENT
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
    SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plan not found';
    END IF;

    v_expiry := now() + (v_plan.validity_days || ' days')::INTERVAL;

    -- Deactivate any previously active subscription
    UPDATE public.customer_subscriptions
    SET status = 'EXPIRED', updated_at = now()
    WHERE customer_id = p_customer_id AND status = 'ACTIVE';

    -- Create new active customer subscription
    INSERT INTO public.customer_subscriptions (
        customer_id,
        plan_id,
        amount_paid,
        currency,
        start_date,
        expiry_date,
        status,
        listings_used,
        enquiries_used
    ) VALUES (
        p_customer_id,
        p_plan_id,
        p_amount,
        v_plan.currency,
        now(),
        v_expiry,
        'ACTIVE',
        (SELECT count(*)::INT FROM public.properties WHERE owner_id = p_customer_id AND status <> 'draft'),
        0
    ) RETURNING id INTO v_sub_id;

    -- Record confirmed payment
    INSERT INTO public.subscription_payments (
        subscription_id,
        customer_id,
        plan_id,
        payment_gateway,
        gateway_order_id,
        gateway_payment_id,
        amount,
        currency,
        status
    ) VALUES (
        v_sub_id,
        p_customer_id,
        p_plan_id,
        COALESCE(p_gateway, 'Razorpay'),
        p_gateway_order_id,
        p_gateway_payment_id,
        p_amount,
        v_plan.currency,
        'SUCCESS'
    ) RETURNING id INTO v_payment_id;

    -- Sync property limits table with new subscription quota
    INSERT INTO public.property_limits (user_id, monthly_quota, reset_date, updated_at)
    VALUES (p_customer_id, v_plan.listing_limit, v_expiry, now())
    ON CONFLICT (user_id) DO UPDATE
    SET monthly_quota = v_plan.listing_limit,
        reset_date = v_expiry,
        updated_at = now();

    -- Create in-app notification
    INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        read,
        created_at
    ) VALUES (
        p_customer_id,
        'Subscription Activated!',
        'Your ' || v_plan.name || ' subscription is now active for ' || v_plan.validity_days || ' days with ' || v_plan.listing_limit || ' property listing capacity.',
        'subscription',
        false,
        now()
    );

    RETURN v_sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. INTEGRATE LISTING LIMIT TRIGGER WITH SUBSCRIPTION TIERS
CREATE OR REPLACE FUNCTION public.enforce_property_limit()
RETURNS TRIGGER AS $$
DECLARE
    limit_record RECORD;
    v_sub RECORD;
    v_current_count INT;
    v_quota INT := 5; -- Default free starter quota
BEGIN
    -- Drafts never count against listing quota
    IF NEW.status = 'draft' THEN
        RETURN NEW;
    END IF;

    -- On UPDATE, only enforce the moment a property actually leaves draft status
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'draft' THEN
        RETURN NEW;
    END IF;

    -- Check if customer has an active subscription
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
        -- Fallback to property_limits table quota if exists
        SELECT * INTO limit_record FROM public.property_limits WHERE user_id = NEW.owner_id;
        IF FOUND AND limit_record.override_enabled THEN
            RETURN NEW;
        END IF;
        IF FOUND THEN
            v_quota := limit_record.monthly_quota;
        END IF;
    END IF;

    -- Live count of owner's real (non-draft) listings
    SELECT count(*) INTO v_current_count
    FROM public.properties
    WHERE owner_id = NEW.owner_id
      AND status <> 'draft'
      AND id <> NEW.id;

    IF v_current_count >= v_quota THEN
        RAISE EXCEPTION 'PROPERTY_LIMIT_EXCEEDED: You have reached your listing limit of % properties. Please upgrade your subscription to add more properties.', v_quota;
    END IF;

    -- Update property_limits tracking
    INSERT INTO public.property_limits (user_id, monthly_quota, used_quota, updated_at)
    VALUES (NEW.owner_id, v_quota, v_current_count + 1, now())
    ON CONFLICT (user_id) DO UPDATE
    SET used_quota = v_current_count + 1,
        monthly_quota = GREATEST(public.property_limits.monthly_quota, v_quota),
        updated_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. SEED THE THREE REALTYNOW SUBSCRIPTION TIERS (BUSINESS CONFIGURABLE)
INSERT INTO public.subscription_plans (
    name,
    slug,
    description,
    price,
    currency,
    tax_gst_pct,
    validity_days,
    listing_limit,
    enquiry_limit,
    visibility_level,
    premium_placement,
    photoshoot_support,
    account_manager,
    field_assistance,
    phone_privacy,
    features_list,
    display_order,
    is_popular,
    is_active
) VALUES 
(
    'RealtyNow Starter',
    'starter',
    'Essential property listing package for individual owners to showcase properties with standard reach.',
    0.00,
    'INR',
    18.00,
    30,
    5,
    20,
    'Standard',
    false,
    false,
    false,
    false,
    false,
    '[
        "5 Property Listings",
        "30 Days Listing Validity",
        "Standard Search Visibility",
        "Up to 15 HD Photos per Listing",
        "Basic Customer Enquiries",
        "Direct Listing Management Portal",
        "Real-time Lead Notifications"
    ]'::jsonb,
    1,
    false,
    true
),
(
    'RealtyNow Growth',
    'growth',
    'Enhanced visibility and multi-property exposure designed for active sellers and investors.',
    1999.00,
    'INR',
    18.00,
    30,
    15,
    75,
    'Enhanced',
    false,
    false,
    false,
    true,
    true,
    '[
        "Everything in Starter included",
        "15 Property Listings",
        "30 Days Active Validity",
        "Enhanced Search Ranking Boost",
        "Priority Inquiries & Verified Leads",
        "Multi-Property Dashboard Analytics",
        "Privacy & Phone Number Protection",
        "Assisted Listing Optimization"
    ]'::jsonb,
    2,
    true,
    true
),
(
    'RealtyNow Premium',
    'premium',
    'Maximum visibility, featured placement, dedicated assistance, and priority lead generation.',
    4999.00,
    'INR',
    18.00,
    30,
    50,
    250,
    'Premium',
    true,
    true,
    true,
    true,
    true,
    '[
        "Everything in Growth included",
        "50 Property Listings",
        "30 Days Active Validity",
        "Premium Search Priority & Featured Placement",
        "Dedicated Relationship Manager",
        "Unlimited Lead Capture & Verification",
        "Priority Phone Support 24/7",
        "Custom Branding & Social Promotion"
    ]'::jsonb,
    3,
    false,
    true
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    validity_days = EXCLUDED.validity_days,
    listing_limit = EXCLUDED.listing_limit,
    enquiry_limit = EXCLUDED.enquiry_limit,
    visibility_level = EXCLUDED.visibility_level,
    premium_placement = EXCLUDED.premium_placement,
    photoshoot_support = EXCLUDED.photoshoot_support,
    account_manager = EXCLUDED.account_manager,
    field_assistance = EXCLUDED.field_assistance,
    phone_privacy = EXCLUDED.phone_privacy,
    features_list = EXCLUDED.features_list,
    display_order = EXCLUDED.display_order,
    is_popular = EXCLUDED.is_popular,
    is_active = EXCLUDED.is_active,
    updated_at = now();
