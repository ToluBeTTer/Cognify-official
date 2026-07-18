
-- Allow admins to view all user_learning_profiles
DROP POLICY IF EXISTS "ulp_admin_select_all" ON user_learning_profiles;
CREATE POLICY "ulp_admin_select_all" ON user_learning_profiles
  FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

-- Allow creators to view learning profiles of students they have active claims for
DROP POLICY IF EXISTS "ulp_creator_select_claimed" ON user_learning_profiles;
CREATE POLICY "ulp_creator_select_claimed" ON user_learning_profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM question_claims qc
      JOIN questions q ON q.id = qc.question_id
      WHERE qc.creator_id = auth.uid()
        AND q.user_id = user_learning_profiles.user_id
        AND qc.status IN ('claimed', 'in_progress')
    )
  );

-- Allow admins to view all questions (for student profile history)
DROP POLICY IF EXISTS "questions_admin_select_all" ON questions;
CREATE POLICY "questions_admin_select_all" ON questions
  FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

-- Allow admins to view all practice_sessions
DROP POLICY IF EXISTS "practice_sessions_admin_select_all" ON practice_sessions;
CREATE POLICY "practice_sessions_admin_select_all" ON practice_sessions
  FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');
