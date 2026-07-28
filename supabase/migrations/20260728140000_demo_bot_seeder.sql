-- Security Definer RPC function to seed & manage demo bots directly in DB bypassing Auth email verification & RLS blocks
CREATE OR REPLACE FUNCTION public.seed_demo_bots(
  p_request_id UUID DEFAULT NULL,
  p_action TEXT DEFAULT 'SPAWN_DONORS'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  bots_json JSONB := '[
    {
      "id": "0145771d-5359-4efe-b6d0-4db7f44db573",
      "email": "ai.donor.1@veno.test",
      "name": "Dr. Sarah Khan",
      "phone": "+8801700000003",
      "coords": "POINT(90.4025 23.7940)",
      "avatar": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80"
    },
    {
      "id": "fbf45d0b-c7e9-4992-b3ea-3ab2a1757377",
      "email": "ai.donor.2@veno.test",
      "name": "Tariq Rahman",
      "phone": "+8801700000004",
      "coords": "POINT(90.4060 23.7930)",
      "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    },
    {
      "id": "b7bd584f-2ea4-4a5c-b1a8-f911fa303631",
      "email": "ai.donor.3@veno.test",
      "name": "Ayesha Chowdhury",
      "phone": "+8801700000005",
      "coords": "POINT(90.4120 23.7915)",
      "avatar": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"
    },
    {
      "id": "c8be6950-3fb5-5b6d-c2b9-f022fa414742",
      "email": "ai.donor.4@veno.test",
      "name": "Tanvir Hasan",
      "phone": "+8801700000006",
      "coords": "POINT(90.4180 23.7960)",
      "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
    },
    {
      "id": "d9cf7061-4ac6-6c7e-d3ca-0133ab525853",
      "email": "ai.donor.5@veno.test",
      "name": "Nusrat Jahan",
      "phone": "+8801700000007",
      "coords": "POINT(90.4220 23.7880)",
      "avatar": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80"
    },
    {
      "id": "ea008172-5bd7-7d8f-e4db-1244bc636964",
      "email": "ai.donor.6@veno.test",
      "name": "Rafiqul Islam",
      "phone": "+8801700000008",
      "coords": "POINT(90.3980 23.7980)",
      "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80"
    },
    {
      "id": "fb119283-6ce8-8e90-f5ec-2355cd747075",
      "email": "ai.donor.7@veno.test",
      "name": "Dr. Arman Malik",
      "phone": "+8801700000009",
      "coords": "POINT(90.4250 23.7950)",
      "avatar": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80"
    },
    {
      "id": "0c220394-7df9-9f01-06fd-3466de858186",
      "email": "ai.donor.8@veno.test",
      "name": "Farhana Ahmed",
      "phone": "+8801700000010",
      "coords": "POINT(90.4090 23.8010)",
      "avatar": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80"
    },
    {
      "id": "1d3314a5-8ea0-0a12-17fe-4577ef969297",
      "email": "ai.donor.9@veno.test",
      "name": "Kazi Masud",
      "phone": "+8801700000011",
      "coords": "POINT(90.4300 23.7850)",
      "avatar": "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80"
    },
    {
      "id": "2e4425b6-9fb1-1b23-280f-5688f0a703a8",
      "email": "ai.donor.10@veno.test",
      "name": "Sumi Parveen",
      "phone": "+8801700000012",
      "coords": "POINT(90.3920 23.7870)",
      "avatar": "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80"
    }
  ]'::jsonb;
  b jsonb;
  v_bot_id uuid;
  v_email text;
  v_name text;
  v_phone text;
  v_coords text;
  v_avatar text;
  idx int := 0;
BEGIN
  FOR b IN SELECT * FROM jsonb_array_elements(bots_json)
  LOOP
    v_bot_id := (b->>'id')::uuid;
    v_email  := b->>'email';
    v_name   := b->>'name';
    v_phone  := b->>'phone';
    v_coords := b->>'coords';
    v_avatar := b->>'avatar';
    idx := idx + 1;

    -- 1. Ensure user exists in auth.users with confirmed email bypassing verification blocks
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_bot_id) THEN
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, recovery_sent_at, last_sign_in_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
      ) VALUES (
        v_bot_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_email,
        '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEF',
        NOW(), NOW(), NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', v_name),
        NOW(), NOW(), '', '', '', ''
      );
    ELSE
      UPDATE auth.users
      SET email_confirmed_at = NOW(),
          updated_at = NOW()
      WHERE id = v_bot_id;
    END IF;

    -- 2. Upsert profile with full verification
    INSERT INTO public.profiles (
      id, phone_number, full_name, date_of_birth, blood_group,
      gender, division, district, upazila, verification_badge,
      role, location_coords, avatar_url, created_at
    ) VALUES (
      v_bot_id,
      v_phone,
      v_name,
      '1995-05-15'::date,
      'O+',
      'MALE'::public.gender_type,
      'Dhaka',
      'Dhaka',
      'Gulshan',
      TRUE,
      'VERIFIED_USER'::public.user_role,
      ST_GeographyFromText(v_coords),
      v_avatar,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      phone_number = EXCLUDED.phone_number,
      blood_group = 'O+',
      verification_badge = TRUE,
      role = 'VERIFIED_USER'::public.user_role,
      location_coords = ST_GeographyFromText(v_coords),
      avatar_url = EXCLUDED.avatar_url;

    -- Handle Action Steps
    IF p_action = 'SPAWN_DONORS' THEN
      INSERT INTO public.donor_statuses (user_id, state, updated_at)
      VALUES (v_bot_id, 'ACTIVE'::public.donor_state, NOW())
      ON CONFLICT (user_id) DO UPDATE SET state = 'ACTIVE'::public.donor_state, updated_at = NOW();

    ELSIF p_action = 'JOIN_QUEUE' AND p_request_id IS NOT NULL THEN
      IF idx <= 4 THEN
        INSERT INTO public.donor_statuses (user_id, state, updated_at)
        VALUES (v_bot_id, 'IN_QUEUE'::public.donor_state, NOW())
        ON CONFLICT (user_id) DO UPDATE SET state = 'IN_QUEUE'::public.donor_state, updated_at = NOW();

        INSERT INTO public.request_queues (request_id, donor_id, status, location_coords, joined_at)
        VALUES (p_request_id, v_bot_id, 'ACCEPTED'::public.queue_status, ST_GeographyFromText(v_coords), NOW())
        ON CONFLICT (request_id, donor_id) DO UPDATE SET status = 'ACCEPTED'::public.queue_status;
      ELSE
        INSERT INTO public.donor_statuses (user_id, state, updated_at)
        VALUES (v_bot_id, 'ACTIVE'::public.donor_state, NOW())
        ON CONFLICT (user_id) DO UPDATE SET state = 'ACTIVE'::public.donor_state, updated_at = NOW();
      END IF;

    ELSIF p_action = 'MATCH_BOT_1' AND p_request_id IS NOT NULL THEN
      IF idx = 1 THEN
        INSERT INTO public.donor_statuses (user_id, state, updated_at)
        VALUES (v_bot_id, 'MATCHED'::public.donor_state, NOW())
        ON CONFLICT (user_id) DO UPDATE SET state = 'MATCHED'::public.donor_state, updated_at = NOW();

        INSERT INTO public.request_queues (request_id, donor_id, status, location_coords, joined_at)
        VALUES (p_request_id, v_bot_id, 'ACCEPTED'::public.queue_status, ST_GeographyFromText(v_coords), NOW())
        ON CONFLICT (request_id, donor_id) DO UPDATE SET status = 'ACCEPTED'::public.queue_status;
      END IF;

    ELSIF p_action = 'RESET_ALL' THEN
      INSERT INTO public.donor_statuses (user_id, state, updated_at)
      VALUES (v_bot_id, 'NOT_A_DONOR'::public.donor_state, NOW())
      ON CONFLICT (user_id) DO UPDATE SET state = 'NOT_A_DONOR'::public.donor_state, updated_at = NOW();

      IF p_request_id IS NOT NULL THEN
        DELETE FROM public.request_queues WHERE request_id = p_request_id AND donor_id = v_bot_id;
      END IF;
    END IF;

  END LOOP;

  RETURN jsonb_build_object('success', true, 'action', p_action);
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_demo_bots(UUID, TEXT) TO authenticated, anon;
