
-- 1. Fix practice_sessions session_type constraint
-- Drop old constraint and replace with all 9 canonical mode keys
ALTER TABLE practice_sessions DROP CONSTRAINT IF EXISTS practice_sessions_session_type_check;

ALTER TABLE practice_sessions
  ADD CONSTRAINT practice_sessions_session_type_check
  CHECK (session_type IS NULL OR session_type IN (
    -- Legacy values (keep for backward compat)
    'topic_practice', 'mock_test',
    -- New canonical mode keys used by frontend
    'quick_practice',
    'infinite_practice',
    'timed_practice',
    'adaptive_practice',
    'weakest_topics',
    'review_mistakes',
    'bookmarked_questions',
    'exam_simulation',
    'question_bank',
    -- Old granular values (keep for backward compat)
    'quick_5', 'quick_10', 'quick_20',
    'random_practice', 'daily_challenge',
    'bookmarked', 'infinite'
  ));

-- 2. Fix notify_student_human_response trigger
-- The old version used 'data' column (doesn't exist) and wrong type value 'human_response'
CREATE OR REPLACE FUNCTION notify_student_human_response()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
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

  INSERT INTO public.notifications (user_id, type, title, message, question_id, human_response_id, metadata)
  VALUES (
    v_question.user_id,
    'human_response_ready',
    'New Tutor Response',
    v_message,
    NEW.question_id,
    NEW.id,
    jsonb_build_object('question_id', NEW.question_id, 'response_id', NEW.id)
  );

  RETURN NEW;
END;
$$;
