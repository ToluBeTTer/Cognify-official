
-- Fix 6 functions missing authorization guards

-- 1. check_import_duplicates — restrict to admin/creator, owners only
CREATE OR REPLACE FUNCTION public.check_import_duplicates(
  p_import_id uuid,
  p_similarity_threshold numeric DEFAULT 0.8
)
  RETURNS TABLE(match_id uuid, similarity numeric)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_import public.question_imports%ROWTYPE;
  v_caller_role text;
BEGIN
  v_caller_role := public.get_my_role();
  IF v_caller_role NOT IN ('admin', 'creator') THEN
    RAISE EXCEPTION 'Only admins and creators can check import duplicates';
  END IF;

  SELECT * INTO v_import FROM public.question_imports WHERE id = p_import_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_caller_role = 'creator' AND v_import.user_id != auth.uid() THEN
    RAISE EXCEPTION 'You can only check duplicates for your own imports';
  END IF;

  RETURN QUERY
  SELECT qb.id, similarity(v_import.question_text, qb.question_text)::DECIMAL AS sim
  FROM public.question_bank qb
  WHERE similarity(v_import.question_text, qb.question_text) >= p_similarity_threshold
  ORDER BY sim DESC
  LIMIT 5;
END;
$$;

-- 2. get_practice_questions — enforce caller can only request their own data
CREATE OR REPLACE FUNCTION public.get_practice_questions(
  p_user_id uuid,
  p_mode text DEFAULT 'standard',
  p_section text DEFAULT NULL,
  p_domain_id uuid DEFAULT NULL,
  p_skill_id uuid DEFAULT NULL,
  p_difficulty text DEFAULT NULL,
  p_limit integer DEFAULT 10
)
  RETURNS SETOF public.question_bank
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_user_id != auth.uid() AND public.get_my_role() != 'admin' THEN
    RAISE EXCEPTION 'You can only request practice questions for your own account';
  END IF;

  CASE p_mode
  WHEN 'weakest_topics' THEN
    RETURN QUERY
    SELECT qb.* FROM public.question_bank qb
    JOIN public.skills s ON s.id = qb.skill_id
    JOIN public.get_user_weakest_skills(p_user_id, 3) ws ON ws.skill_id = qb.skill_id
    WHERE qb.status = 'published'
    ORDER BY RANDOM() LIMIT p_limit;

  WHEN 'review_mistakes' THEN
    RETURN QUERY
    SELECT qb.* FROM public.question_bank qb
    JOIN public.bank_attempts ba ON ba.question_id = qb.id
    WHERE ba.user_id = p_user_id AND ba.is_correct = false AND qb.status = 'published'
    ORDER BY ba.attempted_at DESC LIMIT p_limit;

  WHEN 'bookmarked' THEN
    RETURN QUERY
    SELECT qb.* FROM public.question_bank qb
    JOIN public.bookmarked_questions bq ON bq.question_id = qb.id
    WHERE bq.user_id = p_user_id AND qb.status = 'published'
    ORDER BY bq.created_at DESC LIMIT p_limit;

  WHEN 'daily_challenge' THEN
    RETURN QUERY
    SELECT qb.* FROM public.question_bank qb
    WHERE qb.status = 'published'
    AND (p_section IS NULL OR qb.section = p_section::public.sat_section)
    ORDER BY RANDOM() LIMIT 5;

  ELSE
    RETURN QUERY
    SELECT qb.* FROM public.question_bank qb
    WHERE qb.status = 'published'
    AND (p_section IS NULL OR qb.section = p_section::public.sat_section)
    AND (p_domain_id IS NULL OR qb.domain_id = p_domain_id)
    AND (p_skill_id IS NULL OR qb.skill_id = p_skill_id)
    AND (p_difficulty IS NULL OR qb.difficulty = p_difficulty::public.difficulty_level)
    ORDER BY RANDOM() LIMIT p_limit;
  END CASE;

  RETURN;
END;
$$;

-- 3. get_user_weakest_skills — enforce caller can only read their own data
-- Must DROP and recreate because we're not changing the signature, just the body
-- (sql→plpgsql requires drop)
DROP FUNCTION IF EXISTS public.get_user_weakest_skills(uuid, integer);

