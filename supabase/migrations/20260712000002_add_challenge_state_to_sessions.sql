-- Challenge Mode needs to persist its live adaptation state (streak,
-- current difficulty, per-domain miss counts, which questions have already
-- been served this session) server-side — computed and stored here, never
-- trusted from the client, so a student's browser can't fake their own
-- streak or difficulty level.

ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS challenge_state jsonb;
