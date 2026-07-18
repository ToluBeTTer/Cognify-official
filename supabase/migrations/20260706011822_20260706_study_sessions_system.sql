/*
  Study Sessions and Practice Tools
  
  Unified practice system using the Question Bank.
*/

-- Update practice_sessions to support question_bank references
ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS study_mode text DEFAULT 'practice',
  ADD COLUMN IF NOT EXISTS section_filter text[],
  ADD COLUMN IF NOT EXISTS domain_filter uuid[],
  ADD COLUMN IF NOT EXISTS skill_filter uuid[],
  ADD COLUMN IF NOT EXISTS difficulty_filter text[],
  ADD COLUMN IF NOT EXISTS show_hints boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS adaptive_mode boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bookmarked_only boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_mistakes boolean DEFAULT false;

-- Study mode enum values:
-- quick_5, quick_10, quick_20, timed_practice, untimed_practice, 
-- adaptive_practice, weakest_topics, random_practice, daily_challenge,
-- review_mistakes, bookmarked_questions, exam_simulation

-- Create a table for tracking question attempts from question_bank
CREATE TABLE public.bank_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.practice_sessions(id) ON DELETE SET NULL,
  question_id uuid NOT NULL REFERENCES public.question_bank(id) ON DELETE CASCADE,
  
  -- Answer data
  selected_answer text,
  is_correct boolean NOT NULL,
  time_spent_seconds int,
  
  -- Practice features
  used_hint boolean DEFAULT false,
  marked_for_review boolean DEFAULT false,
  eliminated_options text[], -- Options user eliminated
  notes text, -- User notes on the question
  
  -- Timestamps
  attempted_at timestamptz DEFAULT now()
);

CREATE INDEX idx_bank_attempts_user ON public.bank_attempts(user_id);
CREATE INDEX idx_bank_attempts_session ON public.bank_attempts(session_id);
CREATE INDEX idx_bank_attempts_question ON public.bank_attempts(question_id);

-- Enable RLS
ALTER TABLE public.bank_attempts ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see their own attempts
CREATE POLICY "bank_attempts_select_own" ON public.bank_attempts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- RLS: Users can insert their own attempts
CREATE POLICY "bank_attempts_insert_own" ON public.bank_attempts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- User bookmarks for question bank
CREATE TABLE public.bookmarked_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.question_bank(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, question_id)
);

CREATE INDEX idx_bookmarks_user ON public.bookmarked_questions(user_id);

-- Enable RLS
ALTER TABLE public.bookmarked_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookmarks_select_own" ON public.bookmarked_questions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "bookmarks_insert_own" ON public.bookmarked_questions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "bookmarks_delete_own" ON public.bookmarked_questions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Daily challenge tracking
CREATE TABLE public.daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_date date NOT NULL DEFAULT CURRENT_DATE,
  completed boolean DEFAULT false,
  score int DEFAULT 0,
  total_questions int DEFAULT 5,
  time_seconds int,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, challenge_date)
);

CREATE INDEX idx_daily_challenges_user_date ON public.daily_challenges(user_id, challenge_date);

ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_challenges_own" ON public.daily_challenges
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Function to get user's weakest skills
CREATE OR REPLACE FUNCTION public.get_user_weakest_skills(p_user_id uuid, p_limit int DEFAULT 5)
RETURNS TABLE(skill_id uuid, skill_name text, skill_code text, accuracy numeric, attempts bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    q.skill_id,
    s.name,
    s.code,
    ROUND(100.0 * SUM(CASE WHEN ba.is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as accuracy,
    COUNT(*) as attempts
  FROM bank_attempts ba
  JOIN question_bank q ON q.id = ba.question_id
  LEFT JOIN skills s ON s.id = q.skill_id
  WHERE ba.user_id = p_user_id
    AND q.skill_id IS NOT NULL
  GROUP BY q.skill_id, s.name, s.code
  ORDER BY accuracy ASC, attempts DESC
  LIMIT p_limit;
$$;

-- Function to get questions for practice session
CREATE OR REPLACE FUNCTION public.get_practice_questions(
  p_user_id uuid,
  p_mode text,
  p_section text DEFAULT NULL,
  p_domain_id uuid DEFAULT NULL,
  p_skill_id uuid DEFAULT NULL,
  p_difficulty text DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS SETOF question_bank
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Different logic based on mode
  CASE p_mode
    WHEN 'weakest_topics' THEN
      -- Get questions from user's weakest skills
      RETURN QUERY
      SELECT qb.*
      FROM question_bank qb
      JOIN skills s ON s.id = qb.skill_id
      JOIN get_user_weakest_skills(p_user_id, 3) ws ON ws.skill_id = qb.skill_id
      WHERE qb.status = 'published'
      ORDER BY RANDOM()
      LIMIT p_limit;
      
    WHEN 'review_mistakes' THEN
      -- Get questions user got wrong
      RETURN QUERY
      SELECT qb.*
      FROM question_bank qb
      JOIN bank_attempts ba ON ba.question_id = qb.id
      WHERE ba.user_id = p_user_id
        AND ba.is_correct = false
        AND qb.status = 'published'
      ORDER BY ba.attempted_at DESC
      LIMIT p_limit;
      
    WHEN 'bookmarked' THEN
      -- Get user's bookmarked questions
      RETURN QUERY
      SELECT qb.*
      FROM question_bank qb
      JOIN bookmarked_questions bq ON bq.question_id = qb.id
      WHERE bq.user_id = p_user_id
        AND qb.status = 'published'
      ORDER BY bq.created_at DESC
      LIMIT p_limit;
      
    WHEN 'daily_challenge' THEN
      -- Fixed set of 5 varied questions
      RETURN QUERY
      SELECT qb.*
      FROM question_bank qb
      WHERE qb.status = 'published'
        AND (p_section IS NULL OR qb.section = p_section::sat_section)
      ORDER BY RANDOM()
      LIMIT 5;
      
    ELSE
      -- Standard practice with filters
      RETURN QUERY
      SELECT qb.*
      FROM question_bank qb
      WHERE qb.status = 'published'
        AND (p_section IS NULL OR qb.section = p_section::sat_section)
        AND (p_domain_id IS NULL OR qb.domain_id = p_domain_id)
        AND (p_skill_id IS NULL OR qb.skill_id = p_skill_id)
        AND (p_difficulty IS NULL OR qb.difficulty = p_difficulty::difficulty_level)
      ORDER BY RANDOM()
      LIMIT p_limit;
  END CASE;
  
  RETURN;
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.get_user_weakest_skills(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_weakest_skills(uuid, int) TO authenticated;

REVOKE ALL ON FUNCTION public.get_practice_questions(uuid, text, text, uuid, uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_practice_questions(uuid, text, text, uuid, uuid, text, int) TO authenticated;