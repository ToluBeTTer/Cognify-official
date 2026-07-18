
-- ============================================================
-- 1. FIX MUTABLE SEARCH_PATH ON FUNCTIONS
-- ============================================================

-- update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- notify_student_human_response
CREATE OR REPLACE FUNCTION public.notify_student_human_response()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_question public.questions;
  v_message text;
BEGIN
  SELECT * INTO v_question FROM public.questions WHERE id = NEW.question_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_message := 'A tutor has responded to your question';
  IF v_question.title IS NOT NULL THEN
    v_message := 'A tutor has responded to: ' || v_question.title;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    v_question.user_id,
    'human_response',
    'New Tutor Response',
    v_message,
    jsonb_build_object('question_id', NEW.question_id, 'response_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. FIX RLS POLICIES THAT ARE "ALWAYS TRUE"
-- ============================================================

-- ai_responses: restrict insert so only the row owner (or system via service role) can insert
DROP POLICY IF EXISTS "ai_responses_insert_system" ON public.ai_responses;
CREATE POLICY "ai_responses_insert_own" ON public.ai_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.questions
      WHERE id = question_id AND user_id = auth.uid()
    )
  );

-- audit_logs: only allow authenticated users to insert rows where actor_id = their own uid
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_own" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- notifications: only allow inserting notifications for the authenticated user themselves
DROP POLICY IF EXISTS "notifications_system_insert" ON public.notifications;
CREATE POLICY "notifications_insert_own" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 3. REVOKE EXECUTE FROM anon ON ALL SECURITY DEFINER FUNCTIONS
--    (triggers don't need anon/authenticated execute — only postgres role does)
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.add_team_email(text, public.user_role, text)               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_bank_question(uuid, text)                           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_role_request(uuid, text)                            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.change_user_role(uuid, public.user_role, text)              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_import_duplicates(uuid, numeric)                      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_profile_exists(text, text)                           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_role()                                               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_practice_questions(uuid, text, text, uuid, uuid, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_weakest_skills(uuid, integer)                      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                                           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_whitelisted_email_on_profile()                       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_whitelisted_email_promotion()                        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_email_approved_for_role(text, public.user_role)          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_student_human_response()                             FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_response_to_bank(uuid, uuid, uuid, public.sat_section, uuid, uuid, public.difficulty_level, text[], text, text, text, text, integer, boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_whitelisted_user(uuid)                              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.publish_bank_question(uuid)                                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.publish_import_to_bank(uuid)                                FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_bank_question(uuid, text)                            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_role_request(uuid, text)                             FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_team_email(text)                                     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_question_for_review(uuid)                            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at()                                         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.use_approved_email(text, uuid)                              FROM anon, authenticated;

-- ============================================================
-- 4. RE-GRANT EXECUTE TO authenticated ONLY FOR FUNCTIONS
--    THAT LEGITIMATE CLIENT CALLS ACTUALLY NEED
-- ============================================================

-- These are the only RPCs the frontend calls directly via supabase.rpc(...)
GRANT EXECUTE ON FUNCTION public.add_team_email(text, public.user_role, text)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_bank_question(uuid, text)                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_role_request(uuid, text)                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_user_role(uuid, public.user_role, text)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_import_duplicates(uuid, numeric)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_profile_exists(text, text)                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role()                                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_practice_questions(uuid, text, text, uuid, uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_weakest_skills(uuid, integer)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_email_approved_for_role(text, public.user_role)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_response_to_bank(uuid, uuid, uuid, public.sat_section, uuid, uuid, public.difficulty_level, text[], text, text, text, text, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_whitelisted_user(uuid)                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_bank_question(uuid)                                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_import_to_bank(uuid)                                TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_bank_question(uuid, text)                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_role_request(uuid, text)                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_team_email(text)                                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_question_for_review(uuid)                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_approved_email(text, uuid)                              TO authenticated;

-- Trigger functions only need postgres (they are called by the trigger mechanism, not by clients)
-- handle_new_user, handle_whitelisted_email_on_profile, handle_whitelisted_email_promotion,
-- notify_student_human_response, update_updated_at — already revoked above, no re-grant needed.
