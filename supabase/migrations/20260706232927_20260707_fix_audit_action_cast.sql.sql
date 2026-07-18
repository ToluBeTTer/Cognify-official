-- Fix: audit_logs.action is enum type audit_action, not text
-- All functions that insert into audit_logs must cast the action to audit_action

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
  v_caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_caller_role := public.get_my_role();

  IF v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can change user roles (your role: %)', v_caller_role;
  END IF;

  SELECT role, id INTO v_old_role, v_profile_id
  FROM profiles
  WHERE user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found for user_id: %', p_target_user_id;
  END IF;

  UPDATE profiles
  SET role = p_new_role,
      role_approved_at = now(),
      role_approved_by = auth.uid(),
      updated_at = now()
  WHERE user_id = p_target_user_id;

  IF p_new_role = 'creator' THEN
    INSERT INTO creator_profiles (profile_id, is_available, is_active, approved_at, total_responses, total_claims, active_claims, max_active_claims)
    VALUES (v_profile_id, true, true, now(), 0, 0, 0, 5)
    ON CONFLICT (profile_id) DO UPDATE
    SET approved_at = now(), is_active = true, is_available = true;
  END IF;

  IF v_old_role = 'creator' AND p_new_role != 'creator' THEN
    UPDATE creator_profiles SET is_active = false WHERE profile_id = v_profile_id;
  END IF;

  INSERT INTO audit_logs (actor_id, action, target_user_id, old_value, new_value, metadata)
  VALUES (
    auth.uid(),
    'role_changed'::audit_action,
    p_target_user_id,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_new_role),
    jsonb_build_object('reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'user_id', p_target_user_id, 'old_role', v_old_role, 'new_role', p_new_role);
END;
$$;

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
  v_caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_caller_role := public.get_my_role();

  IF v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can approve role requests (your role: %)', v_caller_role;
  END IF;

  SELECT * INTO v_request FROM public.role_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_request.status != 'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;

  v_old_role := v_request.existing_role;
  v_new_role := v_request.requested_role;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_request.user_id;

  UPDATE public.role_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
      admin_notes = p_admin_notes, updated_at = now()
  WHERE id = p_request_id;

  UPDATE public.profiles
  SET role = v_new_role, role_approved_at = now(), role_approved_by = auth.uid(), updated_at = now()
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
    'role_request_approved'::audit_action,
    v_request.user_id,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', v_new_role),
    jsonb_build_object('request_id', p_request_id, 'notes', p_admin_notes)
  );

  RETURN jsonb_build_object('success', true, 'user_id', v_request.user_id, 'new_role', v_new_role);
END;
$$;

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
  v_caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_caller_role := public.get_my_role();

  IF v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can reject role requests (your role: %)', v_caller_role;
  END IF;

  SELECT * INTO v_request FROM public.role_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_request.status != 'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;

  UPDATE public.role_requests
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
      admin_notes = p_admin_notes, updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.audit_logs (actor_id, action, target_user_id, old_value, new_value, metadata)
  VALUES (
    auth.uid(),
    'role_request_rejected'::audit_action,
    v_request.user_id,
    jsonb_build_object('role', v_request.existing_role),
    jsonb_build_object('role', v_request.existing_role),
    jsonb_build_object('request_id', p_request_id, 'notes', p_admin_notes)
  );

  RETURN jsonb_build_object('success', true, 'user_id', v_request.user_id);
END;
$$;

-- Also fix add_team_email and remove_team_email which have the same cast issue
CREATE OR REPLACE FUNCTION public.add_team_email(p_email text, p_intended_role user_role DEFAULT 'creator', p_notes text DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF public.get_my_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can add team emails';
  END IF;

  INSERT INTO public.approved_team_emails (email, intended_role, invited_by, notes)
  VALUES (p_email, p_intended_role, auth.uid(), p_notes)
  ON CONFLICT (email) DO UPDATE
  SET intended_role = p_intended_role, notes = p_notes, is_used = false, updated_at = now();

  INSERT INTO public.audit_logs (actor_id, action, target_entity_type, new_value, metadata)
  VALUES (
    auth.uid(),
    'team_email_added'::audit_action,
    'approved_team_email',
    jsonb_build_object('email', p_email, 'intended_role', p_intended_role),
    jsonb_build_object('notes', p_notes)
  );

  RETURN jsonb_build_object('success', true, 'email', p_email);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_team_email(p_email text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF public.get_my_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can remove team emails';
  END IF;

  DELETE FROM public.approved_team_emails WHERE email = p_email;

  INSERT INTO public.audit_logs (actor_id, action, target_entity_type, old_value, metadata)
  VALUES (
    auth.uid(),
    'team_email_removed'::audit_action,
    'approved_team_email',
    jsonb_build_object('email', p_email),
    '{}'::jsonb
  );

  RETURN jsonb_build_object('success', true, 'email', p_email);
END;
$$;