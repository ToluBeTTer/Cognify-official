/*
  Auto-promote whitelisted emails

  When a user signs up with an email that's in approved_team_emails,
  automatically grant them the intended role and mark the email as used.

  This solves the "first admin" bootstrap problem and streamlines team onboarding.
*/

-- Trigger function to auto-promote whitelisted emails
CREATE OR REPLACE FUNCTION public.handle_whitelisted_email_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approved_email public.approved_team_emails;
  v_profile public.profiles;
BEGIN
  -- Check if this profile already exists (prevent recursion)
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = NEW.id LIMIT 1;
  
  -- Check if the email is whitelisted
  SELECT * INTO v_approved_email
  FROM public.approved_team_emails
  WHERE email = NEW.email
    AND (is_used = false OR is_used IS NULL);
  
  IF FOUND THEN
    -- Update the profile role to the intended role
    UPDATE public.profiles
    SET role = v_approved_email.intended_role,
        role_approved_at = now(),
        role_approved_by = NEW.id,
        updated_at = now()
    WHERE user_id = NEW.id;
    
    -- If promoting to creator, create creator_profile
    IF v_approved_email.intended_role = 'creator' THEN
      INSERT INTO public.creator_profiles (profile_id, approved_at)
      SELECT id, now() FROM public.profiles WHERE user_id = NEW.id
      ON CONFLICT (profile_id) DO UPDATE SET approved_at = now();
    END IF;
    
    -- Mark the email as used
    UPDATE public.approved_team_emails
    SET is_used = true,
        used_at = now(),
        used_by = NEW.id,
        updated_at = now()
    WHERE id = v_approved_email.id;
    
    -- Log the auto-promotion
    INSERT INTO public.audit_logs (actor_id, action, target_user_id, old_value, new_value, metadata)
    VALUES (
      NEW.id,
      'role_changed',
      NEW.id,
      jsonb_build_object('role', 'student'),
      jsonb_build_object('role', v_approved_email.intended_role),
      jsonb_build_object('source', 'whitelisted_email', 'email', NEW.email)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger that fires AFTER insert on auth.users (after profile is created by handle_new_user)
DROP TRIGGER IF EXISTS on_user_created_whitelist_promo ON auth.users;
CREATE TRIGGER on_user_created_whitelist_promo
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_whitelisted_email_promotion();

-- Also create a function to manually promote a whitelisted user who already exists
CREATE OR REPLACE FUNCTION public.promote_whitelisted_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_approved_email public.approved_team_emails;
  v_old_role public.user_role;
BEGIN
  -- Get the user's email
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Check if whitelisted
  SELECT * INTO v_approved_email
  FROM public.approved_team_emails
  WHERE email = v_email
    AND (is_used = false OR is_used IS NULL);
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Email is not in the whitelist or has already been used';
  END IF;
  
  -- Get current role
  SELECT role INTO v_old_role FROM public.profiles WHERE user_id = p_user_id;
  
  -- Update role
  UPDATE public.profiles
  SET role = v_approved_email.intended_role,
      role_approved_at = now(),
      role_approved_by = p_user_id,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Create creator profile if needed
  IF v_approved_email.intended_role = 'creator' THEN
    INSERT INTO public.creator_profiles (profile_id, approved_at)
    SELECT id, now() FROM public.profiles WHERE user_id = p_user_id
    ON CONFLICT (profile_id) DO UPDATE SET approved_at = now();
  END IF;
  
  -- Mark email as used
  UPDATE public.approved_team_emails
  SET is_used = true,
      used_at = now(),
      used_by = p_user_id,
      updated_at = now()
  WHERE id = v_approved_email.id;
  
  -- Log it
  INSERT INTO public.audit_logs (actor_id, action, target_user_id, old_value, new_value, metadata)
  VALUES (
    p_user_id,
    'role_changed',
    p_user_id,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', v_approved_email.intended_role),
    jsonb_build_object('source', 'whitelisted_email_manual', 'email', v_email)
  );
  
  RETURN jsonb_build_object('success', true, 'role', v_approved_email.intended_role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_whitelisted_user(uuid) TO authenticated;