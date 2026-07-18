-- The rest of the codebase's RLS recursion cleanup (fix_all_rls_profile_recursion_v2)
-- replaced every direct "EXISTS (SELECT 1 FROM profiles WHERE ... role ...)" subquery
-- with the SECURITY DEFINER get_my_role() helper — except this one, on `questions`,
-- which sits directly in the student -> creator human-help request path.
--
-- It likely wasn't throwing hard recursion errors in practice (it only needs the
-- caller's own profiles row, governed by the simple non-recursive
-- "profiles_select_own" policy), but it's the one inconsistency left in an
-- otherwise-fixed pattern, on the single most important table for the request
-- queue to actually work. Bringing it in line closes that gap for good.

DROP POLICY IF EXISTS "questions_select_creator" ON questions;
CREATE POLICY "questions_select_creator" ON questions
  FOR SELECT TO authenticated
  USING (
    human_requested = true
    AND get_my_role() IN ('admin', 'creator')
  );
