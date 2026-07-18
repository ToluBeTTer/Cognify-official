-- Same situation as `notifications` in the previous migration:
-- `question_claims` is referenced by RLS policies and read/written by the
-- frontend (creator queue, admin claims, respond page) but its CREATE TABLE
-- is nowhere in this migration history. Creating it properly here.
--
-- This ALSO closes a real race condition found while tracing the claim flow:
-- creator/queue/page.tsx's handleClaim() does a plain INSERT followed by a
-- separate UPDATE, with nothing stopping two creators who both loaded the
-- queue before either claimed from both successfully inserting a claim for
-- the same question. The partial unique index below makes the database
-- itself reject the second claim instead of relying on frontend timing.

CREATE TABLE IF NOT EXISTS public.question_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'in_progress', 'completed', 'released')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  released_at timestamptz,
  claim_notes text,
  release_reason text
);

CREATE INDEX IF NOT EXISTS question_claims_creator_id_idx ON public.question_claims (creator_id);
CREATE INDEX IF NOT EXISTS question_claims_question_id_idx ON public.question_claims (question_id);

-- The actual race-condition fix: only one ACTIVE (claimed/in_progress) claim
-- can exist per question at a time. A released or completed claim doesn't
-- count, so a question can be re-claimed after release.
CREATE UNIQUE INDEX IF NOT EXISTS question_claims_one_active_per_question
  ON public.question_claims (question_id)
  WHERE status IN ('claimed', 'in_progress');

ALTER TABLE public.question_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "question_claims_select" ON public.question_claims;
CREATE POLICY "question_claims_select" ON public.question_claims
  FOR SELECT TO authenticated
  USING (
    creator_id = auth.uid() OR get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "question_claims_insert" ON public.question_claims;
CREATE POLICY "question_claims_insert" ON public.question_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid() AND get_my_role() IN ('creator', 'admin')
  );

DROP POLICY IF EXISTS "question_claims_update" ON public.question_claims;
CREATE POLICY "question_claims_update" ON public.question_claims
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid() OR get_my_role() = 'admin')
  WITH CHECK (creator_id = auth.uid() OR get_my_role() = 'admin');
