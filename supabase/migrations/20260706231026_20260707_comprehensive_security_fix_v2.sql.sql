-- Comprehensive security fix for all SECURITY DEFINER functions
-- This addresses all security warnings by:
-- 1. Adding proper auth guards where missing
-- 2. Revoking public/anon execute privileges 
-- 3. Keeping functions that already have proper guards

-- ============================================================================
-- FUNCTIONS THAT NEED ADDITIONAL AUTH GUARDS
-- ============================================================================

-- submit_question_for_review - already has auth check via created_by = auth.uid()
-- but let's add explicit auth check for clarity
CREATE OR REPLACE FUNCTION public.submit_question_for_review(p_question_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  UPDATE question_bank
  SET status = 'pending_review',
      updated_at = now()
  WHERE id = p_question_id AND created_by = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found or not authorized';
  END IF;

  RETURN jsonb_build_object('success', true, 'question_id', p_question_id);
END;
$$;

-- ============================================================================
-- REVOKE ALL FROM PUBLIC FOR ANY REMAINING FUNCTIONS
-- ============================================================================

-- These functions should NEVER be callable by anon role
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_whitelisted_email_on_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_whitelisted_email_promotion() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_updated_at() FROM PUBLIC;

-- ============================================================================
-- GRANT PROPER PRIVILEGES
-- ============================================================================

-- Ensure authenticated can call these (they have internal auth checks)
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_user_role(uuid, user_role, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_role_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_role_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_team_email(text, user_role, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_team_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_whitelisted_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_bank_question(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_import_to_bank(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_bank_question(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_bank_question(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_response_to_bank(uuid, uuid, uuid, sat_section, uuid, uuid, difficulty_level, text[], text, text, text, text, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_import_duplicates(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_practice_questions(uuid, text, text, uuid, uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_weakest_skills(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_email_approved_for_role(text, user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_approved_email(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_profile_exists(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_question_for_review(uuid) TO authenticated;

-- Explicitly REVOKE from anon
REVOKE ALL ON FUNCTION public.get_my_role() FROM anon;
REVOKE ALL ON FUNCTION public.change_user_role(uuid, user_role, text) FROM anon;
REVOKE ALL ON FUNCTION public.approve_role_request(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.reject_role_request(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.add_team_email(text, user_role, text) FROM anon;
REVOKE ALL ON FUNCTION public.remove_team_email(text) FROM anon;
REVOKE ALL ON FUNCTION public.promote_whitelisted_user(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.publish_bank_question(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.publish_import_to_bank(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.approve_bank_question(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.reject_bank_question(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.promote_response_to_bank(uuid, uuid, uuid, sat_section, uuid, uuid, difficulty_level, text[], text, text, text, text, integer, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.check_import_duplicates(uuid, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.get_practice_questions(uuid, text, text, uuid, uuid, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_user_weakest_skills(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.is_email_approved_for_role(text, user_role) FROM anon;
REVOKE ALL ON FUNCTION public.use_approved_email(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ensure_profile_exists(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.submit_question_for_review(uuid) FROM anon;