CREATE FUNCTION public.get_user_weakest_skills(
  p_user_id uuid,
  p_limit integer DEFAULT 5
)
  RETURNS TABLE(skill_id uuid, skill_name text, skill_code text, accuracy numeric, attempts bigint)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_user_id != auth.uid() AND public.get_my_role() != 'admin' THEN
    RAISE EXCEPTION 'You can only view weakest skills for your own account';
  END IF;

  RETURN QUERY
  SELECT
    q.skill_id,
    s.name AS skill_name,
    s.code AS skill_code,
    ROUND(100.0 * SUM(CASE WHEN ba.is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS accuracy,
    COUNT(*) AS attempts
  FROM public.bank_attempts ba
  JOIN public.question_bank q ON q.id = ba.question_id
  LEFT JOIN public.skills s ON s.id = q.skill_id
  WHERE ba.user_id = p_user_id
  AND q.skill_id IS NOT NULL
  GROUP BY q.skill_id, s.name, s.code
  ORDER BY accuracy ASC, attempts DESC
  LIMIT p_limit;
END;
$$;

-- Re-grant after DROP/CREATE wipes grants
GRANT EXECUTE ON FUNCTION public.get_user_weakest_skills(uuid, integer) TO authenticated;

-- 4. is_email_approved_for_role — admin can check any email; users can only check their own
CREATE OR REPLACE FUNCTION public.is_email_approved_for_role(
  p_email text,
  p_role public.user_role
)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_caller_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.get_my_role() != 'admin' THEN
    SELECT email INTO v_caller_email FROM auth.users WHERE id = auth.uid();
    IF p_email != v_caller_email THEN
      RAISE EXCEPTION 'You can only check your own email against the whitelist';
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.approved_team_emails
    WHERE email = p_email
    AND intended_role = p_role
    AND (is_used = false OR is_used IS NULL)
  );
END;
$$;

-- 5. publish_import_to_bank — admin-only guard added
CREATE OR REPLACE FUNCTION public.publish_import_to_bank(p_import_id uuid)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_import public.question_imports%ROWTYPE;
  v_question_id UUID;
BEGIN
  IF public.get_my_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can publish imports to the question bank';
  END IF;

  SELECT * INTO v_import FROM public.question_imports WHERE id = p_import_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Import not found'; END IF;
  IF v_import.status NOT IN ('approved', 'reviewing') THEN
    RAISE EXCEPTION 'Import must be approved before publishing';
  END IF;

  INSERT INTO public.question_bank (
    question_text, question_format, choices, correct_answer, explanation,
    hint, section, domain_id, skill_id, difficulty, tags,
    estimated_time_seconds, calculator_allowed, source, created_by, status
  ) VALUES (
    v_import.question_text, v_import.question_format, v_import.choices,
    v_import.correct_answer, v_import.explanation, v_import.hint,
    v_import.section, v_import.domain_id, v_import.skill_id,
    v_import.difficulty, v_import.tags, v_import.estimated_time_seconds,
    v_import.calculator_allowed, v_import.source, v_import.user_id,
    'pending_review'::public.question_bank_status
  )
  RETURNING id INTO v_question_id;

  UPDATE public.question_imports
  SET status = 'published'::public.question_import_status,
      published_question_id = v_question_id,
      updated_at = now()
  WHERE id = p_import_id;

  UPDATE public.import_batches b
  SET total_questions = (SELECT COUNT(*) FROM public.question_imports WHERE batch_id = b.id)
  WHERE id = v_import.batch_id;

  RETURN v_question_id;
END;
$$;

-- 6. use_approved_email — caller can only consume their own email for their own account
CREATE OR REPLACE FUNCTION public.use_approved_email(p_email text, p_user_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_caller_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'You can only use an approved email for your own account';
  END IF;
  SELECT email INTO v_caller_email FROM auth.users WHERE id = auth.uid();
  IF p_email != v_caller_email THEN
    RAISE EXCEPTION 'Email does not match your account';
  END IF;

  UPDATE public.approved_team_emails
  SET is_used = true,
      used_at = now(),
      used_by = p_user_id,
      updated_at = now()
  WHERE email = p_email
  AND (is_used = false OR is_used IS NULL);
END;
$$;
