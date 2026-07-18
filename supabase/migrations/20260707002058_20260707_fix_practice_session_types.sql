-- Drop the restrictive check constraint and replace with one that allows all valid session types
ALTER TABLE practice_sessions DROP CONSTRAINT IF EXISTS practice_sessions_session_type_check;

ALTER TABLE practice_sessions ADD CONSTRAINT practice_sessions_session_type_check
  CHECK (session_type IN (
    'topic_practice',
    'mock_test',
    'quick_5',
    'quick_10',
    'quick_20',
    'timed_practice',
    'adaptive_practice',
    'weakest_topics',
    'random_practice',
    'daily_challenge',
    'review_mistakes',
    'bookmarked',
    'exam_simulation',
    'infinite'
  ));
