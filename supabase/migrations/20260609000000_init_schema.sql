-- Enable PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Create Custom Enums & Types (only if they do not exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'donor_state') THEN
        CREATE TYPE public.donor_state AS ENUM (
            'NOT_A_DONOR',
            'ACTIVE',
            'PAUSED',
            'REQUEST_PENDING',
            'IN_QUEUE',
            'MATCHED',
            'COOLDOWN',
            'INELIGIBLE',
            'SUSPENDED'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'urgency_level') THEN
        CREATE TYPE public.urgency_level AS ENUM (
            'LOW',
            'MEDIUM',
            'CRITICAL'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blood_request_status') THEN
        CREATE TYPE public.blood_request_status AS ENUM (
            'ACTIVE',
            'COMPLETED',
            'CANCELLED',
            'EXPIRED'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_status') THEN
        CREATE TYPE public.queue_status AS ENUM (
            'PENDING',
            'ACCEPTED',
            'DECLINED'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM (
            'USER',
            'VERIFIED_USER',
            'ADMIN',
            'SUPER_ADMIN'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_type') THEN
        CREATE TYPE public.gender_type AS ENUM (
            'MALE',
            'FEMALE',
            'OTHER'
        );
    END IF;
END$$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT UNIQUE,
    full_name TEXT NOT NULL CONSTRAINT name_length_check CHECK (char_length(full_name) >= 3),
    date_of_birth DATE NOT NULL,
    blood_group TEXT CONSTRAINT blood_group_check CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    gender public.gender_type NOT NULL,
    division TEXT NOT NULL,
    district TEXT NOT NULL,
    upazila TEXT NOT NULL,
    verification_badge BOOLEAN DEFAULT FALSE,
    points INTEGER DEFAULT 0,
    role public.user_role DEFAULT 'USER',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create donor_statuses table
CREATE TABLE IF NOT EXISTS public.donor_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    state public.donor_state NOT NULL DEFAULT 'NOT_A_DONOR',
    donation_cooldown_until TIMESTAMPTZ,
    auto_reenable BOOLEAN DEFAULT TRUE,
    pause_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create blood_requests table
CREATE TABLE IF NOT EXISTS public.blood_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL CONSTRAINT patient_name_length_check CHECK (char_length(patient_name) >= 3),
    patient_blood_group TEXT NOT NULL CONSTRAINT patient_blood_group_check CHECK (patient_blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    location_coords geography(POINT, 4326) NOT NULL,
    location_address TEXT NOT NULL,
    units_needed INTEGER NOT NULL CONSTRAINT units_needed_check CHECK (units_needed BETWEEN 1 AND 6),
    urgency public.urgency_level NOT NULL DEFAULT 'LOW',
    notes TEXT CONSTRAINT notes_length_check CHECK (char_length(notes) <= 200),
    status public.blood_request_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enforce 1 active request limit per user using a unique partial index (creates only if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_request_per_user 
ON public.blood_requests (requester_id) 
WHERE (status = 'ACTIVE');

-- Create request_queues table
CREATE TABLE IF NOT EXISTS public.request_queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
    donor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status public.queue_status NOT NULL DEFAULT 'PENDING',
    location_coords geography(POINT, 4326),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_request_donor UNIQUE (request_id, donor_id)
);

-- Create donations_history table
CREATE TABLE IF NOT EXISTS public.donations_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    request_id UUID REFERENCES public.blood_requests(id) ON DELETE SET NULL,
    donation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    location TEXT NOT NULL,
    points_earned INTEGER NOT NULL DEFAULT 0
);

-- Create medication_profiles table
CREATE TABLE IF NOT EXISTS public.medication_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    hemoglobin NUMERIC CONSTRAINT hemoglobin_positive CHECK (hemoglobin > 0),
    weight NUMERIC CONSTRAINT weight_positive CHECK (weight > 0),
    last_cbc_date DATE,
    flagged_conditions JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_badges table (to track gamification badges)
CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    badge_name TEXT NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    points_awarded INTEGER DEFAULT 0,
    CONSTRAINT unique_user_badge UNIQUE (user_id, badge_name)
);

-- Enable RLS for all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donor_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Helper function to generate privacy-compliant display name (First Name + Last Initial)
CREATE OR REPLACE FUNCTION public.get_display_name(full_name text)
RETURNS text AS $$
DECLARE
  parts text[];
BEGIN
  parts := regexp_split_to_array(trim(full_name), '\s+');
  IF array_length(parts, 1) > 1 THEN
    RETURN parts[1] || ' ' || substring(parts[array_length(parts, 1)] from 1 for 1) || '.';
  ELSE
    RETURN full_name;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create public view of profiles for Class C data visibility
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  public.get_display_name(full_name) as display_name,
  blood_group,
  gender,
  division,
  district,
  upazila,
  verification_badge,
  points,
  role,
  created_at
FROM public.profiles;

-- Grant SELECT access on the public view to all authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;

-- Trigger to verify user is at least 18 years old when profile is created or updated
CREATE OR REPLACE FUNCTION public.check_profile_age()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.date_of_birth > (CURRENT_DATE - INTERVAL '18 years') THEN
    RAISE EXCEPTION 'User must be at least 18 years old to register.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profile_age_check ON public.profiles;
CREATE TRIGGER on_profile_age_check
  BEFORE INSERT OR UPDATE OF date_of_birth ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_profile_age();

-- Trigger to prevent standard users from editing their own roles, points or badges directly via API
CREATE OR REPLACE FUNCTION public.restrict_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow changes if the updater is an admin
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
  ) THEN
    RETURN NEW;
  END IF;

  -- For standard users, lock down fields
  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role;
    END IF;
    IF NEW.points IS DISTINCT FROM OLD.points THEN
      NEW.points := OLD.points;
    END IF;
    IF NEW.verification_badge IS DISTINCT FROM OLD.verification_badge THEN
      NEW.verification_badge := OLD.verification_badge;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_update_restrict ON public.profiles;
CREATE TRIGGER on_profile_update_restrict
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.restrict_profile_fields();

-- Trigger: Automatically create profile and donor status when a user registers in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    phone_number, 
    full_name, 
    date_of_birth, 
    blood_group, 
    gender, 
    division, 
    district, 
    upazila, 
    role
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone_number'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Donor'),
    COALESCE((NEW.raw_user_meta_data->>'date_of_birth')::DATE, '2000-01-01'::DATE),
    COALESCE(NEW.raw_user_meta_data->>'blood_group', 'O+'),
    COALESCE((NEW.raw_user_meta_data->>'gender')::public.gender_type, 'OTHER'::public.gender_type),
    COALESCE(NEW.raw_user_meta_data->>'division', 'Default Division'),
    COALESCE(NEW.raw_user_meta_data->>'district', 'Default District'),
    COALESCE(NEW.raw_user_meta_data->>'upazila', 'Default Upazila'),
    'USER'
  )
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.donor_statuses (user_id, state)
  VALUES (NEW.id, 'NOT_A_DONOR')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Update profiles.points when a donation history record is inserted
