-- Create the identity-documents bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'identity-documents',
    'identity-documents',
    false, -- Keep it private
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage.objects
-- 1. Enable authenticated users to insert files into their own subdirectory [user_id]
CREATE POLICY "Allow users to upload identity documents" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'identity-documents' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- 2. Enable authenticated users to select files from their own subdirectory
CREATE POLICY "Allow users to view their own identity documents" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'identity-documents' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- 3. Enable authenticated users to delete files from their own subdirectory
CREATE POLICY "Allow users to delete their own identity documents" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'identity-documents' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );
