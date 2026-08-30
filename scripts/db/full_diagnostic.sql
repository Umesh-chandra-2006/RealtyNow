-- Run this in Supabase Dashboard → SQL Editor
-- Run ALL at once and paste the results back to me

-- 1. All property statuses
SELECT id, title, status FROM public.properties ORDER BY created_at;

-- 2. Pending count
SELECT COUNT(*) as pending_count FROM public.properties 
WHERE status IN ('pending_verification', 'submitted', 'changes_requested');

-- 3. Your admin user's role
SELECT id, email, role FROM public.profiles;

-- 4. Force one property to pending (fixed syntax)
UPDATE public.properties 
SET status = 'pending_verification', published_at = NULL
WHERE id = (SELECT id FROM public.properties WHERE status = 'published' LIMIT 1)
RETURNING id, title, status;
