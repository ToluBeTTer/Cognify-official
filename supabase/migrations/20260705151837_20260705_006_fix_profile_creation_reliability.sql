/*
# Fix profile creation reliability

## Summary
Makes the entire profile creation and auth flow deterministic.

## Changes

### 1. handle_new_user trigger — idempotent upsert
Previously: plain INSERT that would fail silently if a profile row already existed
(e.g. if the trigger fired twice, or if a prior partial signup left a row).
Now: INSERT ... ON CONFLICT (user_id) DO UPDATE to ensure the profile always has
current email and full_name, and never throws a duplicate-key error.

### 2. ensure_profile_exists function — client-callable fallback
A SECURITY DEFINER function that the frontend can call if the trigger didn't fire
(e.g. race condition, trigger error). Returns the profile row so the caller can
proceed immediately without a second round-trip.

### 3. RLS: add DELETE policy (missing previously)
Profiles didn't have a DELETE policy; adding it for completeness even though
application UI doesn't expose deletion.

## Important notes
- SECURITY DEFINER on ensure_profile_exists means it runs as the table owner
  (bypasses RLS), which is intentional — a freshly created auth user must be
  able to bootstrap their own profile row before RLS grants them access.
- The function is callable by the authenticated role only (GRANT below).
- ON CONFLICT target is user_id (unique constraint must exist — verified).
*/

-- 1. Make handle_new_user idempotent
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET
      email     = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Client-callable fallback: ensure a profile row exists for the calling user
CREATE OR REPLACE FUNCTION public.ensure_profile_exists(
  p_email    text,
  p_full_name text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (auth.uid(), p_email, p_full_name)
  ON CONFLICT (user_id) DO UPDATE
    SET
      email      = EXCLUDED.email,
      full_name  = COALESCE(EXCLUDED.full_name, profiles.full_name),
      updated_at = now()
  RETURNING * INTO v_profile;
  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_profile_exists(text, text) TO authenticated;

-- 3. Add missing DELETE policy on profiles
DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
