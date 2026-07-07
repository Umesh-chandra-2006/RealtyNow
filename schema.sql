-- ==========================================
-- RealtyNow PostgreSQL Database Schema
-- Place in Supabase SQL Editor to initialize
-- ==========================================

-- 1. Profiles Table (Linked to auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT CHECK (role IN ('buyer', 'owner', 'builder')) DEFAULT 'buyer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Expose public metadata view for property listings
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, full_name, role, created_at
FROM public.profiles;

-- Grant select to all users on public view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Secure RPC function to fetch owner phone number only if buyer has sent a contact request
CREATE OR REPLACE FUNCTION public.get_owner_phone(prop_id UUID)
RETURNS TEXT AS $$
DECLARE
    owner_phone TEXT;
BEGIN
    IF auth.role() <> 'authenticated' THEN
        RETURN NULL;
    END IF;

    -- Check if contact request exists between requester and the target property
    IF EXISTS (
        SELECT 1 FROM public.contact_requests
        WHERE buyer_id = auth.uid() AND property_id = prop_id
    ) THEN
        SELECT phone INTO owner_phone
        FROM public.profiles p
        JOIN public.properties pr ON p.id = pr.created_by
        WHERE pr.id = prop_id;
        
        RETURN owner_phone;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);


-- 2. Properties Table
CREATE TABLE public.properties (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL,
    bhk INT CHECK (bhk IN (1, 2, 3, 4)),
    area_sqft INT NOT NULL,
    type TEXT CHECK (type IN ('buy', 'rent', 'pg', 'commercial')) NOT NULL,
    sub_type TEXT CHECK (sub_type IN ('apartment', 'villa', 'plot', 'shop', 'showroom', 'coliving', 'office', 'retail')) NOT NULL,
    city TEXT NOT NULL,
    locality TEXT NOT NULL,
    address TEXT,
    is_verified BOOLEAN DEFAULT false,
    is_rera_approved BOOLEAN DEFAULT false,
    rera_id TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    image_urls TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Properties
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Properties are viewable by everyone" ON public.properties
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can post properties" ON public.properties
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = created_by);

CREATE POLICY "Owners can update their own properties" ON public.properties
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Owners can delete their own properties" ON public.properties
    FOR DELETE USING (auth.uid() = created_by);


-- 3. Favorites Table (Bookmarks)
CREATE TABLE public.favorites (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (user_id, property_id)
);

-- Enable RLS for Favorites
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorites" ON public.favorites
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites" ON public.favorites
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites" ON public.favorites
    FOR DELETE USING (auth.uid() = user_id);


-- 4. Contact Requests (Lead Capture)
CREATE TABLE public.contact_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Contact Requests
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Property owners can view contact requests for their listings" ON public.contact_requests
    FOR SELECT USING (
        auth.uid() IN (
            SELECT created_by FROM public.properties WHERE id = property_id
        )
    );

CREATE POLICY "Authenticated buyers can submit contact requests" ON public.contact_requests
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = buyer_id);


-- 5. Service Bookings Table (Kaam Kaaka Integration)
CREATE TABLE public.service_bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    service_type TEXT NOT NULL,
    bhk_size TEXT NOT NULL,
    moving_from TEXT,
    moving_to TEXT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    preferred_date DATE NOT NULL,
    estimate TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own service bookings" ON public.service_bookings
    FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Users can insert their own service bookings" ON public.service_bookings
    FOR INSERT WITH CHECK (auth.uid() = buyer_id);


-- 6. Interior Consultations Table (Bespoke Living Integration)
CREATE TABLE public.interior_consultations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    bhk_size TEXT NOT NULL,
    design_style TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT,
    estimate TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.interior_consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own interior consultations" ON public.interior_consultations
    FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Users can insert their own interior consultations" ON public.interior_consultations
    FOR INSERT WITH CHECK (auth.uid() = buyer_id);


-- ========================================================
-- Trigger: Automate Profiles creation on auth.users Signup
-- ========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, phone, full_name, role)
    VALUES (
        new.id,
        new.phone,
        COALESCE(new.raw_user_meta_data->>'full_name', 'Anonymous User'),
        COALESCE(new.raw_user_meta_data->>'role', 'buyer')
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==========================================================
-- Business Rule: Enforce 5-Free Property Postings Quota Limit
-- ==========================================================
CREATE OR REPLACE FUNCTION public.check_property_posting_quota()
RETURNS TRIGGER AS $$
DECLARE
    property_count INT;
BEGIN
    -- Acquire transaction-scoped advisory lock on the user ID hash to prevent concurrent race condition insertions
    PERFORM pg_advisory_xact_lock(hashtext(NEW.created_by::text));

    -- Count listings owned by the user
    SELECT COUNT(*) INTO property_count 
    FROM public.properties 
    WHERE created_by = NEW.created_by;

    -- Enforce 5 post limit
    IF property_count >= 5 THEN
        RAISE EXCEPTION 'Property posting limit exceeded. You have already posted % properties.', property_count;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_posting_quota
    BEFORE INSERT ON public.properties
    FOR EACH ROW EXECUTE FUNCTION public.check_property_posting_quota();


-- ==========================================================
-- Business Rule: Enforce Owner Verification Protection
-- ==========================================================
CREATE OR REPLACE FUNCTION public.protect_property_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow admins (identified by is_admin in app_metadata) to bypass verification constraints
    IF coalesce(auth.jwt()->'app_metadata'->>'is_admin', 'false') = 'true' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.is_verified := false;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Prevent self-verification of listings by resetting the field to its previous value on update
        NEW.is_verified := OLD.is_verified;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_property_verification
    BEFORE INSERT OR UPDATE ON public.properties
    FOR EACH ROW EXECUTE FUNCTION public.protect_property_fields();


-- ==========================================================
-- Performance Indexes: Speed up filters, sorts, and joins
-- ==========================================================
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON public.properties(created_by);
CREATE INDEX IF NOT EXISTS idx_properties_filters ON public.properties(city, locality, type, price);
CREATE INDEX IF NOT EXISTS idx_properties_sort_verified ON public.properties(is_verified DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_lookup ON public.favorites(user_id, property_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_lookup ON public.contact_requests(buyer_id, property_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_buyer ON public.service_bookings(buyer_id);
CREATE INDEX IF NOT EXISTS idx_interior_consultations_buyer ON public.interior_consultations(buyer_id);

-- Trigram Indexes for Wildcard Searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_properties_city_trgm ON public.properties USING gin (city gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_properties_locality_trgm ON public.properties USING gin (locality gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_properties_title_trgm ON public.properties USING gin (title gin_trgm_ops);

