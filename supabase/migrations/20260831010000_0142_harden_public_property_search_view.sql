-- ============================================================
-- 0142_harden_public_property_search_view.sql
-- Corrective migration from the codebase security audit.
--
-- Fixes in the public search view v_properties_search:
--   1. (CRITICAL data leak) The client's buildPublishedQuery chains several
--      supabase .or() calls; in supabase-js each .or() REPLACES the previous
--      one, so the initial 'status.eq.published,status.eq.live,is_live.eq.true'
--      guard was silently dropped whenever category/purpose/city/locality/
--      possession filters were applied. Result: non-live (draft/rejected/
--      under-review) properties appeared in public search results.
--      FIX: enforce live-only rows directly in the view WHERE clause so no
--      client-side filter chain can ever leak unpublished rows.
--   2. (HIGH PII exposure) The view exposed owner/listed-by phone numbers
--      (COALESCE(p.listed_by_mobile, prof_owner.phone) AS owner_phone) to
--      anonymous callers via GRANT SELECT TO anon. FIX: emit NULL for that
--      column; contact details must be surfaced only through authenticated,
--      intentionally-authorized paths.
-- ============================================================

DROP VIEW IF EXISTS public.v_properties_search;

CREATE OR REPLACE VIEW public.v_properties_search AS
SELECT 
    p.id,
    p.owner_id,
    p.listed_by_user_id,
    NULL::text AS listed_by_mobile,
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
    NULL::text AS owner_phone, -- PII removed from public view (audit finding: v_properties_search exposed owner/listed phone to anon)
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
LEFT JOIN public.profiles prof_owner ON p.owner_id = prof_owner.id
WHERE p.deleted_at IS NULL
  AND p.is_active = true
  AND (
        p.status IN ('published', 'live')
     OR p.approval_status IN ('Approved', 'approved')
     OR p.is_live = true
  );


GRANT SELECT ON public.v_properties_search TO anon, authenticated, service_role;
