-- Create get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS public.user_role AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Drop existing policies on profiles
DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
DROP POLICY IF EXISTS profiles_update_policy ON public.profiles;

-- Create corrected policies on profiles using get_user_role to avoid recursion
CREATE POLICY profiles_select_policy ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = id
        OR public.get_user_role(auth.uid()) IN ('ADMIN', 'SUPER_ADMIN')
        OR EXISTS (
            SELECT 1 
            FROM public.blood_requests r
            JOIN public.request_queues q ON q.request_id = r.id
            WHERE r.requester_id = auth.uid() 
              AND q.donor_id = public.profiles.id 
              AND q.status = 'ACCEPTED'
        )
    );

CREATE POLICY profiles_update_policy ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = id
        OR public.get_user_role(auth.uid()) IN ('ADMIN', 'SUPER_ADMIN')
    );

-- Drop and recreate public.restrict_profile_fields trigger function to avoid query recursion
CREATE OR REPLACE FUNCTION public.restrict_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow changes if the updater is an admin
  IF public.get_user_role(auth.uid()) IN ('ADMIN', 'SUPER_ADMIN') THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop and recreate other policies that query profiles to prevent any nested RLS recursion
DROP POLICY IF EXISTS donor_statuses_policy ON public.donor_statuses;
CREATE POLICY donor_statuses_policy ON public.donor_statuses
    FOR ALL
    TO authenticated
    USING (
        auth.uid() = user_id
        OR public.get_user_role(auth.uid()) IN ('ADMIN', 'SUPER_ADMIN')
    );

DROP POLICY IF EXISTS blood_requests_update ON public.blood_requests;
CREATE POLICY blood_requests_update ON public.blood_requests
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = requester_id
        OR public.get_user_role(auth.uid()) IN ('ADMIN', 'SUPER_ADMIN')
    );

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
        OR public.get_user_role(auth.uid()) IN ('ADMIN', 'SUPER_ADMIN')
    );

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
        OR public.get_user_role(auth.uid()) IN ('ADMIN', 'SUPER_ADMIN')
    );

DROP POLICY IF EXISTS donations_history_select ON public.donations_history;
CREATE POLICY donations_history_select ON public.donations_history
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = donor_id
        OR public.get_user_role(auth.uid()) IN ('ADMIN', 'SUPER_ADMIN')
    );

DROP POLICY IF EXISTS donations_history_admin ON public.donations_history;
CREATE POLICY donations_history_admin ON public.donations_history
    FOR ALL
    TO authenticated
    USING (
        public.get_user_role(auth.uid()) IN ('ADMIN', 'SUPER_ADMIN')
    );

DROP POLICY IF EXISTS medication_profiles_all ON public.medication_profiles;
CREATE POLICY medication_profiles_all ON public.medication_profiles
    FOR ALL
    TO authenticated
    USING (
        auth.uid() = user_id
        OR public.get_user_role(auth.uid()) IN ('ADMIN', 'SUPER_ADMIN')
    );

DROP POLICY IF EXISTS user_badges_admin ON public.user_badges;
CREATE POLICY user_badges_admin ON public.user_badges
    FOR ALL
    TO authenticated
    USING (
        public.get_user_role(auth.uid()) IN ('ADMIN', 'SUPER_ADMIN')
    );
