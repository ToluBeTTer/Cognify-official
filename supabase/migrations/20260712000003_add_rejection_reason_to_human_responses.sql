-- Rejections were previously free-text only (admin_feedback), so a tutor
-- had no structured signal for *why* a response was rejected — just a
-- paragraph to read. This adds a real enum alongside the free text, so
-- creators can see the category at a glance and the platform can track
-- rejection patterns over time.

ALTER TABLE public.human_responses
  ADD COLUMN IF NOT EXISTS rejection_reason text
  CHECK (rejection_reason IN ('out_of_scope', 'insufficient_info', 'duplicate', 'incorrect', 'other') OR rejection_reason IS NULL);
