-- Create RPC function to check if phone number already exists for another user
CREATE OR REPLACE FUNCTION public.check_phone_exists(phone text, current_user_id uuid DEFAULT NULL)
RETURNS boolean AS $$
DECLARE
  caller_id uuid;
BEGIN
  caller_id := COALESCE(current_user_id, auth.uid());
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE phone_number = phone 
      AND (caller_id IS NULL OR id <> caller_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_phone_exists(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_phone_exists(text, uuid) TO anon;
