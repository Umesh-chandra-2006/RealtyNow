-- =============================================================================
-- Migration: 20260824170000_0134_master_service_leads_crm.sql
-- Description: Full Master Service Leads CRM Architecture:
--              Auto-generated Lead Numbers (RN-LEAD-XXXXXX), standard service types,
--              rich service metadata JSONB, timeline activity logging, RLS and RPCs.
-- =============================================================================

-- 1. Ensure lead number sequence
CREATE SEQUENCE IF NOT EXISTS public.lead_number_seq START WITH 1001;

-- 2. Add/ensure all CRM and service fields in public.enquiries
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS lead_number        TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS service_type       TEXT DEFAULT 'GENERAL_ENQUIRY',
  ADD COLUMN IF NOT EXISTS alternate_phone    TEXT,
  ADD COLUMN IF NOT EXISTS city               TEXT,
  ADD COLUMN IF NOT EXISTS state              TEXT,
  ADD COLUMN IF NOT EXISTS location           TEXT,
  ADD COLUMN IF NOT EXISTS service_request    TEXT,
  ADD COLUMN IF NOT EXISTS service_data       JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS priority           TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS lead_status        TEXT DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS follow_up_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_contacted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_fields      JSONB DEFAULT '{}'::jsonb;

-- Ensure lead_status check constraint supports all CRM statuses
ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS enquiries_lead_status_check;
ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_lead_status_check
  CHECK (lead_status IN ('new','assigned','contacted','follow_up','in_progress','qualified','site_visit','negotiation','converted','won','lost','closed','spam','duplicate'));

-- 3. Function and trigger to automatically assign RN-LEAD-XXXXXX if lead_number is NULL
CREATE OR REPLACE FUNCTION public.fn_generate_lead_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.lead_number IS NULL OR trim(NEW.lead_number) = '' THEN
    NEW.lead_number := 'RN-LEAD-' || lpad(nextval('public.lead_number_seq')::text, 6, '0');
  END IF;

  -- Default service_type if not provided
  IF NEW.service_type IS NULL OR trim(NEW.service_type) = '' THEN
    IF NEW.source LIKE '%home_loans%' OR 'home-loan' = ANY(COALESCE(NEW.tags, '{}'::text[])) THEN
      NEW.service_type := 'HOME_LOANS';
    ELSIF NEW.source LIKE '%borewell%' OR 'borewell-services' = ANY(COALESCE(NEW.tags, '{}'::text[])) THEN
      NEW.service_type := 'BOREWELL_SERVICES';
    ELSIF NEW.source LIKE '%legal%' OR 'legal services' = ANY(COALESCE(NEW.tags, '{}'::text[])) THEN
      NEW.service_type := 'LEGAL_SERVICES';
    ELSIF NEW.source LIKE '%packers%' OR 'packers and movers' = ANY(COALESCE(NEW.tags, '{}'::text[])) THEN
      NEW.service_type := 'PACKERS_MOVERS';
    ELSIF NEW.source LIKE '%pest%' OR 'pest control' = ANY(COALESCE(NEW.tags, '{}'::text[])) THEN
      NEW.service_type := 'PEST_CONTROL';
    ELSIF NEW.source LIKE '%painting%' OR 'painting' = ANY(COALESCE(NEW.tags, '{}'::text[])) THEN
      NEW.service_type := 'PAINTING';
    ELSIF NEW.source LIKE '%cleaning%' OR 'cleaning' = ANY(COALESCE(NEW.tags, '{}'::text[])) THEN
      NEW.service_type := 'CLEANING';
    ELSIF NEW.source LIKE '%interior%' OR 'interior services' = ANY(COALESCE(NEW.tags, '{}'::text[])) THEN
      NEW.service_type := 'INTERIOR_SERVICES';
    ELSIF NEW.source LIKE '%home_services%' OR 'home services' = ANY(COALESCE(NEW.tags, '{}'::text[])) THEN
      NEW.service_type := 'HOME_SERVICES';
    ELSE
      NEW.service_type := 'GENERAL_ENQUIRY';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_lead_number ON public.enquiries;
CREATE TRIGGER trg_generate_lead_number
  BEFORE INSERT ON public.enquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_generate_lead_number();

