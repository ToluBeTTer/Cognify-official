-- Fix role change functions to ensure they work correctly
-- The issue: functions use auth.uid() which should work, but let's ensure 
-- consistency by adding better error handling

-- 1. Fix change_user_role to use get_my_role() for consistency and better debugging
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
  -- Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Get caller role using our helper (which is SECURITY DEFINER)
  v_caller_role := public.get_my_role();
  
  IF v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can change user roles (your role: %)', v_caller_role;
  END IF;

  -- Get target user info
  SELECT role, id INTO v_old_role, v_profile_id
  FROM profiles
  WHERE user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found for user_id: %', p_target_user_id;
  END IF;

  -- Update role
  UPDATE profiles
  SET role = p_new_role,
      role_approved_at = now(),
      role_approved_by = auth.uid(),
      updated_at = now()
  WHERE user_id = p_target_user_id;

  -- Handle creator_profiles
  IF p_new_role = 'creator' THEN
    INSERT INTO creator_profiles (profile_id, is_available, is_active, approved_at, total_responses, total_claims, active_claims, max_active_claims)
    VALUES (v_profile_id, true, true, now(), 0, 0, 0, 5)
    ON CONFLICT (profile_id) DO UPDATE
    SET approved_at = now(), is_active = true, is_available = true;
  END IF;

  IF v_old_role = 'creator' AND p_new_role != 'creator' THEN
    UPDATE creator_profiles SET is_active = false WHERE profile_id = v_profile_id;
  END IF;

  -- Audit log
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

-- 2. Fix approve_role_request to use consistent pattern
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
  -- Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  v_caller_role := public.get_my_role();
  
  IF v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can approve role requests (your role: %)', v_caller_role;
  END IF;

  SELECT * INTO v_request FROM public.role_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request is not pending (status: %)', v_request.status;
  END IF;

  v_old_role := v_request.existing_role;
  v_new_role := v_request.requested_role;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_request.user_id;

  -- Approve the request
  UPDATE public.role_requests
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_notes = p_admin_notes,
      updated_at = now()
  WHERE id = p_request_id;

  -- Update profile role
  UPDATE public.profiles
  SET role = v_new_role,
      role_approved_at = now(),
      role_approved_by = auth.uid(),
      updated_at = now()
  WHERE user_id = v_request.user_id;

  -- Handle creator_profiles
  IF v_new_role = 'creator' AND v_profile_id IS NOT NULL THEN
    INSERT INTO public.creator_profiles (profile_id, is_available, is_active, approved_at, total_responses, total_claims, active_claims, max_active_claims)
    VALUES (v_profile_id, true, true, now(), 0, 0, 0, 5)
    ON CONFLICT (profile_id) DO UPDATE
    SET approved_at = now(), is_active = true, is_available = true;
  END IF;

  IF v_old_role = 'creator' AND v_new_role != 'creator' AND v_profile_id IS NOT NULL THEN
    UPDATE public.creator_profiles SET is_active = false WHERE profile_id = v_profile_id;
  END IF;

  -- Audit log
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

-- 3. Fix reject_role_request
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
  -- Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  v_caller_role := public.get_my_role();
  
  IF v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can reject role requests (your role: %)', v_caller_role;
  END IF;

  SELECT * INTO v_request FROM public.role_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request is not pending (status: %)', v_request.status;
  END IF;

  -- Reject the request
  UPDATE public.role_requests
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_notes = p_admin_notes,
      updated_at = now()
  WHERE id = p_request_id;

  -- Audit log
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