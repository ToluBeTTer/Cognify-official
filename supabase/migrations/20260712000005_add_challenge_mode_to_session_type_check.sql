-- The Challenge Mode route added this session inserts 'challenge_mode' as
-- session_type, but the canonical list (fixed in the prior
-- fix_session_type_and_notification_trigger migration) didn't yet include
-- it — every Challenge Mode session start would have failed with a check
-- constraint violation.

ALTER TABLE practice_sessions DROP CONSTRAINT IF EXISTS practice_sessions_session_type_check;

ALTER TABLE practice_sessions
  ADD CONSTRAINT practice_sessions_session_type_check
  CHECK (session_type IS NULL OR session_type IN (
    'topic_practice', 'mock_test',
    'quick_practice',
    'infinite_practice',
    'timed_practice',
    'adaptive_practice',
    'weakest_topics',
    'review_mistakes',
    'bookmarked_questions',
    'exam_simulation',
    'question_bank',
    'challenge_mode',
    'quick_5', 'quick_10', 'quick_20',
    'random_practice', 'daily_challenge',
    'bookmarked', 'infinite'
  ));
