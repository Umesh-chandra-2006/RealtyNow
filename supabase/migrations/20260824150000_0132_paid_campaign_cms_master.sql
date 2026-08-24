-- ==============================================================================
-- Migration: 0132_paid_campaign_cms_master.sql
-- Description: Centralized Paid Campaign CMS Engine for RealtyNow
-- Manages:
--   1. FEATURED_PROPERTIES
--   2. TWO_COLUMN_SLIDER
--   3. EXPLORE_BUILDERS
--   4. SIGNATURE_COLLECTION
--   5. THREE_COLUMN_PROPERTIES
--   6. REALTYNOW_EXCLUSIVE
-- ==============================================================================

-- 1. Main Paid Campaigns Table
CREATE TABLE IF NOT EXISTS public.paid_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_type TEXT NOT NULL CHECK (campaign_type IN (
    'FEATURED_PROPERTIES',
    'TWO_COLUMN_SLIDER',
    'EXPLORE_BUILDERS',
    'SIGNATURE_COLLECTION',
    'THREE_COLUMN_PROPERTIES',
    'REALTYNOW_EXCLUSIVE'
  )),
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  badge_label TEXT,
  cta_label TEXT,
  cta_url TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'EXPIRED', 'INACTIVE')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  display_order INTEGER NOT NULL DEFAULT 1,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Campaign Items (Relationship to master properties / builders / projects)