CREATE OR REPLACE FUNCTION public.update_points_on_donation()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET points = points + NEW.points_earned
  WHERE id = NEW.donor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_donation_history_insert ON public.donations_history;
CREATE TRIGGER on_donation_history_insert
  AFTER INSERT ON public.donations_history
  FOR EACH ROW EXECUTE FUNCTION public.update_points_on_donation();

-- Trigger: Award +100 points for identity verification when verification_badge goes true
CREATE OR REPLACE FUNCTION public.update_points_on_profile_verification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verification_badge = TRUE AND OLD.verification_badge = FALSE THEN
    NEW.points := NEW.points + 100;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profile_verification_update ON public.profiles;
CREATE TRIGGER on_profile_verification_update
  BEFORE UPDATE OF verification_badge ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_points_on_profile_verification();

-- Trigger: Award +50 points for medical report upload
CREATE OR REPLACE FUNCTION public.update_points_on_medical_upload()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET points = points + 50
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_medical_profile_insert ON public.medication_profiles;
CREATE TRIGGER on_medical_profile_insert
  AFTER INSERT ON public.medication_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_points_on_medical_upload();

-- Trigger: Award points associated with specific badge unlocks
CREATE OR REPLACE FUNCTION public.update_points_on_badge_unlock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.points_awarded > 0 THEN
    UPDATE public.profiles
    SET points = points + NEW.points_awarded
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_badge_unlock ON public.user_badges;
CREATE TRIGGER on_badge_unlock
  AFTER INSERT ON public.user_badges
  FOR EACH ROW EXECUTE FUNCTION public.update_points_on_badge_unlock();


