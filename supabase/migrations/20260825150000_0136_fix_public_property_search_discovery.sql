-- =============================================================================
-- Migration: 20260825150000_0136_fix_public_property_search_discovery.sql
-- Description: Self-contained migration ensuring lister tracking columns exist,
--              recreating v_properties_search with exhaustive full-text indexing,
--              granting permissions, and syncing live status for all published properties.
-- =============================================================================

-- 1. Ensure lister tracking columns exist on public.properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS listed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS listed_by_mobile  TEXT,
  ADD COLUMN IF NOT EXISTS is_live           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active         BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS approval_status   TEXT DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS approved_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_properties_listed_by_user_id ON public.properties(listed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_properties_listed_by_mobile ON public.properties(listed_by_mobile);
CREATE INDEX IF NOT EXISTS idx_properties_is_live ON public.properties(is_live);
CREATE INDEX IF NOT EXISTS idx_properties_is_active ON public.properties(is_active);

-- 2. Trigger function to automatically capture lister user and mobile from profile / auth
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
  v_user_id := COALESCE(auth.uid(), NEW.owner_id, NEW.listed_by_user_id);

  IF TG_OP = 'INSERT' THEN
    NEW.listed_by_user_id := COALESCE(NEW.listed_by_user_id, v_user_id);

    IF v_user_id IS NOT NULL THEN
      SELECT phone INTO v_phone FROM public.profiles WHERE id = v_user_id;
      IF v_phone IS NULL OR trim(v_phone) = '' THEN
        SELECT phone INTO v_phone FROM auth.users WHERE id = v_user_id;
      END IF;
    END IF;

    IF v_phone IS NOT NULL AND trim(v_phone) != '' THEN
      NEW.listed_by_mobile := trim(v_phone);
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
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

-- 3. Create or replace v_properties_search with comprehensive full-text indexing
CREATE OR REPLACE VIEW public.v_properties_search AS
SELECT 
    p.id,
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
    p.area_unit,
    p.price_per_unit,
    c.name AS city_name,
    l.name AS locality_name,
    pt.name AS property_type_name,
    pt.category AS property_type_category,
    b.name AS builder_name,
    pr.name AS project_name,
    COALESCE(p.listed_by_mobile, prof_owner.phone) AS owner_phone,
    -- Comprehensive lowercased search text across all fields
    LOWER(
      COALESCE(p.title, '') || ' ' ||
      COALESCE(p.description, '') || ' ' ||
      COALESCE(p.address, '') || ' ' ||
      COALESCE(p.location_name, '') || ' ' ||
      COALESCE(p.locality, '') || ' ' ||
      COALESCE(p.city, '') || ' ' ||
      COALESCE(p.district, '') || ' ' ||
      COALESCE(p.area, '') || ' ' ||
      COALESCE(p.formatted_address, '') || ' ' ||
      COALESCE(p.pincode, '') || ' ' ||
      COALESCE(c.name, '') || ' ' ||
      COALESCE(l.name, '') || ' ' ||
      COALESCE(pt.name, '') || ' ' ||
      COALESCE(pt.category, '') || ' ' ||
      COALESCE(b.name, '') || ' ' ||
      COALESCE(pr.name, '') || ' ' ||
      COALESCE(p.property_sub_type, '') || ' ' ||
      COALESCE(p.listing_category, '') || ' ' ||
      COALESCE(prof_agent.first_name, '') || ' ' ||
      COALESCE(prof_agent.last_name, '') || ' ' ||
      COALESCE(prof_owner.first_name, '') || ' ' ||
      COALESCE(prof_owner.last_name, '') || ' ' ||
      COALESCE(p.state, '') || ' ' ||
      COALESCE(p.country, '') || ' ' ||
      COALESCE(p.facing, '') || ' ' ||
      COALESCE(p.furnishing, '') || ' ' ||
      COALESCE(p.possession_status, '') || ' ' ||
      COALESCE(p.verified_status, '') || ' ' ||
      COALESCE(p.verification_status, '') || ' ' ||
      CASE
        WHEN p.bedrooms IS NOT NULL THEN (p.bedrooms::text || ' BHK ' || p.bedrooms::text || 'BHK ' || p.bedrooms::text || ' bedroom ' || p.bedrooms::text || ' bed ')
        ELSE ''
      END ||
      CASE
        WHEN p.bathrooms IS NOT NULL THEN (p.bathrooms::text || ' Bath ' || p.bathrooms::text || ' Bathroom ')
        ELSE ''
      END ||
      CASE
        WHEN p.amenities IS NOT NULL AND array_length(p.amenities, 1) > 0 THEN (array_to_string(p.amenities, ' ') || ' ')
        ELSE ''
      END ||
      CASE
        WHEN p.price > 0 THEN
          CASE
            WHEN p.price >= 10000000 THEN ((round(p.price / 10000000.0, 2)::text || ' Cr ' || round(p.price / 10000000.0, 2)::text || ' Crore ' || p.price::text) || ' ')
            WHEN p.price >= 100000 THEN ((round(p.price / 100000.0, 2)::text || ' Lakh ' || round(p.price / 100000.0, 2)::text || ' Lakhs ' || round(p.price / 100000.0, 2)::text || 'L ' || p.price::text) || ' ')
            ELSE (p.price::text || ' ')
          END
        ELSE ''
      END ||
      CASE
        WHEN p.rent_amount > 0 THEN (p.rent_amount::text || ' rent ')
        ELSE ''
      END ||
      CASE
        WHEN p.price_per_unit > 0 THEN (p.price_per_unit::text || ' ' || COALESCE(p.area_unit, '') || ' ')
        ELSE ''
      END ||
      CASE
        WHEN p.plot_details IS NOT NULL THEN (COALESCE(p.plot_details ->> 'layout_name', '') || ' ' || COALESCE(p.plot_details ->> 'approval_authority', '') || ' ' || COALESCE(p.plot_details ->> 'zoning_type', '') || ' ')
        ELSE ''
      END
    ) AS search_text
FROM public.properties p
LEFT JOIN public.cities c ON p.city_id = c.id
LEFT JOIN public.localities l ON p.locality_id = l.id
LEFT JOIN public.property_types pt ON p.property_type_id = pt.id
LEFT JOIN public.builders b ON p.builder_id = b.id
LEFT JOIN public.projects pr ON p.project_id = pr.id
LEFT JOIN public.profiles prof_agent ON p.assigned_agent_id = prof_agent.id
LEFT JOIN public.profiles prof_owner ON p.owner_id = prof_owner.id;

-- 4. Grant permissions on view
GRANT SELECT ON public.v_properties_search TO anon, authenticated, service_role;

-- 5. Backfill lister mobile & sync published properties live flags
UPDATE public.properties p
SET
  listed_by_user_id = COALESCE(p.listed_by_user_id, p.owner_id),
  listed_by_mobile = COALESCE(
    NULLIF(trim(p.listed_by_mobile), ''),
    NULLIF(trim(prof.phone), '')
  ),
  is_live = true,
  is_active = true,
  deleted_at = NULL,
  published_at = COALESCE(p.published_at, p.approved_at, p.created_at, now())
FROM public.profiles prof
WHERE p.owner_id = prof.id
  AND (p.status IN ('published', 'live') OR p.approval_status = 'Approved');

-- 6. Also sync any published properties where owner profile join wasn't matched
UPDATE public.properties
SET 
  is_live = true,
  is_active = true,
  deleted_at = NULL,
  published_at = COALESCE(published_at, approved_at, created_at, now())
WHERE status IN ('published', 'live') OR approval_status = 'Approved';
