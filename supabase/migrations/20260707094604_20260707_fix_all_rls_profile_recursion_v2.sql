
-- Fix: replace every direct "SELECT FROM profiles WHERE role = ..." in other tables' RLS
-- with get_my_role() (SECURITY DEFINER, bypasses RLS, never recurses).
-- Also introduce creator_has_active_claim_for_user() to safely check creator access.

-- ── Helper function (SECURITY DEFINER) ──────────────────────────────────
CREATE OR REPLACE FUNCTION creator_has_active_claim_for_user(p_user_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM question_claims qc
    JOIN questions q ON q.id = qc.question_id
    WHERE qc.creator_id = auth.uid()
      AND q.user_id = p_user_id
      AND qc.status IN ('claimed', 'in_progress')
  );
END;
$$;
REVOKE ALL ON FUNCTION creator_has_active_claim_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION creator_has_active_claim_for_user(uuid) TO authenticated;

-- ── profiles ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_creator_select_claimed" ON profiles;
CREATE POLICY "profiles_creator_select_claimed" ON profiles
  FOR SELECT TO authenticated
  USING (creator_has_active_claim_for_user(profiles.user_id));

-- ── attachments ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "attachments_admin_all" ON attachments;
CREATE POLICY "attachments_admin_all" ON attachments
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ── creator_profiles ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "creator_profiles_select_admin" ON creator_profiles;
CREATE POLICY "creator_profiles_select_admin" ON creator_profiles
  FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "creator_profiles_update_admin" ON creator_profiles;
CREATE POLICY "creator_profiles_update_admin" ON creator_profiles
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "creator_profiles_delete_admin" ON creator_profiles;
CREATE POLICY "creator_profiles_delete_admin" ON creator_profiles
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- creator_profiles_select_own: uses profile_id -> profiles.id for own profile
-- This is safe (only reads the current user's own row via profiles_select_own) — keep as-is

-- ── human_responses ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "human_responses_admin_all" ON human_responses;
CREATE POLICY "human_responses_admin_all" ON human_responses
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ── import_batches ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "import_batches_admin_all" ON import_batches;
CREATE POLICY "import_batches_admin_all" ON import_batches
  FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'creator'))
  WITH CHECK (get_my_role() IN ('admin', 'creator'));

-- ── import_files ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "import_files_select_batch_owner" ON import_files;
CREATE POLICY "import_files_select_batch_owner" ON import_files
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM import_batches WHERE id = import_files.batch_id AND user_id = auth.uid())
    OR get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "import_files_update_batch_owner" ON import_files;
CREATE POLICY "import_files_update_batch_owner" ON import_files
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM import_batches WHERE id = import_files.batch_id AND user_id = auth.uid())
    OR get_my_role() = 'admin'
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM import_batches WHERE id = import_files.batch_id AND user_id = auth.uid())
    OR get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "import_files_delete_batch_owner" ON import_files;
CREATE POLICY "import_files_delete_batch_owner" ON import_files
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM import_batches WHERE id = import_files.batch_id AND user_id = auth.uid())
    OR get_my_role() = 'admin'
  );

-- ── question_bank ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "qb_select_admin" ON question_bank;
CREATE POLICY "qb_select_admin" ON question_bank
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'creator'));

DROP POLICY IF EXISTS "qb_delete_admin" ON question_bank;
CREATE POLICY "qb_delete_admin" ON question_bank
  FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "qb_update_creator" ON question_bank;
CREATE POLICY "qb_update_creator" ON question_bank
  FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin', 'creator') AND (created_by = auth.uid() OR get_my_role() = 'admin'))
  WITH CHECK (get_my_role() IN ('admin', 'creator') AND (created_by = auth.uid() OR get_my_role() = 'admin'));

-- ── question_imports ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "question_imports_admin_all" ON question_imports;
CREATE POLICY "question_imports_admin_all" ON question_imports
  FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'creator'))
  WITH CHECK (get_my_role() IN ('admin', 'creator'));

-- ── role_requests ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "role_requests_admin_select" ON role_requests;
CREATE POLICY "role_requests_admin_select" ON role_requests
  FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "role_requests_admin_update" ON role_requests;
CREATE POLICY "role_requests_admin_update" ON role_requests
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ── skills ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "skills_admin_all" ON skills;
CREATE POLICY "skills_admin_all" ON skills
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ── user_learning_profiles ────────────────────────────────────────────────
DROP POLICY IF EXISTS "ulp_creator_select_claimed" ON user_learning_profiles;
CREATE POLICY "ulp_creator_select_claimed" ON user_learning_profiles
  FOR SELECT TO authenticated
  USING (creator_has_active_claim_for_user(user_learning_profiles.user_id));
