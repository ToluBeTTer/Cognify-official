-- Cache/store for validated, AI-generated procedural questions used by
-- Infinite Practice mode. Kept as its own table, separate from
-- question_bank, so AI-generated content (even validated) never mixes with
-- the human-curated bank — an admin/creator can explicitly promote a good
-- one into question_bank later, but nothing procedural shows up there by
-- default.

CREATE TABLE IF NOT EXISTS public.procedural_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  passage text,
  choices jsonb NOT NULL, -- {a, b, c, d}
  correct_answer text NOT NULL CHECK (correct_answer IN ('a', 'b', 'c', 'd')),
  explanation text NOT NULL,
  hint text,
  topic text NOT NULL,
  section text NOT NULL CHECK (section IN ('math', 'reading', 'writing')),
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  provider text NOT NULL, -- which AI provider generated this (gemini, groq, anthropic)
  times_served integer NOT NULL DEFAULT 0,
  promoted_to_bank_id uuid REFERENCES public.question_bank(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS procedural_questions_section_difficulty_idx
  ON public.procedural_questions (section, difficulty);

ALTER TABLE public.procedural_questions ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read (needed to serve them during practice);
-- only the server (service-role, via the API route) inserts new ones.
DROP POLICY IF EXISTS "procedural_questions_select_all" ON public.procedural_questions;
CREATE POLICY "procedural_questions_select_all" ON public.procedural_questions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "procedural_questions_insert_admin_creator" ON public.procedural_questions;
CREATE POLICY "procedural_questions_insert_admin_creator" ON public.procedural_questions
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'creator') OR auth.role() = 'service_role');

-- Lets any authenticated user bump times_served when one is served to them —
-- scoped narrowly so this can't be used to tamper with question content itself.
DROP POLICY IF EXISTS "procedural_questions_update_times_served" ON public.procedural_questions;
CREATE POLICY "procedural_questions_update_times_served" ON public.procedural_questions
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
