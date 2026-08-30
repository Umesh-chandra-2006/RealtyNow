-- STEP 1: Verify admin role was actually set
SELECT id, email, role FROM public.profiles 
WHERE email = 'admin@realtynow.demo';

-- STEP 2: Verify the pending property still exists
SELECT id, title, status FROM public.properties 
WHERE status = 'pending_verification';

-- STEP 3: List ALL current RLS policies on properties table
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'properties';

-- STEP 4: Check what the is_admin function does
SELECT prosrc FROM pg_proc WHERE proname = 'is_admin';
