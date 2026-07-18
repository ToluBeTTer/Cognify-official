-- Fix change_user_role function to handle creator profile creation properly

CREATE OR REPLACE FUNCTION change_user_role(
  p_target_user_id UUID,
  p_new_role user_role,
  p_reason TEXT DEFAULT ''
) RETURNS JSONB AS $$
DECLARE
  v_old_role user_role;
  v_profile_id UUID;
  v_existing_creator_profile UUID;
BEGIN
  -- Safety check: ensure caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role
  ) THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;

  -- Get current role and profile ID
  SELECT role, id INTO v_old_role, v_profile_id
  FROM profiles
  WHERE user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Update the profile role
  UPDATE profiles
  SET 
    role = p_new_role,
    role_approved_at = now(),
    role_approved_by = auth.uid(),
    updated_at = now()
  WHERE user_id = p_target_user_id;

  -- Handle creator_profiles table
  IF p_new_role = 'creator'::user_role THEN
    -- Check if creator profile already exists
    SELECT id INTO v_existing_creator_profile
    FROM creator_profiles
    WHERE profile_id = v_profile_id;

    IF v_existing_creator_profile IS NULL THEN
      -- Create new creator profile
      INSERT INTO creator_profiles (
        profile_id,
        is_available,
        is_active,
        approved_at,
        total_responses,
        total_claims,
        active_claims,
        max_active_claims
      ) VALUES (
        v_profile_id,
        true,
        true,
        now(),
        0,
        0,
        0,
        5
      );
    ELSE
      -- Update existing creator profile
      UPDATE creator_profiles
      SET 
        approved_at = now(),
        is_active = true,
        is_available = true
      WHERE id = v_existing_creator_profile;
    END IF;
  END IF;

  -- If changing FROM creator, deactivate their creator profile
  IF v_old_role = 'creator'::user_role AND p_new_role != 'creator'::user_role THEN
    UPDATE creator_profiles
    SET is_active = false
    WHERE profile_id = v_profile_id;
  END IF;

  -- Create audit log
  INSERT INTO audit_logs (
    actor_id,
    action,
    target_user_id,
    old_value,
    new_value,
    metadata
  ) VALUES (
    auth.uid(),
    'role_changed'::text,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
