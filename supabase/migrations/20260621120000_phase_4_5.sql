-- Veno Phase 4 & Phase 5 Migrations

-- 1. Alter profiles table to add geography location coordinates and push token fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS location_coords geography(Point, 4326),
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 2. Create function to automatically resume paused and cooldown donors
CREATE OR REPLACE FUNCTION public.resume_paused_and_cooldown_donors()
RETURNS void AS $$
BEGIN
  -- Resume manually paused donors whose pause period has expired
  UPDATE public.donor_statuses
  SET state = 'ACTIVE'::public.donor_state,
      pause_until = NULL,
      updated_at = NOW()
  WHERE state = 'PAUSED'::public.donor_state 
    AND pause_until IS NOT NULL 
    AND pause_until <= NOW();

  -- Resume donors whose cooldown has expired
  UPDATE public.donor_statuses
  SET state = CASE 
                WHEN auto_reenable = TRUE THEN 'ACTIVE'::public.donor_state 
                ELSE 'NOT_A_DONOR'::public.donor_state 
              END,
      donation_cooldown_until = NULL,
      updated_at = NOW()
  WHERE state = 'COOLDOWN'::public.donor_state 
    AND donation_cooldown_until IS NOT NULL 
    AND donation_cooldown_until <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Schedule hourly cron job to check and resume eligibility
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule existing job if any to avoid duplication
    BEGIN
      PERFORM cron.unschedule('resume-donors-every-hour');
    EXCEPTION WHEN OTHERS THEN
      -- Ignore if the job does not exist yet
    END;
    
    PERFORM cron.schedule('resume-donors-every-hour', '0 * * * *', 'SELECT public.resume_paused_and_cooldown_donors()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Bypassed if pg_cron cron schema/extension is not fully loaded/supported in this env
END$$;

-- 4. Create spatial geofencing matching function for donors
CREATE OR REPLACE FUNCTION public.find_compatible_nearby_donors(p_request_id UUID)
RETURNS TABLE (
  donor_id UUID,
  full_name TEXT,
  phone_number TEXT,
  blood_group TEXT,
  distance_meters DOUBLE PRECISION,
  total_donations INTEGER,
  response_rate DOUBLE PRECISION,
  points INTEGER,
  hemoglobin NUMERIC,
  weight NUMERIC,
  last_cbc_date DATE,
  push_token TEXT
) AS $$
DECLARE
  v_blood_group TEXT;
  v_urgency TEXT;
  v_coords geography(Point, 4326);
  v_radius_meters DOUBLE PRECISION;
  v_requester_id UUID;
  v_compat_donors TEXT[];
BEGIN
  -- Fetch blood request info
  SELECT r.patient_blood_group, r.urgency::text, r.location_coords, r.requester_id
  INTO v_blood_group, v_urgency, v_coords, v_requester_id
  FROM public.blood_requests r
  WHERE r.id = p_request_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Determine geofence radius
  IF v_urgency = 'CRITICAL' THEN
    v_radius_meters := 10000.0; -- 10 km for critical
  ELSE
    v_radius_meters := 5000.0;  -- 5 km for low/medium
  END IF;
  
  -- Map compatible donor types based on patient blood group recipient rules
  CASE v_blood_group
    WHEN 'O-' THEN v_compat_donors := ARRAY['O-'];
    WHEN 'O+' THEN v_compat_donors := ARRAY['O-', 'O+'];
    WHEN 'A-' THEN v_compat_donors := ARRAY['O-', 'A-'];
    WHEN 'A+' THEN v_compat_donors := ARRAY['O-', 'O+', 'A-', 'A+'];
    WHEN 'B-' THEN v_compat_donors := ARRAY['O-', 'B-'];
    WHEN 'B+' THEN v_compat_donors := ARRAY['O-', 'O+', 'B-', 'B+'];
    WHEN 'AB-' THEN v_compat_donors := ARRAY['O-', 'A-', 'B-', 'AB-'];
    WHEN 'AB+' THEN v_compat_donors := ARRAY['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
    ELSE v_compat_donors := ARRAY[]::TEXT[];
  END CASE;

  -- Execute query returning close compatible active donors
  RETURN QUERY
  SELECT 
    p.id AS donor_id,
    p.full_name,
    p.phone_number,
    p.blood_group,
    ST_Distance(p.location_coords, v_coords) AS distance_meters,
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.donations_history d WHERE d.donor_id = p.id), 0) AS total_donations,
    COALESCE(
      (
        SELECT 
          CASE 
            WHEN COUNT(*) = 0 THEN 0.5::DOUBLE PRECISION
            ELSE (COUNT(*) FILTER (WHERE q.status = 'ACCEPTED'))::DOUBLE PRECISION / COUNT(*)::DOUBLE PRECISION
          END
        FROM public.request_queues q
        WHERE q.donor_id = p.id
      ),
      0.5::DOUBLE PRECISION
    ) AS response_rate,
    p.points,
    m.hemoglobin,
    m.weight,
    m.last_cbc_date,
    p.push_token
  FROM public.profiles p
  JOIN public.donor_statuses s ON s.user_id = p.id
  LEFT JOIN public.medication_profiles m ON m.user_id = p.id
  WHERE s.state = 'ACTIVE'::public.donor_state
    AND p.blood_group = ANY(v_compat_donors)
    AND p.id != v_requester_id -- Exclude the requester themselves
    AND p.location_coords IS NOT NULL
    AND ST_DWithin(p.location_coords, v_coords, v_radius_meters)
  ORDER BY distance_meters ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
