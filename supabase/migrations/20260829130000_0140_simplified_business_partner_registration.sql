/*
  Migration 0140 — Simplified Business Partner Registration

  Adds fields to partner_applications for the streamlined 3-step registration flow:
    - Step 1: surname, name, mobile_number, email, business_name, gst_number, aadhaar_number, pan_number, address
    - Step 2: state, city, district (hierarchical selection)
    - Step 3: business_registration, business_reg_doc_url, aadhaar_doc_url, pan_doc_url, gst_doc_url, bank_account_details

  Updates submit_partner_application RPC to handle simplified payload and duplicate checks.
*/-- 1. Add new columns to partner_applications if they don't already exist
ALTER TABLE public.partner_applications
  ADD COLUMN IF NOT EXISTS surname text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS aadhaar_number text,
  ADD COLUMN IF NOT EXISTS business_registration text,
  ADD COLUMN IF NOT EXISTS bank_account_details jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS aadhaar_doc_url text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

-- 2. Update partner_type check constraint to accept 'Business Partner' and existing types
ALTER TABLE public.partner_applications
  DROP CONSTRAINT IF EXISTS chk_partner_type_allowed;

ALTER TABLE public.partner_applications
  ADD CONSTRAINT chk_partner_type_allowed
  CHECK (partner_type IN (
    'Individual Partner',
    'Plumber',
    'Carpenter',
    'Painter',
    'Packers & Movers',
    'Borewell',
    'Interiors',
    'Rental Agent',
    'Real Estate Agent',
    'Electrician',
    'Loan Agent',
    'Interior Designer',
    'Architect',
    'Property Planner',
    'Building Material Supplier',
    'Property Valuer',
    'Business Partner',
    'Real Estate Consultant',
    'Property Consultant',
    'Broker',
    'Channel Partner',
    'Referral Partner',
    'Corporate Partner',
    'Builder / Developer Partner',
    'Financial Partner',
    'Interior / Home Services Partner',
    'Legal / Documentation Partner',
    'Other'
  ))
  NOT VALID;

-- 3. Update / Replace submit_partner_application RPC
CREATE OR REPLACE FUNCTION public.submit_partner_application(p_application jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application_number text;
  v_mobile text;
  v_full_name text;
  v_partner_type text;
BEGIN
  v_mobile := p_application->>'mobile_number';
  IF v_mobile IS NULL OR v_mobile = '' THEN
    RAISE EXCEPTION 'Mobile number is required.';
  END IF;

  -- Normalize mobile number if needed (+91 prefix)
  IF v_mobile ~ '^[6-9][0-9]{9}$' THEN
    v_mobile := '+91' || v_mobile;
  ELSIF v_mobile ~ '^91[6-9][0-9]{9}$' THEN
    v_mobile := '+' || v_mobile;
  END IF;

  -- Check if an active application already exists for this mobile number
  IF EXISTS (
    SELECT 1 FROM public.partner_applications 
    WHERE mobile_number = v_mobile
      AND status NOT IN ('rejected', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'A partner application already exists for this mobile number. Please contact support if you need assistance.';
  END IF;

  -- Compute combined full_name
  v_full_name := coalesce(
    nullif(trim(concat_ws(' ', p_application->>'name', p_application->>'surname')), ''),
    nullif(p_application->>'full_name', ''),
    p_application->>'name',
    'Business Partner'
  );

  v_partner_type := coalesce(nullif(p_application->>'partner_type', ''), 'Business Partner');

  INSERT INTO public.partner_applications (
    status,
    partner_type,
    surname,
    name,
    full_name,
    mobile_number,
    email,
    business_name,
    company_name,
    gst_number,
    aadhaar_number,
    pan_number,
    address_line_1,
    state,
    city,
    area,
    district,
    google_place_id,
    latitude,
    longitude,
    business_registration,
    bank_account_details,
    business_reg_doc_url,
    aadhaar_doc_url,
    id_doc_url,
    pan_doc_url,
    gst_doc_url,
    address_proof_doc_url
  )
  VALUES (
    'submitted',
    v_partner_type,
    nullif(p_application->>'surname', ''),
    nullif(p_application->>'name', ''),
    v_full_name,
    v_mobile,
    nullif(p_application->>'email', ''),
    nullif(coalesce(p_application->>'business_name', p_application->>'company_name'), ''),
    nullif(coalesce(p_application->>'business_name', p_application->>'company_name'), ''),
    nullif(p_application->>'gst_number', ''),
    nullif(p_application->>'aadhaar_number', ''),
    nullif(p_application->>'pan_number', ''),
    nullif(coalesce(p_application->>'address', p_application->>'address_line_1'), ''),
    nullif(p_application->>'state', ''),
    nullif(p_application->>'city', ''),
    nullif(p_application->>'area', ''),
    nullif(p_application->>'district', ''),
    nullif(p_application->>'google_place_id', ''),
    (p_application->>'latitude')::numeric,
    (p_application->>'longitude')::numeric,
    nullif(p_application->>'business_registration', ''),
    coalesce(p_application->'bank_account_details', '{}'::jsonb),
    nullif(p_application->>'business_reg_doc_url', ''),
    nullif(coalesce(p_application->>'aadhaar_doc_url', p_application->>'id_doc_url'), ''),
    nullif(coalesce(p_application->>'aadhaar_doc_url', p_application->>'id_doc_url'), ''),
    nullif(p_application->>'pan_doc_url', ''),
    nullif(p_application->>'gst_doc_url', ''),
    nullif(p_application->>'address_proof_doc_url', '')
  )
  RETURNING application_number INTO v_application_number;

  RETURN v_application_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_partner_application(jsonb) TO anon, authenticated;