CREATE TABLE IF NOT EXISTS public.paid_campaign_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.paid_campaigns(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  builder_id UUID REFERENCES public.builders(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title_override TEXT,
  subtitle_override TEXT,
  image_override TEXT,
  badge_override TEXT,
  cta_label TEXT,
  cta_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Campaign Analytics / Events (Impressions, Clicks, Enquiries)
CREATE TABLE IF NOT EXISTS public.paid_campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.paid_campaigns(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('IMPRESSION', 'CLICK', 'CTA_CLICK', 'WHATSAPP_CLICK', 'ENQUIRY')),
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  session_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for lightning fast querying
CREATE INDEX IF NOT EXISTS idx_paid_campaigns_type_active_order ON public.paid_campaigns(campaign_type, is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_paid_campaign_items_campaign_order ON public.paid_campaign_items(campaign_id, display_order);
CREATE INDEX IF NOT EXISTS idx_paid_campaign_items_property ON public.paid_campaign_items(property_id);
CREATE INDEX IF NOT EXISTS idx_paid_campaign_items_builder ON public.paid_campaign_items(builder_id);
CREATE INDEX IF NOT EXISTS idx_paid_campaign_events_campaign ON public.paid_campaign_events(campaign_id, event_type);

-- Enable RLS
ALTER TABLE public.paid_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paid_campaign_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paid_campaign_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public can read active eligible campaigns
DROP POLICY IF EXISTS "paid_campaigns_public_select" ON public.paid_campaigns;
CREATE POLICY "paid_campaigns_public_select" ON public.paid_campaigns
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "paid_campaign_items_public_select" ON public.paid_campaign_items;
CREATE POLICY "paid_campaign_items_public_select" ON public.paid_campaign_items
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "paid_campaigns_admin_all" ON public.paid_campaigns;
CREATE POLICY "paid_campaigns_admin_all" ON public.paid_campaigns
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "paid_campaign_items_admin_all" ON public.paid_campaign_items;
CREATE POLICY "paid_campaign_items_admin_all" ON public.paid_campaign_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "paid_campaign_events_insert" ON public.paid_campaign_events;
CREATE POLICY "paid_campaign_events_insert" ON public.paid_campaign_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "paid_campaign_events_admin_select" ON public.paid_campaign_events;
CREATE POLICY "paid_campaign_events_admin_select" ON public.paid_campaign_events
  FOR SELECT TO authenticated
  USING (true);

-- 4. Automatic Safe Migration: Migrate existing featured_properties into paid_campaigns
DO $$
DECLARE
  f_row RECORD;
  c_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'featured_properties') THEN
    FOR f_row IN (
      SELECT fp.*, p.title as prop_title
      FROM public.featured_properties fp
      LEFT JOIN public.properties p ON fp.property_id = p.id
      ORDER BY fp.display_order ASC
    ) LOOP
      -- Check if already migrated
      IF NOT EXISTS (
        SELECT 1 FROM public.paid_campaign_items pci
        JOIN public.paid_campaigns pc ON pci.campaign_id = pc.id
        WHERE pc.campaign_type = 'FEATURED_PROPERTIES' AND pci.property_id = f_row.property_id
      ) THEN
        INSERT INTO public.paid_campaigns (
          campaign_type, title, status, is_active, priority, display_order, start_at, end_at, created_by, created_at, updated_at
        ) VALUES (
          'FEATURED_PROPERTIES',
          COALESCE(f_row.prop_title, 'Featured Property Listing'),
          CASE WHEN f_row.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END,
          f_row.is_active,
          COALESCE(f_row.priority, 'Medium'),
          f_row.display_order,
          f_row.start_at,
          f_row.end_at,
          f_row.created_by,
          COALESCE(f_row.created_at, now()),
          COALESCE(f_row.updated_at, now())
        ) RETURNING id INTO c_id;

        INSERT INTO public.paid_campaign_items (
          campaign_id, property_id, display_order, is_active, created_at, updated_at
        ) VALUES (
          c_id,
          f_row.property_id,
          f_row.display_order,
          f_row.is_active,
          COALESCE(f_row.created_at, now()),
          COALESCE(f_row.updated_at, now())
        );
      END IF;
    END LOOP;
  END IF;
END $$;

-- 5. Seed default promotional campaigns for the other 5 categories if empty
DO $$
DECLARE
  c_id UUID;
  p_row RECORD;
  b_row RECORD;
  idx INTEGER := 1;
BEGIN
  -- Seed TWO_COLUMN_SLIDER if empty
  IF NOT EXISTS (SELECT 1 FROM public.paid_campaigns WHERE campaign_type = 'TWO_COLUMN_SLIDER') THEN
    INSERT INTO public.paid_campaigns (campaign_type, title, subtitle, badge_label, cta_label, cta_url, image_url, display_order, is_active, priority)
    VALUES
      ('TWO_COLUMN_SLIDER', 'Ultra-Luxury Penthouses in South Mumbai', 'Starting from ₹15 Cr', 'Sponsored', 'View Collection', '/search?city=Mumbai&category=Apartment', 'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg', 1, true, 'High'),
      ('TWO_COLUMN_SLIDER', 'Premium Golf Course Villas in Gurugram', 'Limited Edition Estates', 'Exclusive', 'Explore Villas', '/search?city=Gurugram&category=Villa', 'https://images.pexels.com/photos/1732414/pexels-photo-1732414.jpeg', 2, true, 'High'),
      ('TWO_COLUMN_SLIDER', 'Sea-Facing Mansions in Goa', 'Private Beach Access', 'Premium', 'Discover More', '/search?category=Villa', 'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg', 3, true, 'Medium'),
      ('TWO_COLUMN_SLIDER', 'Modern High-Rise Apartments in Bengaluru', 'Smart Homes & Helipad', 'Trending', 'View Apartments', '/search?city=Bengaluru&category=Apartment', 'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg', 4, true, 'Medium');
  END IF;

  -- Seed THREE_COLUMN_PROPERTIES if empty
  IF NOT EXISTS (SELECT 1 FROM public.paid_campaigns WHERE campaign_type = 'THREE_COLUMN_PROPERTIES') THEN
    INSERT INTO public.paid_campaigns (campaign_type, title, subtitle, badge_label, cta_label, cta_url, image_url, display_order, is_active, priority)
    VALUES
      ('THREE_COLUMN_PROPERTIES', 'Smart Homes by TechBuilders', 'Move-in ready with Alexa', 'Featured', 'View Details', '/search?q=Smart+Homes&type=Apartment', 'https://images.pexels.com/photos/259950/pexels-photo-259950.jpeg', 1, true, 'High'),
      ('THREE_COLUMN_PROPERTIES', 'City Center Commercial Spaces', 'High Footfall Areas', 'Ad', 'Explore Spaces', '/search?category=Commercial', 'https://images.pexels.com/photos/269077/pexels-photo-269077.jpeg', 2, true, 'High'),
      ('THREE_COLUMN_PROPERTIES', 'Lakeview Residential Plots', 'Build your dream home', 'Sponsored', 'See Plots', '/search?category=Plot', 'https://images.pexels.com/photos/2104152/pexels-photo-2104152.jpeg', 3, true, 'Medium'),
      ('THREE_COLUMN_PROPERTIES', 'Luxury Villas in Prime Locations', 'Zero Brokerage Fees', 'Hot Deal', 'View Villas', '/search?category=Villa', 'https://images.pexels.com/photos/208736/pexels-photo-208736.jpeg', 4, true, 'Medium');
  END IF;

  -- Seed REALTYNOW_EXCLUSIVE if empty
  IF NOT EXISTS (SELECT 1 FROM public.paid_campaigns WHERE campaign_type = 'REALTYNOW_EXCLUSIVE') THEN
    INSERT INTO public.paid_campaigns (campaign_type, title, subtitle, description, badge_label, cta_label, cta_url, image_url, display_order, is_active, priority)
    VALUES
      ('REALTYNOW_EXCLUSIVE', 'Crystal Garden', '3 & 4 BHK Luxury Apartment', 'Attapur, Hyderabad | Starting at ₹1.29 Cr. | Phase 1 P02500004287', 'Sponsored Project', 'Enquire Now', '/search', 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80', 1, true, 'High'),
      ('REALTYNOW_EXCLUSIVE', 'Ananda Vihara', '1 BHK Luxury Service Suite', 'Tirupati | Price: ₹69 Lakhs Onw. | Vacation Home Ownership', 'Exclusive Launch', 'Enquire Now', '/search', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80', 2, true, 'High'),
      ('REALTYNOW_EXCLUSIVE', 'Eternia Benchmark', '7.5 Acres | 2, 2.5 & 3 BHK Homes', 'Bachupally, Hyderabad | ₹1.2 Cr* Onwards | RERA Approved', 'New Benchmark', 'Enquire Now', '/search', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80', 3, true, 'Medium'),
      ('REALTYNOW_EXCLUSIVE', 'DLF Camellias Heights', '4 & 5 BHK Ultra Luxury Penthouses', 'Gachibowli, Hyderabad | ₹3.5 Cr* Onwards | RERA.P02400009821', 'Exclusive Launch', 'Enquire Now', '/search', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80', 4, true, 'High');
  END IF;

  -- Seed SIGNATURE_COLLECTION from luxury properties if empty
  IF NOT EXISTS (SELECT 1 FROM public.paid_campaigns WHERE campaign_type = 'SIGNATURE_COLLECTION') THEN
    idx := 1;
    FOR p_row IN (
      SELECT id, title, price, locality_id, city_id 
      FROM public.properties 
      WHERE is_luxury = true 
      ORDER BY price DESC 
      LIMIT 6
    ) LOOP
      INSERT INTO public.paid_campaigns (campaign_type, title, subtitle, badge_label, display_order, is_active, priority)
      VALUES ('SIGNATURE_COLLECTION', p_row.title, 'Ultra Luxury Signature Estate', 'Signature', idx, true, CASE WHEN idx <= 2 THEN 'High' ELSE 'Medium' END)
      RETURNING id INTO c_id;

      INSERT INTO public.paid_campaign_items (campaign_id, property_id, display_order, is_active)
      VALUES (c_id, p_row.id, idx, true);

      idx := idx + 1;
    END LOOP;
  END IF;

  -- Seed EXPLORE_BUILDERS from approved builders if empty
  IF NOT EXISTS (SELECT 1 FROM public.paid_campaigns WHERE campaign_type = 'EXPLORE_BUILDERS') THEN
    idx := 1;
    FOR b_row IN (
      SELECT id, name, description, logo_url, cover_image 
      FROM public.builders 
      WHERE status = 'approved' 
      ORDER BY created_at ASC 
      LIMIT 6
    ) LOOP
      INSERT INTO public.paid_campaigns (campaign_type, title, subtitle, badge_label, cta_label, cta_url, image_url, display_order, is_active, priority)
      VALUES ('EXPLORE_BUILDERS', b_row.name, b_row.description, 'Verified Builder', 'View Builder', '/builders/' || b_row.id, b_row.cover_image, idx, true, 'High')
      RETURNING id INTO c_id;

      INSERT INTO public.paid_campaign_items (campaign_id, builder_id, display_order, is_active)
      VALUES (c_id, b_row.id, idx, true);

      idx := idx + 1;
    END LOOP;
  END IF;
END $$;
