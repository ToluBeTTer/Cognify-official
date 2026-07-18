/*
  Team Approval System
  
  This migration adds:
  1. approved_team_emails - whitelist of emails that can be promoted to creator/admin
  2. role_requests - requests from users who want creator/admin access
  3. audit_logs - tracks role changes and important admin actions
  4. Additional columns on profiles to track role approval status
*/

-- ============================================================
-- 1. Add approval tracking columns to profiles
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS role_approved_by uuid REFERENCES auth.users(id);

-- ============================================================
-- 2. Approved team emails whitelist
-- ============================================================

CREATE TABLE public.approved_team_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  intended_role public.user_role NOT NULL DEFAULT 'creator',
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz DEFAULT now(),
  notes text,
  is_used boolean DEFAULT false,
  used_at timestamptz,
  used_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.approved_team_emails ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can see all, others cannot access
CREATE POLICY "approved_emails_admin_all" ON public.approved_team_emails
  FOR ALL TO authenticated
  USING (public.get_my_role() = 'admin');

-- ============================================================
-- 3. Role requests - for users requesting creator/admin access
-- ============================================================

CREATE TYPE public.role_request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE TABLE public.role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  existing_role public.user_role NOT NULL,
  requested_role public.user_role NOT NULL,
  status public.role_request_status DEFAULT 'pending',
  reason text,
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_role_change CHECK (
    (existing_role = 'student' AND requested_role IN ('creator', 'admin')) OR
    (existing_role = 'creator' AND requested_role = 'admin')
  )
);

CREATE INDEX idx_role_requests_user ON public.role_requests(user_id);
CREATE INDEX idx_role_requests_status ON public.role_requests(status);

-- Enable RLS
ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see their own requests
CREATE POLICY "role_requests_select_own" ON public.role_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- RLS: Users can insert their own requests
CREATE POLICY "role_requests_insert_own" ON public.role_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS: Users can cancel their own pending requests
CREATE POLICY "role_requests_update_own" ON public.role_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'cancelled'));

-- RLS: Admins can see all requests
CREATE POLICY "role_requests_admin_select" ON public.role_requests
  FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

-- RLS: Admins can update any request
CREATE POLICY "role_requests_admin_update" ON public.role_requests
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ============================================================
-- 4. Audit logs for tracking admin actions
-- ============================================================

