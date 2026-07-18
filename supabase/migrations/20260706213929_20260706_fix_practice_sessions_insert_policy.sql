
-- Fix practice_sessions insert policy to properly check user_id ownership
DROP POLICY IF EXISTS "ps_insert_own" ON practice_sessions;
CREATE POLICY "ps_insert_own" ON practice_sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
