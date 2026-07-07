-- ========================================================================
-- RealtyNow Schema Regression Tests
-- ========================================================================
-- This script contains test blocks to verify verification locks, quota controls, 
-- and RLS boundaries against your Supabase or PostgreSQL database.
-- ========================================================================

-- Setup dummy user profiles
INSERT INTO public.profiles (id, phone, full_name, role)
VALUES 
  ('a0000000-0000-0000-0000-000000000000', '+91 99999 11111', 'Normal Owner', 'owner'),
  ('a1111111-1111-1111-1111-111111111111', '+91 99999 22222', 'System Admin', 'owner')
ON CONFLICT (id) DO NOTHING;


-- ------------------------------------------------------------------------
-- TEST 1: Non-admin INSERT verification bypass block
-- ------------------------------------------------------------------------
-- GIVEN: A normal authenticated user (non-admin) trying to insert a verified property
-- EXPECTED: The trigger resets is_verified and is_rera_approved to false.

-- Simulate standard JWT context (is_admin is not set or false in app_metadata)
SELECT set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000000", "role": "authenticated", "app_metadata": {"is_admin": false}}', true);

INSERT INTO public.properties (title, price, bhk, area_sqft, type, sub_type, city, locality, created_by, is_verified, is_rera_approved)
VALUES ('Test Villa 1', 12000000, 3, 1800, 'buy', 'villa', 'Bangalore', 'Whitefield', 'a0000000-0000-0000-0000-000000000000', true, true);

-- VERIFICATION QUERY (Both fields MUST be false):
SELECT title, is_verified, is_rera_approved 
FROM public.properties 
WHERE title = 'Test Villa 1';


-- ------------------------------------------------------------------------
-- TEST 2: Non-admin UPDATE verification bypass block
-- ------------------------------------------------------------------------
-- GIVEN: An existing property with is_verified=false and is_rera_approved=false
-- WHEN: A non-admin user attempts to update these fields to true
-- EXPECTED: The trigger preserves the old values (false).

UPDATE public.properties 
SET is_verified = true, is_rera_approved = true 
WHERE title = 'Test Villa 1';

-- VERIFICATION QUERY (Both fields MUST STILL be false):
SELECT title, is_verified, is_rera_approved 
FROM public.properties 
WHERE title = 'Test Villa 1';


-- ------------------------------------------------------------------------
-- TEST 3: Admin trigger bypass (app_metadata check)
-- ------------------------------------------------------------------------
-- GIVEN: An admin user (is_admin = true in app_metadata)
-- EXPECTED: The insert or update operations are allowed to set is_verified/is_rera_approved.

-- Simulate admin JWT context
SELECT set_config('request.jwt.claims', '{"sub": "a1111111-1111-1111-1111-111111111111", "role": "authenticated", "app_metadata": {"is_admin": true}}', true);

INSERT INTO public.properties (title, price, bhk, area_sqft, type, sub_type, city, locality, created_by, is_verified, is_rera_approved)
VALUES ('Admin Approved Villa', 35000000, 4, 3200, 'buy', 'villa', 'Delhi', 'South Ext', 'a1111111-1111-1111-1111-111111111111', true, true);

-- VERIFICATION QUERY (Both fields MUST be true):
SELECT title, is_verified, is_rera_approved 
FROM public.properties 
WHERE title = 'Admin Approved Villa';


-- ------------------------------------------------------------------------
-- TEST 4: Concurrent Quota & Advisory Lock test
-- ------------------------------------------------------------------------
-- GIVEN: A user who already has 4 listings
-- WHEN: Multiple sessions attempt concurrent insertions at the same time
-- EXPECTED: The advisory lock serializes the transaction; exactly 1 succeeds, and subsequent attempts raise a quota exception.

-- Clean up properties for Test 4
DELETE FROM public.properties WHERE created_by = 'a0000000-0000-0000-0000-000000000000';

-- Standard user token context
SELECT set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000000", "role": "authenticated"}', true);

-- Insert 4 properties first (limit is 5)
INSERT INTO public.properties (title, price, bhk, area_sqft, type, sub_type, city, locality, created_by) VALUES
  ('Villa A', 5000000, 2, 1000, 'buy', 'apartment', 'Mumbai', 'Andheri', 'a0000000-0000-0000-0000-000000000000'),
  ('Villa B', 5000000, 2, 1000, 'buy', 'apartment', 'Mumbai', 'Andheri', 'a0000000-0000-0000-0000-000000000000'),
  ('Villa C', 5000000, 2, 1000, 'buy', 'apartment', 'Mumbai', 'Andheri', 'a0000000-0000-0000-0000-000000000000'),
  ('Villa D', 5000000, 2, 1000, 'buy', 'apartment', 'Mumbai', 'Andheri', 'a0000000-0000-0000-0000-000000000000');

-- The 5th insert should succeed:
INSERT INTO public.properties (title, price, bhk, area_sqft, type, sub_type, city, locality, created_by) 
VALUES ('Villa E (Succeeds)', 5000000, 2, 1000, 'buy', 'apartment', 'Mumbai', 'Andheri', 'a0000000-0000-0000-0000-000000000000');

-- The 6th concurrent insert (simulated sequentially or concurrently) will lock and fail with limit exception:
-- EXPECTED: Exception: Property posting limit exceeded.
INSERT INTO public.properties (title, price, bhk, area_sqft, type, sub_type, city, locality, created_by) 
VALUES ('Villa F (Fails)', 5000000, 2, 1000, 'buy', 'apartment', 'Mumbai', 'Andheri', 'a0000000-0000-0000-0000-000000000000');
