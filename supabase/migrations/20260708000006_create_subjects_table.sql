-- `subjects` is referenced throughout the app (question submission, practice
-- filters, the seed migration that only ever INSERTs into it) but — like
-- `notifications` and `question_claims` before it — has no CREATE TABLE
-- anywhere in this migration history. It exists only because it was created
-- directly against the live project outside the migration system.
--
-- This is also evidence of a bigger, systemic issue: the very first
-- migration in this project (numbered "002") already references `questions`,
-- `ai_responses`, `human_responses`, and `auth.users` as pre-existing —
-- meaning the entire original schema was never captured as a migration at
-- all. That can only be properly fixed with a real schema dump pulled from
-- the live project (`supabase db dump --schema public`), not reconstructed
-- from application code. This migration only closes the one gap that's
-- concretely blocking the subject-lookup fix made earlier this session.

CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Reference/lookup data — every signed-in role needs to read it (students
-- picking a subject, creators/admins categorizing content), only admins
-- should ever change it.
DROP POLICY IF EXISTS "subjects_select_all" ON public.subjects;
CREATE POLICY "subjects_select_all" ON public.subjects
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "subjects_write_admin" ON public.subjects;
CREATE POLICY "subjects_write_admin" ON public.subjects
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
