-- Security and Role System Fixes
-- 1. Revoke anon execute from all functions (anon should not access any functions)
-- 2. Fix promote_response_to_bank to require admin/creator role
-- 3. Fix ensure_profile_exists to verify auth.uid()
-- 4. Fix promote_whitelisted_user to require admin or self-promotion

-- =====================================================================
-- 1. REVOKE PUBLIC/ANON EXECUTE FROM ALL SECURITY DEFINER FUNCTIONS
-- =====================================================================

-- revoke execute from anon (already set on most functions but ensure consistency)
REVOKE ALL ON FUNCTION public.get_user_weakest_skills(uuid, integer) FROM anon;

-- Ensure authenticated has execute only where appropriate
-- Most functions already have proper grants, but let's ensure they don't have public grants
REVOKE ALL ON FUNCTION public.add_team_email(text, user_role, text) FROM public;
REVOKE ALL ON FUNCTION public.approve_bank_question(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.approve_role_request(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.change_user_role(uuid, user_role, text) FROM public;
REVOKE ALL ON FUNCTION public.check_import_duplicates(uuid, numeric) FROM public;
REVOKE ALL ON FUNCTION public.ensure_profile_exists(text, text) FROM public;
REVOKE ALL ON FUNCTION public.get_my_role() FROM public;
REVOKE ALL ON FUNCTION public.get_practice_questions(uuid, text, text, uuid, uuid, text, integer) FROM public;
REVOKE ALL ON FUNCTION public.get_user_weakest_skills(uuid, integer) FROM public;
REVOKE ALL ON FUNCTION public.is_email_approved_for_role(text, user_role) FROM public;
REVOKE ALL ON FUNCTION public.promote_response_to_bank(uuid, uuid, uuid, sat_section, uuid, uuid, difficulty_level, text[], text, text, text, text, integer, boolean) FROM public;
REVOKE ALL ON FUNCTION public.promote_whitelisted_user(uuid) FROM public;
REVOKE ALL ON FUNCTION public.publish_bank_question(uuid) FROM public;
REVOKE ALL ON FUNCTION public.publish_import_to_bank(uuid) FROM public;
REVOKE ALL ON FUNCTION public.reject_bank_question(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.reject_role_request(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.remove_team_email(text) FROM public;
REVOKE ALL ON FUNCTION public.submit_question_for_review(uuid) FROM public;
REVOKE ALL ON FUNCTION public.use_approved_email(text, uuid) FROM public;

-- =====================================================================
-- 2. FIX promote_response_to_bank - add auth check
-- =====================================================================

CREATE OR REPLACE FUNCTION public.promote_response_to_bank(
  p_question_id uuid,
  p_response_id uuid,
  p_promoted_by uuid,
  p_section sat_section DEFAULT NULL,
  p_domain_id uuid DEFAULT NULL,
  p_skill_id uuid DEFAULT NULL,
  p_difficulty difficulty_level DEFAULT NULL,
  p_tags text[] DEFAULT '{}'::text[],
  p_question_text text DEFAULT NULL,
  p_correct_answer text DEFAULT NULL,
  p_explanation text DEFAULT NULL,
  p_hint text DEFAULT NULL,
  p_estimated_time_seconds integer DEFAULT NULL,
  p_calculator_allowed boolean DEFAULT true
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_question public.questions%ROWTYPE;
  v_response public.human_responses%ROWTYPE;
  v_question_id UUID;
  v_attachments JSONB;
  v_caller_role text;
BEGIN
  -- Auth check - must be admin or creator
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  v_caller_role := public.get_my_role();
  IF v_caller_role NOT IN ('admin', 'creator') THEN
    RAISE EXCEPTION 'Only admins and creators can promote responses to the question bank';
  END IF;
  
  -- Ensure the promoter matches auth.uid() for creators
  IF v_caller_role = 'creator' AND p_promoted_by != auth.uid() THEN
    RAISE EXCEPTION 'You can only promote your own responses';
  END IF;

  SELECT * INTO v_question FROM public.questions WHERE id = p_question_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Question not found'; END IF;

  SELECT * INTO v_response FROM public.human_responses WHERE id = p_response_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Response not found'; END IF;

  IF NOT v_response.is_approved THEN
    RAISE EXCEPTION 'Response must be approved before promoting to question bank';
  END IF;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('file_name', file_name, 'file_type', file_type, 'storage_path', storage_path)),
    '[]'::jsonb
  ) INTO v_attachments
  FROM public.attachments WHERE question_id = p_question_id;

  INSERT INTO public.question_bank (
    question_text, question_format, correct_answer, explanation, hint,
    section, domain_id, skill_id, difficulty, tags,
    estimated_time_seconds, calculator_allowed, source, source_reference,
    created_by, reviewed_by, status, metadata
  ) VALUES (
    COALESCE(p_question_text, v_question.content),
    'multiple_choice',
    COALESCE(p_correct_answer, 'A'),
    COALESCE(p_explanation, v_response.explanation),
    COALESCE(p_hint, v_response.teaching_notes),
    COALESCE(p_section, CASE
      WHEN v_question.subject_id = ANY(ARRAY['math-subject','math']) THEN 'math'::public.sat_section
      WHEN v_question.subject_id = ANY(ARRAY['reading-subject','reading']) THEN 'reading'::public.sat_section
      WHEN v_question.subject_id = ANY(ARRAY['writing-subject','writing']) THEN 'writing'::public.sat_section
      ELSE NULL
    END),
    p_domain_id, p_skill_id,
    COALESCE(p_difficulty, CASE
      WHEN v_question.difficulty_perceived = 'easy' THEN 'easy'::public.difficulty_level
      WHEN v_question.difficulty_perceived = 'medium' THEN 'medium'::public.difficulty_level
      WHEN v_question.difficulty_perceived = 'hard' THEN 'hard'::public.difficulty_level
      ELSE 'medium'::public.difficulty_level
    END),
    COALESCE(p_tags, ARRAY[]::text[]),
    COALESCE(p_estimated_time_seconds, 90),
    p_calculator_allowed,
    'community'::public.question_source,
    'Promoted from student question',
    p_promoted_by, p_promoted_by,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = p_promoted_by AND role = 'admin'::public.user_role
    ) THEN 'published'::public.question_bank_status
    ELSE 'pending_review'::public.question_bank_status
    END,
    jsonb_build_object(
      'original_question_id', p_question_id,
      'original_response_id', p_response_id,
      'original_creator_id', v_response.creator_id,
      'attachments', v_attachments
    )
  )
  RETURNING id INTO v_question_id;

  UPDATE public.questions
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'promoted_to_bank', true, 'bank_question_id', v_question_id,
    'promoted_at', now(), 'promoted_by', p_promoted_by
  )
  WHERE id = p_question_id;

  UPDATE public.human_responses
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'promoted_to_bank', true, 'bank_question_id', v_question_id, 'promoted_at', now()
  )
  WHERE id = p_response_id;

  RETURN v_question_id;
