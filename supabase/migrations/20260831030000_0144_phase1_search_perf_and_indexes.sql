-- ===========================================================================
-- Phase 1 — Performance hardening: high-performance public search + indexes
-- ===========================================================================
-- Problem
--   v_properties_search.search_text is a COMPUTED view column (7-join concat).
--   The public search path filters it with `search_text ILIKE '%...%'`, which
--   cannot use the existing GIN tsvector index (idx_properties_fts) and forces
--   a sequential scan over the whole 7-join view on every public search.
--
-- Fix (Phase 1.0)
--   * Enable pg_trgm so `%...%` ILIKE patterns can be served by a GIN index.
--   * Add a PHYSICAL generated column `properties.search_document` that mirrors
--     the property-local text the view concatenates, and GIN-index it with
--     pg_trgm. The view is left untouched; the client free-text query is
--     switched to this indexed column. Joined lookup-table names (city_name,
--     locality_name, ...) remain searchable via the structured city_id /
--     locality_id / property_type_id equality filters, which is how the client
--     already filters those dimensions.
--
-- Also (Phase 1.2) adds the missing b-tree indexes on hot lookup/join columns
-- and subscription/package paths reported during the audit.
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- ---------------------------------------------------------------------------
-- 1. Search document generated column + GIN trigram index
-- ---------------------------------------------------------------------------
-- Immutable, deterministic, lowercased: mirrors the property-local portion of
-- the view's search_text (title, description, address, location names, units,
-- status labels, amenities, BHK/Bath tokens, price tokens).
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS search_document text
  GENERATED ALWAYS AS (
    LOWER(
      COALESCE(title, '') || ' ' ||
      COALESCE(description, '') || ' ' ||
      COALESCE(address, '') || ' ' ||
      COALESCE(location_name, '') || ' ' ||
      COALESCE(locality, '') || ' ' ||
      COALESCE(city, '') || ' ' ||
      COALESCE(district, '') || ' ' ||
      COALESCE(area, '') || ' ' ||
      COALESCE(formatted_address, '') || ' ' ||
      COALESCE(pincode, '') || ' ' ||
      COALESCE(property_sub_type, '') || ' ' ||
      COALESCE(listing_category, '') || ' ' ||
      COALESCE(state, '') || ' ' ||
      COALESCE(country, '') || ' ' ||
      COALESCE(facing, '') || ' ' ||
      COALESCE(furnishing, '') || ' ' ||
      COALESCE(possession_status, '') || ' ' ||
      COALESCE(verified_status, '') || ' ' ||
      COALESCE(verification_status, '') || ' ' ||
      CASE WHEN bedrooms IS NOT NULL
        THEN bedrooms::text || ' bhk ' || bedrooms::text || 'bhk ' || bedrooms::text || ' bedroom ' || bedrooms::text || ' bed '
        ELSE '' END ||
      CASE WHEN bathrooms IS NOT NULL
        THEN bathrooms::text || ' bath ' || bathrooms::text || ' bathroom '
        ELSE '' END ||
      CASE WHEN amenities IS NOT NULL AND array_length(amenities, 1) > 0
        THEN array_to_string(amenities, ' ') || ' '
        ELSE '' END ||
      CASE WHEN price > 0 THEN
        CASE
          WHEN price >= 10000000 THEN round(price / 10000000.0, 2)::text || ' cr ' || round(price / 10000000.0, 2)::text || ' crore ' || price::text || ' '
          WHEN price >= 100000   THEN round(price / 100000.0, 2)::text || ' lakh ' || round(price / 100000.0, 2)::text || ' lakhs ' || round(price / 100000.0, 2)::text || 'l ' || price::text || ' '
          ELSE price::text || ' '
        END
        ELSE '' END ||
      CASE WHEN rent_amount > 0 THEN rent_amount::text || ' rent '
        ELSE '' END ||
      CASE WHEN price_per_unit > 0 THEN price_per_unit::text || ' ' || COALESCE(area_unit, '') || ' '
        ELSE '' END ||
      CASE WHEN plot_details IS NOT NULL
        THEN COALESCE(plot_details ->> 'layout_name', '') || ' ' ||
             COALESCE(plot_details ->> 'approval_authority', '') || ' ' ||
             COALESCE(plot_details ->> 'zoning_type', '') || ' '
        ELSE '' END
    ) || ' '
  ) STORED;

-- GIN trigram index: makes `search_document ILIKE '%term%'` index-backed.
CREATE INDEX IF NOT EXISTS idx_properties_search_document_trgm
  ON public.properties USING gin (search_document public.gin_trgm_ops);

-- The legacy GIN tsvector index is dead weight for the ILIKE path. Drop it so a
-- search uses the trigram index instead of scanning. (tsvector/@@ can be
-- re-added later if a dedicated FTS mode is introduced.)
DROP INDEX IF EXISTS public.idx_properties_fts;

-- ---------------------------------------------------------------------------
-- 2. Missing indexes on lookup / join columns (Phase 1.2)
-- ---------------------------------------------------------------------------
-- These tables carry no secondary indexes, yet the public search view joins
-- through their `name` columns on every query.
CREATE INDEX IF NOT EXISTS idx_cities_name ON public.cities (name);
CREATE INDEX IF NOT EXISTS idx_localities_name ON public.localities (name);
CREATE INDEX IF NOT EXISTS idx_localities_city ON public.localities (city_id);
CREATE INDEX IF NOT EXISTS idx_property_types_name ON public.property_types (name);
CREATE INDEX IF NOT EXISTS idx_projects_name ON public.projects (name);
CREATE INDEX IF NOT EXISTS idx_projects_city ON public.projects (city_id);
CREATE INDEX IF NOT EXISTS idx_builders_name ON public.builders (name);

-- Subscription/package hot paths (audit: user_packages, subscription_plans
-- had no secondary indexes on their most-queried columns).
CREATE INDEX IF NOT EXISTS idx_user_packages_user ON public.user_packages (user_id);
CREATE INDEX IF NOT EXISTS idx_user_packages_status ON public.user_packages (status);
CREATE INDEX IF NOT EXISTS idx_user_packages_expiry ON public.user_packages (expiry_date, status);
CREATE INDEX IF NOT EXISTS idx_user_packages_pay_status ON public.user_packages (user_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON public.subscription_plans (slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans (is_active, price);

-- profiles: phone is already UNIQUE; add the lookups used by the dashboard
-- and notification joins (role on profiles only contains partner roles).
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_created ON public.profiles (created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Expose the indexed search_document through v_properties_search
-- ---------------------------------------------------------------------------
-- The view is recreated to ALSO expose p.search_document (a physical, indexed
-- column) so the app's hot free-text ILIKE can be served by the trigram index.
-- The existing composite search_text column is retained untouched for
-- backward compatibility with any other consumers; the app switches its ILIKE
-- filters to search_document.
DROP VIEW IF EXISTS public.v_properties_search;
CREATE VIEW public.v_properties_search AS
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
    p.search_document,
    c.name AS city_name,
    l.name AS locality_name,
    pt.name AS property_type_name,
    pt.category AS property_type_category,
    b.name AS builder_name,
    pr.name AS project_name,
    NULL::text AS owner_phone,
    -- Retro-compatible composite search text (kept for other consumers).
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
