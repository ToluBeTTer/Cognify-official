
-- Fix infinite recursion: replace all direct profiles-table references in other tables' RLS policies
-- with get_my_role() (SECURITY DEFINER - bypasses RLS entirely, safe to call from within policies)

-- ── questions ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "questions_admin_all" ON questions;
-- questions_admin_select_all already uses get_my_role(), keep it

DROP POLICY IF EXISTS "questions_select_creator" ON questions;
CREATE POLICY "questions_select_creator" ON questions
  FOR SELECT TO authenticated
  USING (
    human_requested = true
    AND get_my_role() IN ('admin', 'creator')
  );

-- ── question_claims ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "question_claims_admin_all" ON question_claims;
CREATE POLICY "question_claims_admin_all" ON question_claims
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ── Also ensure profiles_admin_update_all doesn't recurse ─────────────────
-- profiles_admin_update_all already uses get_my_role() which is SECURITY DEFINER — safe.
-- The recursion issue is caused by policies on OTHER tables that directly SELECT from profiles.
-- All such policies above have been replaced. No further changes needed.
