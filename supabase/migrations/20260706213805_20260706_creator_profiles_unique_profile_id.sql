
-- Add unique constraint on creator_profiles.profile_id so ON CONFLICT works
ALTER TABLE public.creator_profiles ADD CONSTRAINT creator_profiles_profile_id_key UNIQUE (profile_id);
