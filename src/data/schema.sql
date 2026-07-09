-- =========================================================================
-- RealtyNow Suppabase Database Schema Definitions & Pre-Deployment Migrations
-- =========================================================================

-- 1. Profiles Table Schema
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('buyer', 'owner', 'builder')),
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for Profiles
CREATE POLICY "Allow public read access to profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Allow users to insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow users to update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 2. Properties Listings Table Schema
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price BIGINT NOT NULL,
  bhk INTEGER NOT NULL CHECK (bhk > 0),
  area_sqft INTEGER NOT NULL CHECK (area_sqft > 0),
  type TEXT NOT NULL CHECK (type IN ('buy', 'rent', 'pg', 'commercial')),
  sub_type TEXT NOT NULL CHECK (sub_type IN ('apartment', 'villa', 'plot', 'shop', 'showroom', 'coliving')),
  city TEXT NOT NULL,
  locality TEXT NOT NULL,
  address TEXT,
  is_verified BOOLEAN DEFAULT FALSE NOT NULL,
  is_rera_approved BOOLEAN DEFAULT FALSE NOT NULL,
  rera_id TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  image_urls TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  highlights TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on Properties
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for Properties
CREATE POLICY "Allow public read access to properties" ON public.properties
  FOR SELECT USING (true);

CREATE POLICY "Allow users to insert own properties" ON public.properties
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Allow users to update own properties" ON public.properties
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Allow users to delete own properties" ON public.properties
  FOR DELETE USING (auth.uid() = created_by);

-- 3. Favorites Table Schema
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT unique_user_property_favorite UNIQUE (user_id, property_id)
);

-- Enable RLS on Favorites
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for Favorites
CREATE POLICY "Allow users to read own favorites" ON public.favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow users to insert own favorites" ON public.favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to delete own favorites" ON public.favorites
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Contact Requests Table Schema
CREATE TABLE IF NOT EXISTS public.contact_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on Contact Requests
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for Contact Requests
CREATE POLICY "Allow users to read own contact requests" ON public.contact_requests
  FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Allow users to insert own contact requests" ON public.contact_requests
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- =========================================================================
-- INDEX OPTIMIZATIONS
-- =========================================================================

-- Optimizes property lookup filtered by owner/creator
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON public.properties(created_by);

-- Optimizes listing queries sorted by date (e.g., browse page defaults)
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON public.properties(created_at DESC);

-- Optimizes locality search queries (e.g., Bandra West, Mumbai)
CREATE INDEX IF NOT EXISTS idx_properties_location ON public.properties(city, locality);

-- Optimizes composite lookups for favorite status checking
CREATE INDEX IF NOT EXISTS idx_favorites_lookup ON public.favorites(user_id, property_id);

-- Optimizes contact requests by buyer profile
CREATE INDEX IF NOT EXISTS idx_contact_requests_buyer ON public.contact_requests(buyer_id);

-- Optimizes properties by buy/rent type and pricing searches
CREATE INDEX IF NOT EXISTS idx_properties_type_price ON public.properties(type, price);


-- =========================================================================
-- DATABASE FUNCTIONS & RPCs
-- =========================================================================

-- RPC: Atomic Favorite Toggle (Deletes if exists, inserts otherwise)
CREATE OR REPLACE FUNCTION public.toggle_favorite_atomic(
  p_user_id UUID,
  p_property_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.favorites 
    WHERE user_id = p_user_id AND property_id = p_property_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.favorites 
    WHERE user_id = p_user_id AND property_id = p_property_id;
    RETURN FALSE;
  ELSE
    INSERT INTO public.favorites (user_id, property_id) 
    VALUES (p_user_id, p_property_id);
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- RPC: Create Property Listing with Atomic Quota Checks
CREATE OR REPLACE FUNCTION public.create_property_with_quota(
  p_listing JSONB
) RETURNS JSONB AS $$
DECLARE
  v_count INTEGER;
  v_inserted JSONB;
BEGIN
  -- Perform row-level locking on the profile to serialize quota checks and prevent race conditions (TOCTOU)
  PERFORM 1 FROM public.profiles 
  WHERE id = (p_listing->>'created_by')::UUID 
  FOR UPDATE;

  -- Perform atomic count lock
  SELECT COUNT(*) INTO v_count 
  FROM public.properties 
  WHERE created_by = (p_listing->>'created_by')::UUID;

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Property posting limit exceeded. You have already posted % properties.', v_count;
  END IF;

  -- Insert and return single JSON
  INSERT INTO public.properties (
    title, description, price, bhk, area_sqft, type, sub_type, city, locality, address, rera_id, created_by, image_urls, highlights
  ) VALUES (
    p_listing->>'title',
    p_listing->>'description',
    (p_listing->>'price')::BIGINT,
    (p_listing->>'bhk')::INTEGER,
    (p_listing->>'area_sqft')::INTEGER,
    p_listing->>'type',
    p_listing->>'sub_type',
    p_listing->>'city',
    p_listing->>'locality',
    p_listing->>'address',
    p_listing->>'rera_id',
    (p_listing->>'created_by')::UUID,
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_listing->'image_urls')), '{}'::TEXT[]),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_listing->'highlights')), '{}'::TEXT[])
  ) RETURNING to_jsonb(public.properties.*) INTO v_inserted;

  RETURN v_inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
