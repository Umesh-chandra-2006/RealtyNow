-- Migration: 20260826160000_0137_sync_property_views_owner_dashboard.sql
-- Description: Authoritative property view recording RPC & public insertion policy

-- 1. Create or replace record_property_view RPC
CREATE OR REPLACE FUNCTION public.record_property_view(p_property_id UUID, p_viewer_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_views INTEGER;
BEGIN
  -- Insert into property_views log
  INSERT INTO public.property_views (property_id, viewer_id)
  VALUES (p_property_id, p_viewer_id);

  -- Authoritatively increment properties.view_count
  UPDATE public.properties
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_property_id
  RETURNING view_count INTO v_new_views;

  RETURN COALESCE(v_new_views, 0);
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback simple increment if trigger or foreign key check handles view_count
    UPDATE public.properties
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = p_property_id
    RETURNING view_count INTO v_new_views;
    RETURN COALESCE(v_new_views, 0);
END;
$$;

-- 2. Grant execution permissions
GRANT EXECUTE ON FUNCTION public.record_property_view(UUID, UUID) TO anon, authenticated, service_role;

-- 3. Ensure property_views allows public view inserts
ALTER TABLE public.property_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "property_views_insert_public" ON public.property_views;
DROP POLICY IF EXISTS "property_views_insert" ON public.property_views;
CREATE POLICY "property_views_insert_public" ON public.property_views
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "property_views_select_owner_staff" ON public.property_views;
CREATE POLICY "property_views_select_owner_staff" ON public.property_views
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id AND (p.owner_id = auth.uid() OR p.assigned_agent_id = auth.uid())
    )
    OR public.is_staff()
  );