-- ROW LEVEL SECURITY (RLS) POLICIES

-- profiles Policies
DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
CREATE POLICY profiles_select_policy ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = id
        OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('ADMIN', 'SUPER_ADMIN')
        )
        OR EXISTS (
            SELECT 1 
            FROM public.blood_requests r
            JOIN public.request_queues q ON q.request_id = r.id
            WHERE r.requester_id = auth.uid() 
              AND q.donor_id = public.profiles.id 
              AND q.status = 'ACCEPTED'
        )
    );

DROP POLICY IF EXISTS profiles_update_policy ON public.profiles;
CREATE POLICY profiles_update_policy ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = id
        OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- donor_statuses Policies
DROP POLICY IF EXISTS donor_statuses_policy ON public.donor_statuses;
CREATE POLICY donor_statuses_policy ON public.donor_statuses
    FOR ALL
    TO authenticated
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- blood_requests Policies
DROP POLICY IF EXISTS blood_requests_select ON public.blood_requests;
CREATE POLICY blood_requests_select ON public.blood_requests
    FOR SELECT
    TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS blood_requests_insert ON public.blood_requests;
CREATE POLICY blood_requests_insert ON public.blood_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS blood_requests_update ON public.blood_requests;
CREATE POLICY blood_requests_update ON public.blood_requests
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = requester_id
        OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- request_queues Policies
DROP POLICY IF EXISTS request_queues_select ON public.request_queues;
CREATE POLICY request_queues_select ON public.request_queues
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = donor_id
        OR EXISTS (
            SELECT 1 FROM public.blood_requests r
            WHERE r.id = request_id AND r.requester_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

DROP POLICY IF EXISTS request_queues_insert ON public.request_queues;
CREATE POLICY request_queues_insert ON public.request_queues
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = donor_id);

DROP POLICY IF EXISTS request_queues_update ON public.request_queues;
CREATE POLICY request_queues_update ON public.request_queues
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = donor_id
        OR EXISTS (
            SELECT 1 FROM public.blood_requests r
            WHERE r.id = request_id AND r.requester_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- donations_history Policies
DROP POLICY IF EXISTS donations_history_select ON public.donations_history;
CREATE POLICY donations_history_select ON public.donations_history
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = donor_id
        OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

DROP POLICY IF EXISTS donations_history_insert ON public.donations_history;
CREATE POLICY donations_history_insert ON public.donations_history
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = donor_id);

DROP POLICY IF EXISTS donations_history_admin ON public.donations_history;
CREATE POLICY donations_history_admin ON public.donations_history
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- medication_profiles Policies
DROP POLICY IF EXISTS medication_profiles_all ON public.medication_profiles;
CREATE POLICY medication_profiles_all ON public.medication_profiles
    FOR ALL
    TO authenticated
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- user_badges Policies
DROP POLICY IF EXISTS user_badges_select ON public.user_badges;
CREATE POLICY user_badges_select ON public.user_badges
    FOR SELECT
    TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS user_badges_admin ON public.user_badges;
CREATE POLICY user_badges_admin ON public.user_badges
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

