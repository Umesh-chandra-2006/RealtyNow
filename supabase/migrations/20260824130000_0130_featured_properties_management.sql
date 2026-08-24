-- Migration: 20260824130000_0130_featured_properties_management.sql
-- Description: Complete Featured Properties Management Architecture with Priority, Display Order, Scheduling, RLS, and RPCs

-- 1. Create public.featured_properties table
CREATE TABLE IF NOT EXISTS public.featured_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_featured_properties_property_id UNIQUE (property_id)
);

-- 2. Indexes for high performance querying & sorting
CREATE INDEX IF NOT EXISTS idx_featured_properties_active_order ON public.featured_properties (is_active, display_order ASC, priority DESC);
CREATE INDEX IF NOT EXISTS idx_featured_properties_property_id ON public.featured_properties (property_id);
CREATE INDEX IF NOT EXISTS idx_featured_properties_schedule ON public.featured_properties (start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_featured_properties_priority ON public.featured_properties (priority);

-- 3. Row Level Security (RLS)
ALTER TABLE public.featured_properties ENABLE ROW LEVEL SECURITY;

-- Public policy: Read eligible active featured properties
DROP POLICY IF EXISTS "featured_properties_public_select" ON public.featured_properties;
CREATE POLICY "featured_properties_public_select" ON public.featured_properties
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND (start_at IS NULL OR start_at <= now())
    AND (end_at IS NULL OR end_at >= now())
  );

-- Admin policy: Full CRUD access for staff / admin roles
DROP POLICY IF EXISTS "featured_properties_admin_all" ON public.featured_properties;
CREATE POLICY "featured_properties_admin_all" ON public.featured_properties
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
  )
  WITH CHECK (
    public.is_staff()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
  );