-- Backfill existing leads with lead_number and service_type
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, source, tags FROM public.enquiries WHERE lead_number IS NULL ORDER BY created_at ASC LOOP
    UPDATE public.enquiries
    SET
      lead_number = 'RN-LEAD-' || lpad(nextval('public.lead_number_seq')::text, 6, '0'),
      service_type = CASE
        WHEN r.source LIKE '%home_loans%' OR 'home-loan' = ANY(COALESCE(r.tags, '{}'::text[])) THEN 'HOME_LOANS'
        WHEN r.source LIKE '%borewell%' OR 'borewell-services' = ANY(COALESCE(r.tags, '{}'::text[])) THEN 'BOREWELL_SERVICES'
        WHEN r.source LIKE '%legal%' OR 'legal services' = ANY(COALESCE(r.tags, '{}'::text[])) THEN 'LEGAL_SERVICES'
        WHEN r.source LIKE '%packers%' OR 'packers and movers' = ANY(COALESCE(r.tags, '{}'::text[])) THEN 'PACKERS_MOVERS'
        WHEN r.source LIKE '%pest%' OR 'pest control' = ANY(COALESCE(r.tags, '{}'::text[])) THEN 'PEST_CONTROL'
        WHEN r.source LIKE '%painting%' OR 'painting' = ANY(COALESCE(r.tags, '{}'::text[])) THEN 'PAINTING'
        WHEN r.source LIKE '%cleaning%' OR 'cleaning' = ANY(COALESCE(r.tags, '{}'::text[])) THEN 'CLEANING'
        WHEN r.source LIKE '%interior%' OR 'interior services' = ANY(COALESCE(r.tags, '{}'::text[])) THEN 'INTERIOR_SERVICES'
        WHEN r.source LIKE '%home_services%' OR 'home services' = ANY(COALESCE(r.tags, '{}'::text[])) THEN 'HOME_SERVICES'
        ELSE 'GENERAL_ENQUIRY'
      END
    WHERE id = r.id;
  END LOOP;
END $$;

-- 4. Create standard indexes for CRM querying & filtering
CREATE INDEX IF NOT EXISTS idx_enquiries_lead_number ON public.enquiries(lead_number);
CREATE INDEX IF NOT EXISTS idx_enquiries_service_type ON public.enquiries(service_type);
CREATE INDEX IF NOT EXISTS idx_enquiries_priority ON public.enquiries(priority);
CREATE INDEX IF NOT EXISTS idx_enquiries_lead_status ON public.enquiries(lead_status);
CREATE INDEX IF NOT EXISTS idx_enquiries_follow_up_at ON public.enquiries(follow_up_at);
CREATE INDEX IF NOT EXISTS idx_enquiries_created_at_desc ON public.enquiries(created_at DESC);

-- 5. Drop previous versions of submit_contact_enquiry to avoid signature ambiguity
DROP FUNCTION IF EXISTS public.submit_contact_enquiry(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT[]);
DROP FUNCTION IF EXISTS public.submit_contact_enquiry(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT[], TEXT, JSONB, TEXT, TEXT, TEXT);

