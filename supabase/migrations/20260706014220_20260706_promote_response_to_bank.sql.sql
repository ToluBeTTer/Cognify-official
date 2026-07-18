-- Function to promote a human-answered question to the question bank
-- This creates a direct path from answered student questions to the question bank

CREATE OR REPLACE FUNCTION promote_response_to_bank(
  p_question_id UUID,
  p_response_id UUID,
  p_promoted_by UUID,
  p_section sat_section DEFAULT NULL,
  p_domain_id UUID DEFAULT NULL,
  p_skill_id UUID DEFAULT NULL,
  p_difficulty difficulty_level DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}',
  p_question_text TEXT DEFAULT NULL,
  p_correct_answer TEXT DEFAULT NULL,
  p_explanation TEXT DEFAULT NULL,
  p_hint TEXT DEFAULT NULL,
  p_estimated_time_seconds INTEGER DEFAULT NULL,
  p_calculator_allowed BOOLEAN DEFAULT TRUE
) RETURNS UUID AS $$
DECLARE
  v_question questions%ROWTYPE;
  v_response human_responses%ROWTYPE;
  v_question_id UUID;
  v_attachments JSONB;
BEGIN
  -- Fetch the question
  SELECT * INTO v_question FROM questions WHERE id = p_question_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found';
  END IF;

  -- Fetch the response
  SELECT * INTO v_response FROM human_responses WHERE id = p_response_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Response not found';
  END IF;

  -- Verify the response is approved
  IF NOT v_response.is_approved THEN
    RAISE EXCEPTION 'Response must be approved before promoting to question bank';
  END IF;

  -- Get attachments for the question
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'file_name', file_name,
        'file_type', file_type,
        'storage_path', storage_path
      )
    ),
    '[]'::jsonb
  ) INTO v_attachments
  FROM attachments
  WHERE question_id = p_question_id;

  -- Insert into question_bank
  INSERT INTO question_bank (
    question_text,
    question_format,
    correct_answer,
    explanation,
    hint,
    section,
    domain_id,
    skill_id,
    difficulty,
    tags,
    estimated_time_seconds,
    calculator_allowed,
    source,
    source_reference,
    created_by,
    reviewed_by,
    status,
    metadata
  ) VALUES (
    COALESCE(p_question_text, v_question.content),
    'multiple_choice',
    COALESCE(p_correct_answer, 'A'),
    COALESCE(p_explanation, v_response.explanation),
    COALESCE(p_hint, v_response.teaching_notes),
    COALESCE(p_section, CASE 
      WHEN v_question.subject_id IS NOT NULL THEN 
        CASE 
          WHEN v_question.subject_id = ANY(ARRAY['math-subject', 'math']::TEXT[]) THEN 'math'::sat_section
          WHEN v_question.subject_id = ANY(ARRAY['reading-subject', 'reading']::TEXT[]) THEN 'reading'::sat_section
          WHEN v_question.subject_id = ANY(ARRAY['writing-subject', 'writing']::TEXT[]) THEN 'writing'::sat_section
          ELSE NULL
        END
      ELSE NULL
    END),
    p_domain_id,
    p_skill_id,
    COALESCE(p_difficulty, CASE
      WHEN v_question.difficulty_perceived = 'easy' THEN 'easy'::difficulty_level
      WHEN v_question.difficulty_perceived = 'medium' THEN 'medium'::difficulty_level
      WHEN v_question.difficulty_perceived = 'hard' THEN 'hard'::difficulty_level
      ELSE 'medium'::difficulty_level
    END),
    COALESCE(p_tags, ARRAY[]::TEXT[]),
    COALESCE(p_estimated_time_seconds, 90),
    p_calculator_allowed,
    'community'::question_source,
    'Promoted from student question',
    p_promoted_by,
    p_promoted_by,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM profiles WHERE user_id = p_promoted_by AND role = 'admin'::user_role
      ) THEN 'published'::question_bank_status
      ELSE 'pending_review'::question_bank_status
    END,
    jsonb_build_object(
      'original_question_id', p_question_id,
      'original_response_id', p_response_id,
      'original_creator_id', v_response.creator_id,
      'attachments', v_attachments
    )
  )
  RETURNING id INTO v_question_id;

  -- Mark the question as promoted
  UPDATE questions SET
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'promoted_to_bank', true,
      'bank_question_id', v_question_id,
      'promoted_at', now(),
      'promoted_by', p_promoted_by
    )
  WHERE id = p_question_id;

  -- Mark the response as promoted
  UPDATE human_responses SET
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'promoted_to_bank', true,
      'bank_question_id', v_question_id,
      'promoted_at', now()
    )
  WHERE id = p_response_id;

  RETURN v_question_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a column to track promotion status
ALTER TABLE human_responses ADD COLUMN IF NOT EXISTS promoted_to_bank BOOLEAN DEFAULT FALSE;
ALTER TABLE human_responses ADD COLUMN IF NOT EXISTS bank_question_id UUID REFERENCES question_bank(id) ON DELETE SET NULL;

-- Update existing records based on metadata
UPDATE human_responses 
SET 
  promoted_to_bank = COALESCE((metadata->>'promoted_to_bank')::BOOLEAN, FALSE),
  bank_question_id = (metadata->>'bank_question_id')::UUID
WHERE metadata IS NOT NULL AND metadata ? 'promoted_to_bank';
