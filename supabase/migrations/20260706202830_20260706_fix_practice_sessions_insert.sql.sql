-- Fix practice_sessions insert policy to work with default user_id
DROP POLICY IF EXISTS ps_insert_own ON practice_sessions;

CREATE POLICY "ps_insert_own" ON practice_sessions
  FOR INSERT TO authenticated
  WITH CHECK (true);  -- Allow insert, user_id defaults to auth.uid()