CREATE TYPE public.audit_action AS ENUM (
  'role_changed',
  'role_request_approved',
  'role_request_rejected',
  'team_email_added',
  'team_email_removed',
  'user_suspended',
  'user_unsuspended',
  'question_claimed',
  'question_released',
  'response_approved',
  'response_rejected'
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action public.audit_action NOT NULL,
  target_user_id uuid REFERENCES auth.users(id),
  target_entity_type text,
  target_entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_target_user ON public.audit_logs(target_user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can view audit logs
CREATE POLICY "audit_logs_admin_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

-- RLS: Anyone authenticated can insert (for system actions)
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- 5. Helper functions for role management
-- ============================================================

-- Function to approve a role request (admin only)
CREATE OR REPLACE FUNCTION public.approve_role_request(
  p_request_id uuid,
  p_admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.role_requests;
  v_old_role public.user_role;
  v_new_role public.user_role;
BEGIN
  -- Verify caller is admin
  IF public.get_my_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can approve role requests';
  END IF;
  
  -- Get the request
  SELECT * INTO v_request FROM public.role_requests WHERE id = p_request_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request is not pending';
  END IF;
  
  v_old_role := v_request.existing_role;
  v_new_role := v_request.requested_role;
  
  -- Update the request
  UPDATE public.role_requests
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_notes = p_admin_notes,
      updated_at = now()
  WHERE id = p_request_id;
  
  -- Update the user's role
  UPDATE public.profiles
  SET role = v_new_role,
      role_approved_at = now(),
      role_approved_by = auth.uid(),
      updated_at = now()
  WHERE user_id = v_request.user_id;
  
  -- If setting to creator, create creator_profile if needed
  IF v_new_role = 'creator' THEN
    INSERT INTO public.creator_profiles (profile_id, approved_at)
    SELECT id, now() FROM public.profiles WHERE user_id = v_request.user_id
    ON CONFLICT (profile_id) DO UPDATE SET approved_at = now();
  END IF;
  
  -- Create audit log
  INSERT INTO public.audit_logs (actor_id, action, target_user_id, old_value, new_value, metadata)
  VALUES (
    auth.uid(),
    'role_request_approved',
    v_request.user_id,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', v_new_role),
    jsonb_build_object('request_id', p_request_id, 'notes', p_admin_notes)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_request.user_id,
    'new_role', v_new_role
  );
END;
$$;

-- Function to reject a role request (admin only)
CREATE OR REPLACE FUNCTION public.reject_role_request(
  p_request_id uuid,
  p_admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.role_requests;
BEGIN
  -- Verify caller is admin
  IF public.get_my_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can reject role requests';
  END IF;
  
  -- Get the request
  SELECT * INTO v_request FROM public.role_requests WHERE id = p_request_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request is not pending';
  END IF;
  
  -- Update the request
  UPDATE public.role_requests
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_notes = p_admin_notes,
      updated_at = now()
  WHERE id = p_request_id;
  
  -- Create audit log
  INSERT INTO public.audit_logs (actor_id, action, target_user_id, old_value, new_value, metadata)
  VALUES (
    auth.uid(),
    'role_request_rejected',
    v_request.user_id,
    jsonb_build_object('role', v_request.existing_role),
    jsonb_build_object('requested_role', v_request.requested_role),
    jsonb_build_object('request_id', p_request_id, 'notes', p_admin_notes)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_request.user_id,
    'status', 'rejected'
  );
END;
$$;

-- Function to directly change a user's role (admin only)
CREATE OR REPLACE FUNCTION public.change_user_role(
  p_target_user_id uuid,
  p_new_role public.user_role,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_role public.user_role;
  v_profile_id uuid;
BEGIN
  -- Verify caller is admin
  IF public.get_my_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;
  
  -- Get current role
  SELECT role, id INTO v_old_role, v_profile_id FROM public.profiles WHERE user_id = p_target_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Update the role
  UPDATE public.profiles
  SET role = p_new_role,
      role_approved_at = now(),
      role_approved_by = auth.uid(),
      updated_at = now()
  WHERE user_id = p_target_user_id;
  
  -- If setting to creator, create creator_profile if needed
  IF p_new_role = 'creator' THEN
    INSERT INTO public.creator_profiles (profile_id, approved_at)
    VALUES (v_profile_id, now())
    ON CONFLICT (profile_id) DO UPDATE SET approved_at = now();
  END IF;
  
  -- Create audit log
  INSERT INTO public.audit_logs (actor_id, action, target_user_id, old_value, new_value, metadata)
  VALUES (
    auth.uid(),
    'role_changed',
    p_target_user_id,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_new_role),
    jsonb_build_object('reason', p_reason)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'old_role', v_old_role,
    'new_role', p_new_role
  );
END;
$$;

-- Function to add an approved team email (admin only)
CREATE OR REPLACE FUNCTION public.add_team_email(
  p_email text,
  p_intended_role public.user_role DEFAULT 'creator',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin
  IF public.get_my_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can add team emails';
  END IF;
  
  -- Insert the email
  INSERT INTO public.approved_team_emails (email, intended_role, invited_by, notes)
  VALUES (p_email, p_intended_role, auth.uid(), p_notes)
  ON CONFLICT (email) DO UPDATE
    SET intended_role = p_intended_role,
        notes = p_notes,
        is_used = false,
        updated_at = now();
  
  -- Create audit log
  INSERT INTO public.audit_logs (actor_id, action, target_entity_type, new_value, metadata)
  VALUES (
    auth.uid(),
    'team_email_added',
    'approved_team_email',
    jsonb_build_object('email', p_email, 'intended_role', p_intended_role),
    jsonb_build_object('notes', p_notes)
  );
  
  RETURN jsonb_build_object('success', true, 'email', p_email);
END;
$$;

-- Function to remove an approved team email (admin only)
CREATE OR REPLACE FUNCTION public.remove_team_email(
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin
  IF public.get_my_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can remove team emails';
  END IF;
  
  DELETE FROM public.approved_team_emails WHERE email = p_email;
  
  -- Create audit log
  INSERT INTO public.audit_logs (actor_id, action, target_entity_type, old_value, metadata)
  VALUES (
    auth.uid(),
    'team_email_removed',
    'approved_team_email',
    jsonb_build_object('email', p_email),
    '{}'::jsonb
  );
  
  RETURN jsonb_build_object('success', true, 'email', p_email);
END;
$$;

-- Function to check if email is approved for team access
CREATE OR REPLACE FUNCTION public.is_email_approved_for_role(
  p_email text,
  p_role public.user_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.approved_team_emails
    WHERE email = p_email
      AND intended_role = p_role
      AND (is_used = false OR is_used IS NULL)
  );
$$;

-- Function to mark an approved email as used (called during signup/onboarding)
CREATE OR REPLACE FUNCTION public.use_approved_email(
  p_email text,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.approved_team_emails
  SET is_used = true,
      used_at = now(),
      used_by = p_user_id,
      updated_at = now()
  WHERE email = p_email
    AND (is_used = false OR is_used IS NULL);
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.approve_role_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_role_request(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_role_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_role_request(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.change_user_role(uuid, public.user_role, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_user_role(uuid, public.user_role, text) TO authenticated;

REVOKE ALL ON FUNCTION public.add_team_email(text, public.user_role, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_team_email(text, public.user_role, text) TO authenticated;

REVOKE ALL ON FUNCTION public.remove_team_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_team_email(text) TO authenticated;

REVOKE ALL ON FUNCTION public.is_email_approved_for_role(text, public.user_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_email_approved_for_role(text, public.user_role) TO authenticated;

-- ============================================================
-- 6. Seed the official admin account
-- ============================================================

-- Add the official Cognify Gmail to approved team emails for admin role
INSERT INTO public.approved_team_emails (email, intended_role, notes)
VALUES ('web.cognify.ai@gmail.com', 'admin', 'Official Cognify business/admin account')
ON CONFLICT (email) DO UPDATE
  SET intended_role = 'admin',
      notes = 'Official Cognify business/admin account',
      updated_at = now();