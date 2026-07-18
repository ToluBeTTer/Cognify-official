/*
# Add Saved Explanations Feature

Adds a saved_explanations table to allow students to bookmark
explanations for later review.
*/

CREATE TABLE IF NOT EXISTS saved_explanations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    ai_response_id uuid REFERENCES ai_responses(id) ON DELETE CASCADE,
    human_response_id uuid REFERENCES human_responses(id) ON DELETE CASCADE,
    notes text,
    tags text[] DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_explanations_user ON saved_explanations(user_id, created_at DESC);

ALTER TABLE saved_explanations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_explanations_select_own" ON saved_explanations;
CREATE POLICY "saved_explanations_select_own" ON saved_explanations FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_explanations_insert_own" ON saved_explanations;
CREATE POLICY "saved_explanations_insert_own" ON saved_explanations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_explanations_delete_own" ON saved_explanations;
CREATE POLICY "saved_explanations_delete_own" ON saved_explanations FOR DELETE TO authenticated USING (auth.uid() = user_id);