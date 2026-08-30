-- Run this in your Supabase Dashboard → SQL Editor
-- This bypasses RLS completely (runs as postgres superuser)

-- Step 1: See all properties and their current statuses
SELECT id, title, status, owner_id FROM public.properties ORDER BY created_at DESC;