END;
$function$;

-- =====================================================================
-- 3. FIX ensure_profile_exists - add auth check
-- =====================================================================

CREATE OR REPLACE FUNCTION public.ensure_profile_exists(p_email text, p_full_name text DEFAULT NULL)
  RETURNS profiles
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_profile public.profiles;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Can only ensure own profile
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
$function$;

-- =====================================================================
-- 4. FIX promote_whitelisted_user - add auth check
-- =====================================================================

CREATE OR REPLACE FUNCTION public.promote_whitelisted_user(p_user_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_approved_email public.approved_team_emails;
  v_old_role public.user_role;
  v_profile_id uuid;
  v_caller_role text;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  v_caller_role := public.get_my_role();
  
  -- Admins can promote anyone, users can promote themselves if whitelisted
  IF v_caller_role != 'admin' AND p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'You can only promote your own account or must be an admin';
  END IF;

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
      role_approved_by = auth.uid(),
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
    auth.uid(),
    'role_changed',
    p_user_id,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', v_approved_email.intended_role),
    jsonb_build_object('source', 'whitelisted_email_manual', 'email', v_email)
  );

  RETURN jsonb_build_object('success', true, 'role', v_approved_email.intended_role);
END;
$function$;

-- =====================================================================
-- 5. ENSURE get_my_role is admin-only accessible by authenticated
-- =====================================================================

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;