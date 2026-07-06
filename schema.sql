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

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

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
    sub_type TEXT CHECK (sub_type IN ('apartment', 'villa', 'plot', 'shop', 'showroom', 'coliving')) NOT NULL,
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
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
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
