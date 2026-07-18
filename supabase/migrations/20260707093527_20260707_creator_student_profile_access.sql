
-- Allow creators to view profiles of students whose questions they have an active claim on
DROP POLICY IF EXISTS "profiles_creator_select_claimed" ON profiles;
CREATE POLICY "profiles_creator_select_claimed" ON profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM question_claims qc
      JOIN questions q ON q.id = qc.question_id
      WHERE qc.creator_id = auth.uid()
        AND q.user_id = profiles.user_id
        AND qc.status IN ('claimed', 'in_progress')
    )
  );
