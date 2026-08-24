-- ==============================================================================
-- Migration: 0131_add_missing_agent_id_columns.sql
-- Fix: ERROR 42703 column "agent_id" does not exist
-- Ensures all property, referral, enquiry, and assignment tables have agent_id
-- ==============================================================================

-- 1. Table: properties
-- In RealtyNow, the column was originally named assigned_agent_id.
-- Adding agent_id alias column and synchronizing with assigned_agent_id.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.properties 
SET agent_id = assigned_agent_id 
WHERE agent_id IS NULL AND assigned_agent_id IS NOT NULL;

-- 2. Table: referrals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'referrals' AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE public.referrals ADD COLUMN agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.referrals 
SET agent_id = assigned_agent_id 
WHERE agent_id IS NULL AND assigned_agent_id IS NOT NULL;

-- 3. Table: enquiries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'enquiries' AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE public.enquiries ADD COLUMN agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'enquiries' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE public.enquiries ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.enquiries 
SET agent_id = assigned_to 
WHERE agent_id IS NULL AND assigned_to IS NOT NULL;

UPDATE public.enquiries 
SET assigned_to = agent_id 
WHERE assigned_to IS NULL AND agent_id IS NOT NULL;

-- 4. Table: appointments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Table: property_assignments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'property_assignments' AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE public.property_assignments ADD COLUMN agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create sync triggers for automatic two-way synchronization between agent_id and assigned_agent_id
CREATE OR REPLACE FUNCTION public.fn_sync_property_agent_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.agent_id IS NOT NULL AND NEW.assigned_agent_id IS NULL THEN
    NEW.assigned_agent_id := NEW.agent_id;
  ELSIF NEW.assigned_agent_id IS NOT NULL AND NEW.agent_id IS NULL THEN
    NEW.agent_id := NEW.assigned_agent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_property_agent_id ON public.properties;
CREATE TRIGGER trg_sync_property_agent_id
BEFORE INSERT OR UPDATE OF agent_id, assigned_agent_id ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_property_agent_id();

DROP TRIGGER IF EXISTS trg_sync_referral_agent_id ON public.referrals;
CREATE TRIGGER trg_sync_referral_agent_id
BEFORE INSERT OR UPDATE OF agent_id, assigned_agent_id ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_property_agent_id();
