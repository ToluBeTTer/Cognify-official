
-- 1. Add missing admin UPDATE policy on profiles
CREATE POLICY "profiles_admin_update_all" ON profiles
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- 2. Fix whitelist trigger - move from auth.users to profiles INSERT
-- (profiles INSERT fires after handle_new_user creates the profile row, no race condition)
DROP TRIGGER IF EXISTS on_user_created_whitelist_promo ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_whitelisted_email_on_profile()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_approved_email public.approved_team_emails;
BEGIN
  SELECT * INTO v_approved_email
  FROM public.approved_team_emails
  WHERE email = NEW.email
  AND (is_used = false OR is_used IS NULL);

  IF FOUND THEN
    UPDATE public.profiles
    SET role = v_approved_email.intended_role,
        role_approved_at = now(),
        role_approved_by = NEW.user_id,
        updated_at = now()
    WHERE id = NEW.id;

    IF v_approved_email.intended_role = 'creator' THEN
      INSERT INTO public.creator_profiles (profile_id, approved_at, is_active, is_available)
      VALUES (NEW.id, now(), true, true)
      ON CONFLICT (profile_id) DO UPDATE SET approved_at = now(), is_active = true, is_available = true;
    END IF;

    UPDATE public.approved_team_emails
    SET is_used = true,
        used_at = now(),
        used_by = NEW.user_id,
        updated_at = now()
    WHERE id = v_approved_email.id;

    INSERT INTO public.audit_logs (actor_id, action, target_user_id, old_value, new_value, metadata)
    VALUES (
      NEW.user_id,
      'role_changed',
      NEW.user_id,
      jsonb_build_object('role', 'student'),
      jsonb_build_object('role', v_approved_email.intended_role),
      jsonb_build_object('source', 'whitelisted_email', 'email', NEW.email)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_whitelist_promo ON public.profiles;

CREATE TRIGGER on_profile_created_whitelist_promo
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_whitelisted_email_on_profile();

-- 3. Fix promote_whitelisted_user - allow promoting already-registered users
CREATE OR REPLACE FUNCTION public.promote_whitelisted_user(p_user_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
  v_approved_email public.approved_team_emails;
  v_old_role public.user_role;
  v_profile_id uuid;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT * INTO v_approved_email
  FROM public.approved_team_emails
  WHERE email = v_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Email is not in the whitelist';
  END IF;

  SELECT role, id INTO v_old_role, v_profile_id FROM public.profiles WHERE user_id = p_user_id;

  UPDATE public.profiles
  SET role = v_approved_email.intended_role,
      role_approved_at = now(),
      role_approved_by = p_user_id,
      updated_at = now()
  WHERE user_id = p_user_id;

  IF v_approved_email.intended_role = 'creator' THEN
    INSERT INTO public.creator_profiles (profile_id, approved_at, is_active, is_available)
    VALUES (v_profile_id, now(), true, true)
    ON CONFLICT (profile_id) DO UPDATE SET approved_at = now(), is_active = true, is_available = true;
  END IF;

  UPDATE public.approved_team_emails
  SET is_used = true,
      used_at = now(),
      used_by = p_user_id,
      updated_at = now()
  WHERE id = v_approved_email.id;

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

-- 4. Re-create approve_role_request with full creator_profiles handling
CREATE OR REPLACE FUNCTION public.approve_role_request(
  p_request_id uuid,
  p_admin_notes text DEFAULT NULL
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_request public.role_requests;
  v_old_role public.user_role;
  v_new_role public.user_role;
  v_profile_id uuid;
BEGIN
  IF public.get_my_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can approve role requests';
  END IF;

  SELECT * INTO v_request FROM public.role_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request is not pending';
  END IF;

  v_old_role := v_request.existing_role;
  v_new_role := v_request.requested_role;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_request.user_id;

  UPDATE public.role_requests
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_notes = p_admin_notes,
      updated_at = now()
  WHERE id = p_request_id;

  UPDATE public.profiles
  SET role = v_new_role,
      role_approved_at = now(),
      role_approved_by = auth.uid(),
      updated_at = now()
  WHERE user_id = v_request.user_id;

  IF v_new_role = 'creator' AND v_profile_id IS NOT NULL THEN
    INSERT INTO public.creator_profiles (profile_id, is_available, is_active, approved_at, total_responses, total_claims, active_claims, max_active_claims)
    VALUES (v_profile_id, true, true, now(), 0, 0, 0, 5)
    ON CONFLICT (profile_id) DO UPDATE
    SET approved_at = now(), is_active = true, is_available = true;
  END IF;

  IF v_old_role = 'creator' AND v_new_role != 'creator' AND v_profile_id IS NOT NULL THEN
    UPDATE public.creator_profiles SET is_active = false WHERE profile_id = v_profile_id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, target_user_id, old_value, new_value, metadata)
  VALUES (
    auth.uid(),
    'role_request_approved',
    v_request.user_id,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', v_new_role),
    jsonb_build_object('request_id', p_request_id, 'notes', p_admin_notes)
  );

  RETURN jsonb_build_object('success', true, 'user_id', v_request.user_id, 'new_role', v_new_role);
END;
$$;

-- 5. Re-create reject_role_request
CREATE OR REPLACE FUNCTION public.reject_role_request(
  p_request_id uuid,
  p_admin_notes text DEFAULT NULL
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_request public.role_requests;
BEGIN
  IF public.get_my_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can reject role requests';
  END IF;

  SELECT * INTO v_request FROM public.role_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request is not pending';
  END IF;

  UPDATE public.role_requests
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_notes = p_admin_notes,
      updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.audit_logs (actor_id, action, target_user_id, old_value, new_value, metadata)
  VALUES (
    auth.uid(),
    'role_request_rejected',
    v_request.user_id,
    jsonb_build_object('role', v_request.existing_role),
    jsonb_build_object('role', v_request.existing_role),
    jsonb_build_object('request_id', p_request_id, 'notes', p_admin_notes)
  );

  RETURN jsonb_build_object('success', true, 'user_id', v_request.user_id);
END;
$$;

-- 6. Re-create change_user_role with fix for creator_profiles unique constraint
CREATE OR REPLACE FUNCTION public.change_user_role(
  p_target_user_id uuid,
  p_new_role user_role,
  p_reason text DEFAULT ''
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_old_role user_role;
  v_profile_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role
  ) THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;

  SELECT role, id INTO v_old_role, v_profile_id
  FROM profiles
  WHERE user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  UPDATE profiles
  SET role = p_new_role,
      role_approved_at = now(),
      role_approved_by = auth.uid(),
      updated_at = now()
  WHERE user_id = p_target_user_id;

  IF p_new_role = 'creator'::user_role THEN
    INSERT INTO creator_profiles (profile_id, is_available, is_active, approved_at, total_responses, total_claims, active_claims, max_active_claims)
    VALUES (v_profile_id, true, true, now(), 0, 0, 0, 5)
    ON CONFLICT (profile_id) DO UPDATE
    SET approved_at = now(), is_active = true, is_available = true;
  END IF;

  IF v_old_role = 'creator'::user_role AND p_new_role != 'creator'::user_role THEN
    UPDATE creator_profiles SET is_active = false WHERE profile_id = v_profile_id;
  END IF;

  INSERT INTO audit_logs (actor_id, action, target_user_id, old_value, new_value, metadata)
  VALUES (
    auth.uid(),
    'role_changed'::text,
    p_target_user_id,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_new_role),
    jsonb_build_object('reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'user_id', p_target_user_id, 'old_role', v_old_role, 'new_role', p_new_role);
END;
$$;

-- 7. Backfill: promote existing whitelisted-email users who are still students
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT ae.email, ae.intended_role, ae.id as email_id, p.user_id, p.id as profile_id
    FROM public.approved_team_emails ae
    JOIN public.profiles p ON p.email = ae.email
    WHERE (ae.is_used = false OR ae.is_used IS NULL)
    AND p.role = 'student'
  LOOP
    UPDATE public.profiles
    SET role = r.intended_role::public.user_role,
        role_approved_at = now(),
        updated_at = now()
    WHERE user_id = r.user_id;

    IF r.intended_role = 'creator' THEN
      INSERT INTO public.creator_profiles (profile_id, approved_at, is_active, is_available)
      VALUES (r.profile_id, now(), true, true)
      ON CONFLICT (profile_id) DO UPDATE SET approved_at = now(), is_active = true, is_available = true;
    END IF;

    UPDATE public.approved_team_emails
    SET is_used = true, used_at = now(), used_by = r.user_id, updated_at = now()
    WHERE id = r.email_id;
  END LOOP;
END;
$$;
