-- Fix questions RLS so creators/admins can see questions requesting human help

-- Drop old select policy (keep own questions)
DROP POLICY IF EXISTS questions_select_own ON questions;

-- Add new select policies
-- Students can see their own questions
CREATE POLICY "questions_select_own" ON questions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Creators/admins can see all questions that have human_requested=true
CREATE POLICY "questions_select_creator" ON questions
  FOR SELECT TO authenticated
  USING (
    human_requested = true
    AND EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin'::user_role, 'creator'::user_role))
  );