-- 4. Enable Realtime publication for featured_properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'featured_properties'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.featured_properties;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 5. RPC: Public function to fetch eligible featured properties with search view details
CREATE OR REPLACE FUNCTION public.fn_get_public_featured_properties(
  p_city_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  featured_id UUID,
  featured_priority TEXT,
  featured_display_order INT,
  featured_start_at TIMESTAMPTZ,
  featured_end_at TIMESTAMPTZ,
  id UUID,
  owner_id UUID,
  title TEXT,
  description TEXT,
  property_type_id UUID,
  property_type_name TEXT,
  property_type_category TEXT,
  purpose TEXT,
  city_id UUID,
  city_name TEXT,
  locality_id UUID,
  locality_name TEXT,
  address TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  price NUMERIC,
  rent_amount NUMERIC,
  security_deposit NUMERIC,
  bedrooms INT,
  bathrooms INT,
  balconies INT,
  built_up_area NUMERIC,
  carpet_area NUMERIC,
  plot_area NUMERIC,
  furnishing TEXT,
  parking INT,
  possession_status TEXT,
  amenities TEXT[],
  images JSONB,
  status TEXT,
  is_live BOOLEAN,
  is_featured BOOLEAN,
  view_count INT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  builder_name TEXT,
  assigned_agent_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fp.id AS featured_id,
    fp.priority AS featured_priority,
    fp.display_order AS featured_display_order,
    fp.start_at AS featured_start_at,
    fp.end_at AS featured_end_at,
    p.id,
    p.owner_id,
    p.title,
    p.description,
    p.property_type_id,
    p.property_type_name,
    p.property_type_category,
    p.purpose,
    p.city_id,
    p.city_name,
    p.locality_id,
    p.locality_name,
    p.address,
    p.latitude,
    p.longitude,
    p.price,
    p.rent_amount,
    p.security_deposit,
    p.bedrooms,
    p.bathrooms,
    p.balconies,
    p.built_up_area,
    p.carpet_area,
    p.plot_area,
    p.furnishing,
    p.parking,
    p.possession_status,
    p.amenities,
    p.images,
    p.status,
    p.is_live,
    true AS is_featured,
    p.view_count,
    p.created_at,
    p.updated_at,
    p.builder_name,
    p.assigned_agent_id
  FROM public.featured_properties fp
  JOIN public.v_properties_search p ON p.id = fp.property_id
  WHERE fp.is_active = true
    AND (fp.start_at IS NULL OR fp.start_at <= now())
    AND (fp.end_at IS NULL OR fp.end_at >= now())
    AND (p.status IN ('published', 'approved') OR p.is_live = true)
    AND (p_city_id IS NULL OR p.city_id = p_city_id)
  ORDER BY 
    fp.display_order ASC,
    CASE fp.priority 
      WHEN 'High' THEN 1 
      WHEN 'Medium' THEN 2 
      WHEN 'Low' THEN 3 
      ELSE 4 
    END ASC,
    fp.created_at DESC
  LIMIT p_limit;
END;
$$;

-- 6. RPC: Batch reorder featured properties
CREATE OR REPLACE FUNCTION public.fn_reorder_featured_properties(
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id UUID, display_order INT)
  LOOP
    UPDATE public.featured_properties
    SET display_order = v_item.display_order,
        updated_at = now()
    WHERE id = v_item.id;
  END LOOP;
END;
$$;

-- 7. RPC: Toggle / Manage Featured Property status
CREATE OR REPLACE FUNCTION public.fn_toggle_featured_property(
  p_property_id UUID,
  p_is_featured BOOLEAN,
  p_priority TEXT DEFAULT 'Medium',
  p_display_order INT DEFAULT NULL,
  p_start_at TIMESTAMPTZ DEFAULT NULL,
  p_end_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_next_order INT;
BEGIN
  IF p_is_featured THEN
    -- Determine next display order if not specified
    IF p_display_order IS NULL THEN
      SELECT COALESCE(MAX(display_order), 0) + 1 INTO v_next_order FROM public.featured_properties;
    ELSE
      v_next_order := p_display_order;
    END IF;

    INSERT INTO public.featured_properties (
      property_id,
      is_active,
      display_order,
      priority,
      start_at,
      end_at,
      created_by,
      updated_at
    ) VALUES (
      p_property_id,
      true,
      v_next_order,
      p_priority,
      p_start_at,
      p_end_at,
      auth.uid(),
      now()
    )
    ON CONFLICT (property_id) DO UPDATE SET
      is_active = true,
      priority = EXCLUDED.priority,
      start_at = EXCLUDED.start_at,
      end_at = EXCLUDED.end_at,
      display_order = COALESCE(EXCLUDED.display_order, featured_properties.display_order),
      updated_at = now();

    -- Synchronize properties table flag
    UPDATE public.properties SET is_featured = true, updated_at = now() WHERE id = p_property_id;

    v_result := jsonb_build_object('success', true, 'action', 'featured', 'property_id', p_property_id);
  ELSE
    DELETE FROM public.featured_properties WHERE property_id = p_property_id;
    UPDATE public.properties SET is_featured = false, updated_at = now() WHERE id = p_property_id;

    v_result := jsonb_build_object('success', true, 'action', 'unfeatured', 'property_id', p_property_id);
  END IF;

  RETURN v_result;
END;
$$;

-- 8. Seed initial featured properties from existing published/featured properties
DO $$
DECLARE
  r RECORD;
  v_order INT := 1;
BEGIN
  FOR r IN 
    SELECT id, is_featured FROM public.properties 
    WHERE (is_featured = true OR status IN ('published', 'approved'))
    ORDER BY is_featured DESC, created_at DESC 
    LIMIT 8
  LOOP
    INSERT INTO public.featured_properties (
      property_id,
      is_active,
      display_order,
      priority,
      start_at,
      end_at,
      created_at,
      updated_at
    ) VALUES (
      r.id,
      true,
      v_order,
      CASE WHEN v_order <= 3 THEN 'High' ELSE 'Medium' END,
      now() - interval '1 day',
      NULL,
      now(),
      now()
    )
    ON CONFLICT (property_id) DO NOTHING;
    
    UPDATE public.properties SET is_featured = true WHERE id = r.id;
    v_order := v_order + 1;
  END LOOP;
END $$;
