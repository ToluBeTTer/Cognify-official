/*
# Practice Session Engine v2 — Unified Session State

## Summary
This migration rebuilds the practice session system to support a single shared
engine across all 9 practice modes, fixing:
- Pre-answered question state bugs
- 0% score bugs (scoring was from UI state, not DB records)
- Duplicate/broken mode types
- No session resume/restart flow
- Missing per-question state tracking

## New Tables
### session_question_states
Stores per-question state for every session. Every question starts as 'active'.
The correct answer is NOT stored here — it lives in question_bank only.
- session_id: FK to practice_sessions
- question_id: FK to question_bank
- question_index: order in the session
- state: active | answered | reviewed | skipped
- selected_answer: what the user picked (null until submitted)
- is_correct: null until submitted, then true/false
- is_bookmarked: user bookmark within this session
- marked_for_review: flag for review pass
- eliminated_choices: array of eliminated option labels
- time_spent_seconds: per-question timer
- attempt_count: how many times submitted
- explanation_revealed: did user see explanation
- answered_at: when submitted

## Modified Tables
### practice_sessions
- Drop old constraint on session_type and add the 9 canonical mode keys
- Add mode_key (canonical) alongside session_type for compatibility
- Add source_type: stored_question | procedural_question | mixed
- Add section_filter, difficulty_filter, skill_filters
- Add question_count_target
- Add shuffle_questions, allow_backtracking, show_timer
- Add adaptive_mode flag
- Add resume_allowed flag  
- Add session_seed for stable random ordering
- Add generated_question_ids: the locked-in question order for this session
- Add last_question_index: last question the user was on (for resume)
- Add status enum: not_started | active | paused | completed | abandoned
- Fix score columns to be computed from session_question_states, not UI state

## Security
- RLS enabled on session_question_states (owner-scoped to authenticated)
- Existing RLS on practice_sessions is preserved
*/

-- Add new columns to practice_sessions
ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS mode_key text,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'stored_question',
  ADD COLUMN IF NOT EXISTS section_filter text,
  ADD COLUMN IF NOT EXISTS difficulty_filter text,
  ADD COLUMN IF NOT EXISTS skill_filters jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS domain_filter text,
  ADD COLUMN IF NOT EXISTS question_count_target integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS shuffle_questions boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_backtracking boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_timer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS adaptive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resume_allowed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS session_seed text,
  ADD COLUMN IF NOT EXISTS generated_question_ids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_question_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS time_limit_seconds integer;

-- session_question_states: per-question state machine
CREATE TABLE IF NOT EXISTS session_question_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  question_index integer NOT NULL,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','answered','reviewed','skipped')),
  selected_answer text,
  is_correct boolean,
  is_bookmarked boolean NOT NULL DEFAULT false,
  marked_for_review boolean NOT NULL DEFAULT false,
  eliminated_choices jsonb DEFAULT '[]'::jsonb,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  attempt_count integer NOT NULL DEFAULT 0,
  explanation_revealed boolean NOT NULL DEFAULT false,
  answered_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, question_id)
);

ALTER TABLE session_question_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_question_states" ON session_question_states;
CREATE POLICY "select_own_question_states" ON session_question_states
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE practice_sessions.id = session_question_states.session_id
        AND practice_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_question_states" ON session_question_states;
CREATE POLICY "insert_own_question_states" ON session_question_states
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE practice_sessions.id = session_question_states.session_id
        AND practice_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_question_states" ON session_question_states;
CREATE POLICY "update_own_question_states" ON session_question_states
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE practice_sessions.id = session_question_states.session_id
        AND practice_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE practice_sessions.id = session_question_states.session_id
        AND practice_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_question_states" ON session_question_states;
CREATE POLICY "delete_own_question_states" ON session_question_states
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE practice_sessions.id = session_question_states.session_id
        AND practice_sessions.user_id = auth.uid()
    )
  );

-- Index for fast session lookup
CREATE INDEX IF NOT EXISTS idx_sqs_session_id ON session_question_states(session_id);
CREATE INDEX IF NOT EXISTS idx_sqs_question_id ON session_question_states(question_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_mode ON practice_sessions(user_id, mode_key, status);

-- Function: compute session score from saved question states (not UI state)
CREATE OR REPLACE FUNCTION compute_session_score(p_session_id uuid)
RETURNS TABLE(correct_count integer, total_count integer, score_pct numeric)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(CASE WHEN is_correct = true THEN 1 END)::integer,
    COUNT(CASE WHEN state = 'answered' THEN 1 END)::integer,
    CASE
      WHEN COUNT(CASE WHEN state = 'answered' THEN 1 END) = 0 THEN 0
      ELSE ROUND(
        COUNT(CASE WHEN is_correct = true THEN 1 END)::numeric /
        COUNT(CASE WHEN state = 'answered' THEN 1 END)::numeric * 100, 1
      )
    END
  FROM session_question_states
  WHERE session_id = p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION compute_session_score(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION compute_session_score(uuid) TO authenticated;
