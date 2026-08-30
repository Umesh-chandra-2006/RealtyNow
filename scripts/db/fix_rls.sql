-- Fix RLS for cms_search_config
ALTER TABLE public.cms_search_config ENABLE ROW LEVEL SECURITY;

DO \$\$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'cms_search_config' AND policyname = 'Enable all operations for authenticated admin users'
  ) THEN
      CREATE POLICY "Enable all operations for authenticated admin users" ON public.cms_search_config
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
  END IF;

  IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'cms_search_config' AND policyname = 'Enable read access for all users'
  ) THEN
      CREATE POLICY "Enable read access for all users" ON public.cms_search_config
      FOR SELECT TO public USING (true);
  END IF;
END
\$\$;
