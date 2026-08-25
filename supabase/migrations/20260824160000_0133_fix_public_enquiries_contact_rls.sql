-- =============================================================================
-- Migration: 20260824160000_0133_fix_public_enquiries_contact_rls.sql
-- Description: Fix public / anon submission permissions on public.enquiries and
--              lead_activities, provide robust RPC for contact forms.
-- =============================================================================

-- 1. Ensure public.enquiries columns and defaults
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS name             TEXT,
  ADD COLUMN IF NOT EXISTS email            TEXT,
  ADD COLUMN IF NOT EXISTS phone            TEXT,
  ADD COLUMN IF NOT EXISTS message          TEXT,
  ADD COLUMN IF NOT EXISTS customer_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS property_id      UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS builder_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source           TEXT DEFAULT 'contact_page',
  ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS lead_status      TEXT DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS priority         TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS tags             TEXT[],
  ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT now();

-- Ensure grants for anon and authenticated
GRANT ALL ON public.enquiries TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 2. Ensure RLS policies on public.enquiries
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enquiries_insert" ON public.enquiries;
DROP POLICY IF EXISTS "enquiries_public_insert" ON public.enquiries;
CREATE POLICY "enquiries_public_insert" ON public.enquiries
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "enquiries_select_multi_role" ON public.enquiries;
DROP POLICY IF EXISTS "enquiries_select" ON public.enquiries;
CREATE POLICY "enquiries_select_multi_role" ON public.enquiries
  FOR SELECT TO authenticated
  USING (
    auth.uid() = customer_id
    OR auth.uid() = agent_id
    OR auth.uid() = assigned_to
    OR auth.uid() = builder_id
    OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "enquiries_update_multi_role" ON public.enquiries;
DROP POLICY IF EXISTS "enquiries_update" ON public.enquiries;
CREATE POLICY "enquiries_update_multi_role" ON public.enquiries
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = customer_id
    OR auth.uid() = agent_id
    OR auth.uid() = assigned_to
    OR auth.uid() = builder_id
    OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
    OR public.is_staff()
  )
  WITH CHECK (true);

-- 3. Ensure public.lead_activities permissions
GRANT ALL ON public.lead_activities TO anon, authenticated, service_role;

ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_activities_read" ON public.lead_activities;
CREATE POLICY "lead_activities_read" ON public.lead_activities
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.enquiries e
      WHERE e.id = lead_id
        AND (
          e.customer_id = auth.uid()
          OR e.agent_id = auth.uid()
          OR e.assigned_to = auth.uid()
          OR e.builder_id = auth.uid()
          OR public.is_staff()
        )
    )
    OR actor_id = auth.uid()
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "lead_activities_insert" ON public.lead_activities;
DROP POLICY IF EXISTS "lead_activities_anon_insert" ON public.lead_activities;
CREATE POLICY "lead_activities_anon_insert" ON public.lead_activities
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 4. Robust Contact & General Enquiry RPC
CREATE OR REPLACE FUNCTION public.submit_contact_enquiry(
  p_name        TEXT,
  p_phone       TEXT,
  p_email       TEXT DEFAULT NULL,
  p_message     TEXT DEFAULT NULL,
  p_source      TEXT DEFAULT 'contact_page',
  p_customer_id UUID DEFAULT NULL,
  p_property_id UUID DEFAULT NULL,
  p_tags        TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enquiry_id UUID;
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Name is required');
  END IF;

  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Phone is required');
  END IF;

  INSERT INTO public.enquiries (
    name,
    phone,
    email,
    message,
    source,
    customer_id,
    property_id,
    tags,
    status,
    lead_status,
    priority,
    created_at,
    updated_at
  ) VALUES (
    trim(p_name),
    trim(p_phone),
    NULLIF(trim(p_email), ''),
    NULLIF(trim(p_message), ''),
    COALESCE(p_source, 'contact_page'),
    p_customer_id,
    p_property_id,
    p_tags,
    'new',
    'new',
    'medium',
    now(),
    now()
  )
  RETURNING id INTO v_enquiry_id;

  RETURN jsonb_build_object(
    'success', true,
    'enquiry_id', v_enquiry_id,
    'message', 'Enquiry submitted successfully'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_contact_enquiry(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT[]) TO anon, authenticated, service_role;
