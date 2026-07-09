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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on Properties
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

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


-- =========================================================================
-- INDEX OPTIMIZATIONS (Fixes B-4: Missing Database Indexes)
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


-- =========================================================================
-- DATABASE FUNCTIONS & RPCs (Fixes B-2 & B-3: Atomic Operations)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Create Property Listing with Atomic Quota Checks
CREATE OR REPLACE FUNCTION public.create_property_with_quota(
  p_listing JSONB
) RETURNS JSONB AS $$
DECLARE
  v_count INTEGER;
  v_inserted JSONB;
BEGIN
  -- Perform atomic count lock
  SELECT COUNT(*) INTO v_count 
  FROM public.properties 
  WHERE created_by = (p_listing->>'created_by')::UUID;

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Property posting limit exceeded. You have already posted % properties.', v_count;
  END IF;

  -- Insert and return single JSON
  INSERT INTO public.properties (
    title, description, price, bhk, area_sqft, type, sub_type, city, locality, address, rera_id, created_by, image_urls
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
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_listing->'image_urls')), '{}'::TEXT[])
  ) RETURNING to_jsonb(public.properties.*) INTO v_inserted;

  RETURN v_inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
