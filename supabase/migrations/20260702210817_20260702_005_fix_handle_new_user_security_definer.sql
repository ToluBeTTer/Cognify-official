/*
# Fix handle_new_user trigger — SECURITY DEFINER

## Problem
The handle_new_user() trigger function runs without SECURITY DEFINER, so it
executes in the calling role's context where auth.uid() is NULL. The profiles
INSERT RLS policy has WITH CHECK (auth.uid() = user_id), which evaluates to
NULL = user_id → false, blocking the insert and returning a 500 error during
signup.

## Fix
Recreate handle_new_user() with SECURITY DEFINER so it runs as the function
owner (postgres / service role) which bypasses RLS entirely — the standard
Supabase pattern for auth triggers.

Also set search_path = '' to prevent search-path injection (security best
practice for SECURITY DEFINER functions).
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;