-- 6. Enhanced submit_contact_enquiry RPC supporting service_type and service_data JSONB
CREATE OR REPLACE FUNCTION public.submit_contact_enquiry(
  p_name            TEXT,
  p_phone           TEXT,
  p_email           TEXT DEFAULT NULL,
  p_message         TEXT DEFAULT NULL,
  p_source          TEXT DEFAULT 'website',
  p_customer_id     UUID DEFAULT NULL,
  p_property_id     UUID DEFAULT NULL,
  p_tags            TEXT[] DEFAULT NULL,
  p_service_type    TEXT DEFAULT NULL,
  p_service_data    JSONB DEFAULT '{}'::jsonb,
  p_city            TEXT DEFAULT NULL,
  p_location        TEXT DEFAULT NULL,
  p_alternate_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enquiry_id   UUID;
  v_lead_number  TEXT;
  v_service_type TEXT;
  v_source       TEXT;
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Name is required');
  END IF;

  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Phone is required');
  END IF;

  -- Ensure valid source adhering to check constraint ('website','portal','whatsapp','referral','direct','campaign','social','walk_in','call','import')
  v_source := CASE
    WHEN p_source IN ('website','portal','whatsapp','referral','direct','campaign','social','walk_in','call','import') THEN p_source
    ELSE 'website'
  END;

  v_service_type := COALESCE(
    NULLIF(trim(p_service_type), ''),
    CASE
      WHEN p_source LIKE '%home_loans%' OR 'home-loan' = ANY(COALESCE(p_tags, '{}'::text[])) OR 'HOME_LOANS' = ANY(COALESCE(p_tags, '{}'::text[])) THEN 'HOME_LOANS'
      WHEN p_source LIKE '%borewell%' OR 'borewell-services' = ANY(COALESCE(p_tags, '{}'::text[])) OR 'BOREWELL_SERVICES' = ANY(COALESCE(p_tags, '{}'::text[])) THEN 'BOREWELL_SERVICES'
      WHEN p_source LIKE '%legal%' OR 'legal services' = ANY(COALESCE(p_tags, '{}'::text[])) OR 'LEGAL_SERVICES' = ANY(COALESCE(p_tags, '{}'::text[])) THEN 'LEGAL_SERVICES'
      WHEN p_source LIKE '%packers%' OR 'packers and movers' = ANY(COALESCE(p_tags, '{}'::text[])) OR 'PACKERS_MOVERS' = ANY(COALESCE(p_tags, '{}'::text[])) THEN 'PACKERS_MOVERS'
      WHEN p_source LIKE '%pest%' OR 'pest control' = ANY(COALESCE(p_tags, '{}'::text[])) OR 'PEST_CONTROL' = ANY(COALESCE(p_tags, '{}'::text[])) THEN 'PEST_CONTROL'
      WHEN p_source LIKE '%painting%' OR 'painting' = ANY(COALESCE(p_tags, '{}'::text[])) OR 'PAINTING' = ANY(COALESCE(p_tags, '{}'::text[])) THEN 'PAINTING'
      WHEN p_source LIKE '%cleaning%' OR 'cleaning' = ANY(COALESCE(p_tags, '{}'::text[])) OR 'CLEANING' = ANY(COALESCE(p_tags, '{}'::text[])) THEN 'CLEANING'
      WHEN p_source LIKE '%interior%' OR 'interior services' = ANY(COALESCE(p_tags, '{}'::text[])) OR 'INTERIOR_SERVICES' = ANY(COALESCE(p_tags, '{}'::text[])) THEN 'INTERIOR_SERVICES'
      WHEN p_source LIKE '%home_services%' OR 'home services' = ANY(COALESCE(p_tags, '{}'::text[])) OR 'HOME_SERVICES' = ANY(COALESCE(p_tags, '{}'::text[])) THEN 'HOME_SERVICES'
      ELSE 'GENERAL_ENQUIRY'
    END
  );

  INSERT INTO public.enquiries (
    name,
    phone,
    email,
    message,
    service_request,
    source,
    customer_id,
    property_id,
    tags,
    service_type,
    service_data,
    city,
    location,
    alternate_phone,
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
    NULLIF(trim(p_message), ''),
    v_source,
    p_customer_id,
    p_property_id,
    p_tags,
    v_service_type,
    COALESCE(p_service_data, '{}'::jsonb),
    NULLIF(trim(p_city), ''),
    NULLIF(trim(p_location), ''),
    NULLIF(trim(p_alternate_phone), ''),
    'new',
    'new',
    'medium',
    now(),
    now()
  )
  RETURNING id, lead_number INTO v_enquiry_id, v_lead_number;

  -- Create initial creation activity in lead_activities
  BEGIN
    INSERT INTO public.lead_activities (
      lead_id,
      activity_type,
      title,
      description,
      is_system,
      created_at
    ) VALUES (
      v_enquiry_id,
      'created',
      'Lead Generated',
      'Lead #' || COALESCE(v_lead_number, v_enquiry_id::text) || ' received via ' || v_source || ' (' || v_service_type || ')',
      true,
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'enquiry_id', v_enquiry_id,
    'lead_number', v_lead_number,
    'service_type', v_service_type,
    'message', 'Enquiry submitted successfully'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_contact_enquiry(
  TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT[], TEXT, JSONB, TEXT, TEXT, TEXT
) TO anon, authenticated, service_role;
