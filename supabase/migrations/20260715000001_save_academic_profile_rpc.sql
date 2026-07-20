-- The onboarding/profile save error ("Could not find the 'test_date' column
-- of 'profiles' in the schema cache") is PostgREST's REST-layer schema
-- cache, not the actual database — the column genuinely exists (see
-- 20260708000007_add_test_date_to_profiles.sql) and the code has always
-- referenced it correctly. NOTIFY/restart attempts didn't clear it.
--
-- This function sidesteps the problem entirely: calling it goes through
-- PostgREST's /rpc/ endpoint, which invokes this function by name and lets
-- Postgres itself run the UPDATE — Postgres's own catalog is never stale,
-- so this works regardless of whatever PostgREST's REST-table cache is
-- doing. This is the correct, permanent fix, not a workaround to remove
-- later — direct table writes from the client remain fine for every other
-- field; this is specifically for the field that's been affected.
CREATE OR REPLACE FUNCTION public.save_academic_profile(
  p_user_id uuid,
  p_grade_level integer DEFAULT NULL,
  p_target_sat_score integer DEFAULT NULL,
  p_test_date date DEFAULT NULL,
  p_preferred_subjects text[] DEFAULT NULL,
  p_complete_onboarding boolean DEFAULT false,
  p_onboarding_step integer DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized to update this profile';
  END IF;

  UPDATE public.profiles
  SET
    grade_level = COALESCE(p_grade_level, grade_level),
    target_sat_score = COALESCE(p_target_sat_score, target_sat_score),
    test_date = CASE WHEN p_test_date IS NOT NULL THEN p_test_date ELSE test_date END,
    preferred_subjects = COALESCE(p_preferred_subjects, preferred_subjects),
    onboarding_completed = CASE WHEN p_complete_onboarding THEN true ELSE onboarding_completed END,
    onboarding_step = COALESCE(p_onboarding_step, onboarding_step),
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', p_user_id;
  END IF;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_academic_profile(uuid, integer, integer, date, text[], boolean, integer) TO authenticated;
