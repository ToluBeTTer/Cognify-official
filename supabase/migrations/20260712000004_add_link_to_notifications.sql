-- Notifications without a question_id (role approvals, general messages)
-- had no way to be clickable at all — the dropdown fell back to a dead '#'
-- link. This lets any notification-creating code path specify exactly
-- where it should navigate to.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link text;
