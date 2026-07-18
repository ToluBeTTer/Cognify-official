-- Add validation function for question bank questions
-- This ensures broken questions cannot enter active play

-- Add is_valid flag to track question validity
ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS is_valid BOOLEAN DEFAULT true;

-- Create validation function that checks if a question has all required fields for practice
CREATE OR REPLACE FUNCTION validate_question_for_practice(p_question_id UUID)
RETURNS TABLE(is_valid BOOLEAN, issues TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_question question_bank%ROWTYPE;
  v_issues TEXT[] := '{}';
  v_choices JSONB;
  v_choice_labels TEXT[];
BEGIN
  -- Fetch the question
  SELECT * INTO v_question FROM question_bank WHERE id = p_question_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, ARRAY['Question not found']::TEXT[];
    RETURN;
  END IF;
  
  -- Check required fields
  IF v_question.question_text IS NULL OR v_question.question_text = '' THEN
    v_issues := array_append(v_issues, 'Missing question text');
  END IF;
  
  IF v_question.correct_answer IS NULL OR v_question.correct_answer = '' THEN
    v_issues := array_append(v_issues, 'Missing correct answer');
  END IF;
  
  IF v_question.section IS NULL THEN
    v_issues := array_append(v_issues, 'Missing section');
  END IF;
  
  IF v_question.question_format IS NULL THEN
    v_issues := array_append(v_issues, 'Missing question format');
  ELSE
    -- For multiple choice and other choice-based formats, validate choices
    IF v_question.question_format IN ('multiple_choice', 'passage_based', 'graph_table') THEN
      IF v_question.choices IS NULL THEN
        v_issues := array_append(v_issues, 'Missing answer choices');
      ELSE
        -- Validate choices structure
        v_choices := v_question.choices::JSONB;
        
        IF jsonb_typeof(v_choices) != 'array' THEN
          v_issues := array_append(v_issues, 'Choices must be an array');
        ELSIF jsonb_array_length(v_choices) < 2 THEN
          v_issues := array_append(v_issues, 'Must have at least 2 answer choices');
        ELSE
          -- Check each choice has label and text
          FOR i IN 0..jsonb_array_length(v_choices) - 1 LOOP
            IF NOT (v_choices->i ? 'label') OR NOT (v_choices->i ? 'text') THEN
              v_issues := array_append(v_issues, 'Choice ' || (i+1) || ' missing label or text');
            END IF;
          END LOOP;
          
          -- Check correct_answer matches one of the choice labels
          SELECT ARRAY_AGG((elem->>'label')::TEXT) INTO v_choice_labels
          FROM jsonb_array_elements(v_choices) AS elem;
          
          IF v_question.correct_answer IS NOT NULL 
             AND v_question.correct_answer != ''
             AND NOT (v_question.correct_answer = ANY(v_choice_labels)) THEN
            v_issues := array_append(v_issues, 'Correct answer does not match any choice label');
          END IF;
        END IF;
      END IF;
    END IF;
    
    -- For numeric entry, check correct_answer looks like a number
    IF v_question.question_format = 'numeric_entry' THEN
      IF v_question.correct_answer !~ '^-?\d*\.?\d+$' THEN
        v_issues := array_append(v_issues, 'Numeric entry answer should be a number');
      END IF;
    END IF;
  END IF;
  
  -- Return result
  RETURN QUERY SELECT array_length(v_issues, 1) IS NULL OR array_length(v_issues, 1) = 0, v_issues;
END;
$$;

-- Create function to get only valid questions for practice
CREATE OR REPLACE FUNCTION get_valid_questions_for_practice(
  p_limit INT DEFAULT 200,
  p_section TEXT DEFAULT NULL,
  p_difficulty TEXT DEFAULT NULL,
  p_domain_id UUID DEFAULT NULL,
  p_skill_id UUID DEFAULT NULL
)
RETURNS TABLE(id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT q.id
  FROM question_bank q
  WHERE q.status = 'published'
    AND q.is_valid = true
    AND q.question_text IS NOT NULL AND q.question_text != ''
    AND q.correct_answer IS NOT NULL AND q.correct_answer != ''
    AND q.question_format IS NOT NULL
    AND q.section IS NOT NULL
    AND q.difficulty IS NOT NULL
    -- For choice-based formats, ensure choices exist
    AND (
      q.question_format NOT IN ('multiple_choice', 'passage_based', 'graph_table')
      OR (q.choices IS NOT NULL AND jsonb_array_length(q.choices::JSONB) >= 2)
    )
    AND (p_section IS NULL OR q.section::TEXT = p_section)
    AND (p_difficulty IS NULL OR q.difficulty::TEXT = p_difficulty)
    AND (p_domain_id IS NULL OR q.domain_id = p_domain_id)
    AND (p_skill_id IS NULL OR q.skill_id = p_skill_id)
  LIMIT p_limit;
END;
$$;

-- Create trigger to validate on insert/update
CREATE OR REPLACE FUNCTION check_question_validity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_valid BOOLEAN;
  v_issues TEXT[];
BEGIN
  -- Run validation
  SELECT is_valid, issues INTO v_is_valid, v_issues
  FROM validate_question_for_practice(NEW.id);
  
  -- Store validity
  NEW.is_valid := v_is_valid;
  
  -- Log issues if any (for debugging)
  IF NOT v_is_valid AND array_length(v_issues, 1) > 0 THEN
    RAISE NOTICE 'Question % validation issues: %', NEW.id, v_issues;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS question_validation_trigger ON question_bank;
CREATE TRIGGER question_validation_trigger
  BEFORE INSERT OR UPDATE ON question_bank
  FOR EACH ROW
  EXECUTE FUNCTION check_question_validity();

-- Update existing questions to set is_valid correctly
UPDATE question_bank q
SET is_valid = true
WHERE status = 'published'
  AND question_text IS NOT NULL AND question_text != ''
  AND correct_answer IS NOT NULL AND correct_answer != ''
  AND question_format IS NOT NULL
  AND section IS NOT NULL
  AND difficulty IS NOT NULL
  AND (
    question_format NOT IN ('multiple_choice', 'passage_based', 'graph_table')
    OR (choices IS NOT NULL AND jsonb_array_length(choices::JSONB) >= 2)
  );

-- Mark invalid any broken published questions
UPDATE question_bank q
SET is_valid = false
WHERE status = 'published'
  AND (
    question_text IS NULL OR question_text = ''
    OR correct_answer IS NULL OR correct_answer = ''
    OR question_format IS NULL
    OR section IS NULL
    OR difficulty IS NULL
    OR (question_format IN ('multiple_choice', 'passage_based', 'graph_table') 
        AND (choices IS NULL OR jsonb_array_length(choices::JSONB) < 2))
  );