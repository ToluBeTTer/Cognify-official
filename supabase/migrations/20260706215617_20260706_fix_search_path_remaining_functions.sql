
-- Fix mutable search_path on check_import_duplicates, publish_import_to_bank, promote_response_to_bank

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
BEGIN
  SELECT * INTO v_import FROM public.question_imports WHERE id = p_import_id;
  IF NOT FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    qb.id,
    similarity(v_import.question_text, qb.question_text)::DECIMAL AS sim
  FROM public.question_bank qb
  WHERE similarity(v_import.question_text, qb.question_text) >= p_similarity_threshold
  ORDER BY sim DESC
  LIMIT 5;
END;
$$;

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
  SELECT * INTO v_import FROM public.question_imports WHERE id = p_import_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import not found';
  END IF;
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

CREATE OR REPLACE FUNCTION public.promote_response_to_bank(
  p_question_id uuid,
  p_response_id uuid,
  p_promoted_by uuid,
  p_section public.sat_section DEFAULT NULL,
  p_domain_id uuid DEFAULT NULL,
  p_skill_id uuid DEFAULT NULL,
  p_difficulty public.difficulty_level DEFAULT NULL,
  p_tags text[] DEFAULT '{}',
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
AS $$
DECLARE
  v_question public.questions%ROWTYPE;
  v_response public.human_responses%ROWTYPE;
  v_question_id UUID;
  v_attachments JSONB;
BEGIN
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
$$;
