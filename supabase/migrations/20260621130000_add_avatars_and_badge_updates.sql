-- Veno Profile Avatars Database & Storage Setup

-- 1. Alter profiles table to add avatar_url field if it does not exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Drop and recreate the public view of profiles to include avatar_url
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
  created_at,
  avatar_url
FROM public.profiles;

-- Grant SELECT access on the public view to all authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;

-- 3. Create the avatars storage bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true, -- public bucket so images are accessible via public URL
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- 4. Enable RLS policies on storage.objects for the avatars bucket
-- 4.1 Allow public select access to anyone
CREATE POLICY "Allow public read access on avatars" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'avatars');

-- 4.2 Allow authenticated users to upload their own avatar
CREATE POLICY "Allow authenticated users to upload avatars" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'avatars' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- 4.3 Allow authenticated users to update their own avatar
CREATE POLICY "Allow authenticated users to update avatars" ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'avatars' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- 4.4 Allow authenticated users to delete their own avatar
CREATE POLICY "Allow authenticated users to delete avatars" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'avatars' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );
