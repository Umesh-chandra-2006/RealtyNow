-- =============================================================================
-- Migration: 20260825140000_0135_track_property_lister_mobile.sql
-- Description: Track property lister mobile number automatically from the
--              authenticated user account / profile without requiring manual re-entry.
--              Includes DB columns, automatic trigger, backfill, view, and RPC updates.
-- =============================================================================

-- 1. Add lister tracking columns to public.properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS listed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS listed_by_mobile  TEXT;

CREATE INDEX IF NOT EXISTS idx_properties_listed_by_user_id ON public.properties(listed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_properties_listed_by_mobile ON public.properties(listed_by_mobile);

-- 2. Trigger function to automatically resolve and capture lister user and mobile from profile / auth
CREATE OR REPLACE FUNCTION public.fn_track_property_lister_mobile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_user_id UUID;
BEGIN
  -- Resolve user id: current authenticated user -> owner_id -> listed_by_user_id
  v_user_id := COALESCE(auth.uid(), NEW.owner_id, NEW.listed_by_user_id);

  IF TG_OP = 'INSERT' THEN
    NEW.listed_by_user_id := COALESCE(NEW.listed_by_user_id, v_user_id);

    -- Retrieve registered mobile from profiles first, fallback to auth.users
    IF v_user_id IS NOT NULL THEN
      SELECT phone INTO v_phone FROM public.profiles WHERE id = v_user_id;
      IF v_phone IS NULL OR trim(v_phone) = '' THEN
        SELECT phone INTO v_phone FROM auth.users WHERE id = v_user_id;
      END IF;
    END IF;

    -- Store resolved registered mobile
    IF v_phone IS NOT NULL AND trim(v_phone) != '' THEN
      NEW.listed_by_mobile := trim(v_phone);
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- On edit, preserve the original lister identity and mobile unless it was null
    NEW.listed_by_user_id := COALESCE(OLD.listed_by_user_id, NEW.listed_by_user_id, NEW.owner_id);

    IF OLD.listed_by_mobile IS NOT NULL AND trim(OLD.listed_by_mobile) != '' THEN
      NEW.listed_by_mobile := OLD.listed_by_mobile;
    ELSE
      v_user_id := COALESCE(NEW.listed_by_user_id, NEW.owner_id);
      IF v_user_id IS NOT NULL THEN
        SELECT phone INTO v_phone FROM public.profiles WHERE id = v_user_id;
        IF v_phone IS NULL OR trim(v_phone) = '' THEN
          SELECT phone INTO v_phone FROM auth.users WHERE id = v_user_id;
        END IF;
      END IF;

      IF v_phone IS NOT NULL AND trim(v_phone) != '' THEN
        NEW.listed_by_mobile := trim(v_phone);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_property_lister_mobile ON public.properties;
CREATE TRIGGER trg_track_property_lister_mobile
  BEFORE INSERT OR UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_track_property_lister_mobile();

-- 3. Backfill existing properties from profiles / auth.users
UPDATE public.properties p
SET
  listed_by_user_id = COALESCE(p.listed_by_user_id, p.owner_id),
  listed_by_mobile = COALESCE(
    NULLIF(trim(p.listed_by_mobile), ''),
    NULLIF(trim(pr.phone), ''),
    NULLIF(trim(u.phone), '')
  )
FROM public.profiles pr
LEFT JOIN auth.users u ON pr.id = u.id
WHERE p.owner_id = pr.id
  AND (p.listed_by_mobile IS NULL OR p.listed_by_mobile = '' OR p.listed_by_user_id IS NULL);

-- 4. Recreate v_properties_search with listed_by_mobile & listed_by_user_id
CREATE OR REPLACE VIEW public.v_properties_search AS
 SELECT p.id,
    p.owner_id,
    p.listed_by_user_id,
    p.listed_by_mobile,
    p.title,
    p.description,
    p.property_type_id,
    p.purpose,
    p.city_id,
    p.locality_id,
    p.address,
    p.latitude,
    p.longitude,
    p.price,
    p.rent_amount,
    p.security_deposit,
    p.bedrooms,
    p.bathrooms,
    p.balconies,
    p.floor_number,
    p.total_floors,
    p.built_up_area,
    p.carpet_area,
    p.plot_area,
    p.facing,
    p.furnishing,
    p.parking,
    p.age_of_property,
    p.ownership_type,
    p.legal_approved,
    p.amenities,
    p.features,
    p.images,
    p.videos,
    p.floor_plans,
    p.documents,
    p.builder_id,
    p.project_id,
    p.status,
    p.is_featured,
    p.is_luxury,
    p.view_count,
    p.ai_description,
    p.ai_seo,
    p.ai_tags,
    p.assigned_agent_id,
    p.rejection_reason,
    p.published_at,
    p.created_at,
    p.updated_at,
    p.listing_category,
    p.property_sub_type,
    p.pg_details,
    p.nearby_places,
    p.seo_metadata,
    p.availability_details,
    p.ownership_details,
    p.media_urls,
    p.approval_status,
    p.is_live,
    p.approved_by,
    p.approved_at,
    p.reviewed_by,
    p.reviewed_at,
    p.has_virtual_tour,
    p.virtual_tour_cover,
    p.virtual_tour_count,
    p.super_area,
    p.building_area,
    p.wall_area,
    p.usable_area,
    p.indoor_parking,
    p.outdoor_parking,
    p.road_width,
    p.corner_plot,
    p.water_supply,
    p.power_backup,
    p.lift,
    p.security_type,
    p.nearby_locations,
    p.listing_validity,
    p.expires_at,
    p.renewal_count,
    p.last_renewed_at,
    p.verified_by,
    p.verified_at,
    p.verification_notes,
    p.seo_title,
    p.seo_description,
    p.seo_keywords,
    p.property_code,
    p.source,
    p.language,
    p.current_step,
    p.completed_steps,
    p.draft_data,
    p.completion_percentage,
    p.is_draft,
    p.last_saved_at,
    p.possession_status,
    p.verified_status,
    p.ai_score,
    p.state,
    p.country,
    p.place_id,
    p.verification_status,
    p.ai_verified_at,
    p.pincode,
    p.seo_slug,
    p.og_title,
    p.og_description,
    p.og_image,
    p.twitter_title,
    p.twitter_description,
    p.twitter_image,
    p.canonical_url,
    p.json_ld,
    p.image_alt_text,
    p.seo_generated_at,
    p.location_name,
    p.area,
    p.locality,
    p.city,
    p.district,
    p.formatted_address,
    p.submission_id,
    p.cover_image_url,
    p.change_request_reason,
    p.change_requested_at,
    p.plot_details,
    p.is_active,
    p.deleted_at,
    c.name AS city_name,
    l.name AS locality_name,
    pt.name AS property_type_name,
    pt.category AS property_type_category,
    b.name AS builder_name,
    pr.name AS project_name,
    COALESCE(p.listed_by_mobile, prof_owner.phone) AS owner_phone,
    ((((((((((((((((((((((((((((((((((((((((((((((COALESCE(p.title, ''::text) || ' '::text) || COALESCE(p.description, ''::text)) || ' '::text) || COALESCE(p.address, ''::text)) || ' '::text) || COALESCE(p.pincode, ''::text)) || ' '::text) || COALESCE(c.name, ''::text)) || ' '::text) || COALESCE(l.name, ''::text)) || ' '::text) || COALESCE(pt.name, ''::text)) || ' '::text) || COALESCE(pt.category, ''::text)) || ' '::text) || COALESCE(b.name, ''::text)) || ' '::text) || COALESCE(pr.name, ''::text)) || ' '::text) || COALESCE(prof_agent.first_name, ''::text)) || ' '::text) || COALESCE(prof_agent.last_name, ''::text)) || ' '::text) || COALESCE(prof_owner.first_name, ''::text)) || ' '::text) || COALESCE(prof_owner.last_name, ''::text)) || ' '::text) || COALESCE(p.state, ''::text)) || ' '::text) || COALESCE(p.country, ''::text)) || ' '::text) || COALESCE(p.facing, ''::text)) || ' '::text) || COALESCE(p.furnishing, ''::text)) || ' '::text) || COALESCE(p.possession_status, ''::text)) || ' '::text) || COALESCE(p.verified_status, ''::text)) || ' '::text) || COALESCE(p.verification_status, ''::text)) || ' '::text) ||
        CASE
            WHEN p.bedrooms IS NOT NULL THEN ((((((p.bedrooms::text || ' BHK '::text) || p.bedrooms::text) || 'BHK '::text) || p.bedrooms::text) || ' bedroom '::text) || p.bedrooms::text) || ' bed '::text
            ELSE ''::text
        END) ||
        CASE
            WHEN p.bathrooms IS NOT NULL THEN ((p.bathrooms::text || ' Bath '::text) || p.bathrooms::text) || ' Bathroom '::text
            ELSE ''::text
        END) ||
        CASE
            WHEN p.amenities IS NOT NULL AND array_length(p.amenities, 1) > 0 THEN array_to_string(p.amenities, ' '::text) || ' '::text
            ELSE ''::text
        END) ||
        CASE
            WHEN p.price > 0::numeric THEN
            CASE
                WHEN p.price >= 10000000::numeric THEN ((((((round(p.price / 10000000.0, 2)::text || ' Cr '::text) || round(p.price / 10000000.0, 2)::text) || ' Crore '::text) || round(p.price / 10000000.0, 2)::text) || 'Cr '::text) || p.price::text) || ' '::text
                WHEN p.price >= 100000::numeric THEN ((((((((round(p.price / 100000.0, 2)::text || ' Lakh '::text) || round(p.price / 100000.0, 2)::text) || ' Lakhs '::text) || round(p.price / 100000.0, 2)::text) || 'L '::text) || round(p.price / 100000.0, 2)::text) || 'Lac '::text) || p.price::text) || ' '::text
                ELSE p.price::text || ' '::text
            END
            ELSE ''::text
        END) ||
        CASE
            WHEN p.purpose = 'Rent'::text AND p.rent_amount > 0::numeric THEN p.rent_amount::text || ' rent '::text
            ELSE ''::text
        END) ||
        CASE
            WHEN p.plot_details IS NOT NULL THEN ((((COALESCE(p.plot_details ->> 'layout_name'::text, ''::text) || ' '::text) || COALESCE(p.plot_details ->> 'approval_authority'::text, ''::text)) || ' '::text) || COALESCE(p.plot_details ->> 'zoning_type'::text, ''::text)) || ' '::text
            ELSE ''::text
        END AS search_text,
    p.area_unit,
    p.price_per_unit
   FROM properties p
     LEFT JOIN cities c ON p.city_id = c.id
     LEFT JOIN localities l ON p.locality_id = l.id
     LEFT JOIN property_types pt ON p.property_type_id = pt.id
     LEFT JOIN builders b ON p.builder_id = b.id
     LEFT JOIN projects pr ON p.project_id = pr.id
     LEFT JOIN profiles prof_agent ON p.assigned_agent_id = prof_agent.id
     LEFT JOIN profiles prof_owner ON p.owner_id = prof_owner.id;

-- 5. Update admin_get_properties RPC helper to return listed_by_mobile and listed_by_user_id
DROP FUNCTION IF EXISTS public.admin_get_properties();
CREATE OR REPLACE FUNCTION public.admin_get_properties()
RETURNS TABLE (
  id uuid,
  owner_id uuid,
  listed_by_user_id uuid,
  listed_by_mobile text,
  title text,
  description text,
  property_type_id uuid,
  purpose text,
  city_id uuid,
  locality_id uuid,
  address text,
  latitude numeric,
  longitude numeric,
  price numeric,
  rent_amount numeric,
  security_deposit numeric,
  bedrooms int,
  bathrooms int,
  balconies int,
  floor_number int,
  total_floors int,
  built_up_area numeric,
  carpet_area numeric,
  facing text,
  furnishing text,
  parking int,
  amenities text[],
  features jsonb,
  images jsonb,
  videos jsonb,
  documents jsonb,
  status text,
  approval_status text,
  is_live boolean,
  is_featured boolean,
  is_luxury boolean,
  view_count int,
  ai_description text,
  ai_seo text,
  assigned_agent_id uuid,
  rejection_reason text,
  published_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  city_name text,
  locality_name text,
  property_type_name text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    p.id,
    p.owner_id,
    p.listed_by_user_id,
    COALESCE(p.listed_by_mobile, prof_owner.phone) AS listed_by_mobile,
    p.title,
    p.description,
    p.property_type_id,
    p.purpose,
    p.city_id,
    p.locality_id,
    p.address,
    p.latitude,
    p.longitude,
    p.price,
    p.rent_amount,
    p.security_deposit,
    p.bedrooms,
    p.bathrooms,
    p.balconies,
    p.floor_number,
    p.total_floors,
    p.built_up_area,
    p.carpet_area,
    p.facing,
    p.furnishing,
    p.parking,
    p.amenities,
    p.features,
    p.images,
    p.videos,
    p.documents,
    p.status,
    p.approval_status,
    p.is_live,
    p.is_featured,
    p.is_luxury,
    p.view_count,
    p.ai_description,
    p.ai_seo,
    p.assigned_agent_id,
    p.rejection_reason,
    p.published_at,
    p.approved_at,
    p.created_at,
    p.updated_at,
    c.name as city_name,
    l.name as locality_name,
    pt.name as property_type_name
  FROM public.properties p
  LEFT JOIN public.cities c ON p.city_id = c.id
  LEFT JOIN public.localities l ON p.locality_id = l.id
  LEFT JOIN public.property_types pt ON p.property_type_id = pt.id
  LEFT JOIN public.profiles prof_owner ON p.owner_id = prof_owner.id;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_properties() TO authenticated, service_role;
