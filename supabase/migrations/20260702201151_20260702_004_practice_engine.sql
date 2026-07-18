/*
# Phase 4 — Practice Engine & Notifications Trigger

## Summary
Adds the practice engine tables for the Question Bank's timed quiz and mock
SAT test features, plus a database-level notification helper function and a
trigger that fires notifications when a human response is submitted.

## New Tables

### practice_questions
Stores the actual SAT-style practice questions per topic/domain.
- id: UUID primary key
- subject: 'math' | 'reading' | 'writing'
- domain: SAT domain slug (e.g. 'algebra', 'craft-and-structure')
- topic_id: slug matching the Question Bank topic cards
- question_text: the full question body
- question_type: 'multiple_choice' | 'grid_in'
- choices: JSONB array of {id, text} for MC questions
- correct_answer: the correct answer (choice id for MC, value for grid-in)
- explanation: step-by-step solution explanation
- difficulty: 'easy' | 'medium' | 'hard'
- source: optional attribution (e.g. "SAT Official Practice Test 1")
- display_order: for ordering within a topic

### practice_attempts
Tracks every student's individual question attempt for progress analytics.
- id: UUID primary key
- user_id: authenticated user (defaults to auth.uid())
- question_id: FK to practice_questions
- topic_id: denormalized for fast querying
- subject / domain: denormalized
- selected_answer: what the student chose
- is_correct: boolean outcome
- time_spent_seconds: how long the student took
- attempted_at: timestamp

### practice_sessions
Groups attempts into timed quiz or full mock test sessions.
- id: UUID primary key
- user_id: authenticated user
- session_type: 'topic_practice' | 'mock_test'
- topic_id: null for mock tests
- total_questions / correct_answers / score_percentage: summary stats
- time_limit_seconds / time_taken_seconds: timing
- completed_at: null until session ends

## Modified Tables
None — all existing tables preserved.

## New Functions & Triggers

### notify_student_human_response()
PL/pgSQL trigger function that fires AFTER INSERT on human_responses.
Reads the question's user_id from the questions table and inserts a
'human_response_ready' notification for that student.

### trg_notify_on_human_response
AFTER INSERT trigger on human_responses that calls the above function.

## Security
- RLS enabled on all new tables.
- practice_questions: SELECT open to all authenticated users (shared catalog).
  No INSERT/UPDATE/DELETE for students — admin/service role only via service key.
- practice_attempts & practice_sessions: owner-scoped CRUD (auth.uid() = user_id).
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- practice_questions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS practice_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL CHECK (subject IN ('math', 'reading', 'writing')),
  domain text NOT NULL,
  topic_id text NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'grid_in')),
  choices jsonb DEFAULT '[]',
  correct_answer text NOT NULL,
  explanation text NOT NULL,
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  source text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE practice_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pq_select_authenticated" ON practice_questions;
CREATE POLICY "pq_select_authenticated" ON practice_questions FOR SELECT
  TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- practice_attempts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS practice_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES practice_questions(id) ON DELETE CASCADE,
  session_id uuid,
  topic_id text NOT NULL,
  subject text NOT NULL,
  domain text NOT NULL,
  selected_answer text,
  is_correct boolean NOT NULL DEFAULT false,
  time_spent_seconds integer DEFAULT 0,
  attempted_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_attempts_user ON practice_attempts(user_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_topic ON practice_attempts(user_id, topic_id);

ALTER TABLE practice_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_select_own" ON practice_attempts;
CREATE POLICY "pa_select_own" ON practice_attempts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pa_insert_own" ON practice_attempts;
CREATE POLICY "pa_insert_own" ON practice_attempts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- practice_sessions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type text NOT NULL DEFAULT 'topic_practice' CHECK (session_type IN ('topic_practice', 'mock_test')),
  topic_id text,
  total_questions integer DEFAULT 0,
  correct_answers integer DEFAULT 0,
  score_percentage numeric(5,2) DEFAULT 0,
  time_limit_seconds integer,
  time_taken_seconds integer,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_user ON practice_sessions(user_id, created_at DESC);

ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ps_select_own" ON practice_sessions;
CREATE POLICY "ps_select_own" ON practice_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ps_insert_own" ON practice_sessions;
CREATE POLICY "ps_insert_own" ON practice_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ps_update_own" ON practice_sessions;
CREATE POLICY "ps_update_own" ON practice_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Notification trigger: fires when a human_response is inserted
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_student_human_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
  v_title text;
BEGIN
  SELECT user_id INTO v_user_id
  FROM questions
  WHERE id = NEW.question_id;

  IF v_user_id IS NOT NULL THEN
    SELECT COALESCE(title, 'Your question') INTO v_title
    FROM questions WHERE id = NEW.question_id;

    INSERT INTO notifications (user_id, type, title, message, question_id, human_response_id)
    VALUES (
      v_user_id,
      'human_response_ready',
      'Expert Response Ready',
      'A human tutor has answered: ' || v_title,
      NEW.question_id,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_human_response ON human_responses;
CREATE TRIGGER trg_notify_on_human_response
  AFTER INSERT ON human_responses
  FOR EACH ROW EXECUTE FUNCTION notify_student_human_response();

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed practice_questions with SAT-quality content
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO practice_questions (subject, domain, topic_id, question_text, question_type, choices, correct_answer, explanation, difficulty, display_order)
VALUES
-- ALGEBRA
('math','algebra','linear-equations',
 'If 3x + 7 = 22, what is the value of x?',
 'multiple_choice',
 '[{"id":"A","text":"3"},{"id":"B","text":"5"},{"id":"C","text":"6"},{"id":"D","text":"7"}]',
 'B',
 'Subtract 7 from both sides: 3x = 15. Divide both sides by 3: x = 5.',
 'easy', 1),

('math','algebra','linear-equations',
 'A store sells notebooks for $2.50 each and pens for $1.25 each. Maria buys a total of 8 items and spends $14.00. How many notebooks did she buy?',
 'multiple_choice',
 '[{"id":"A","text":"3"},{"id":"B","text":"4"},{"id":"C","text":"5"},{"id":"D","text":"6"}]',
 'B',
 'Let n = notebooks, p = pens. System: n + p = 8 and 2.5n + 1.25p = 14. From first equation p = 8 - n. Substitute: 2.5n + 1.25(8-n) = 14 → 2.5n + 10 - 1.25n = 14 → 1.25n = 4 → n = 4.',
 'medium', 2),

('math','algebra','linear-equations',
 'The equation 4(2x - 3) = 2(3x + 1) has what solution?',
 'multiple_choice',
 '[{"id":"A","text":"x = 7"},{"id":"B","text":"x = 5"},{"id":"C","text":"x = -7"},{"id":"D","text":"x = -5"}]',
 'A',
 'Expand: 8x - 12 = 6x + 2. Subtract 6x: 2x - 12 = 2. Add 12: 2x = 14. Divide by 2: x = 7.',
 'medium', 3),

-- ADVANCED MATH
('math','advanced-math','quadratics',
 'Which of the following is equivalent to x² - 6x + 9?',
 'multiple_choice',
 '[{"id":"A","text":"(x - 3)²"},{"id":"B","text":"(x + 3)²"},{"id":"C","text":"(x - 3)(x + 3)"},{"id":"D","text":"(x - 9)(x + 1)"}]',
 'A',
 'Recognize the perfect square trinomial pattern: a² - 2ab + b² = (a - b)². Here a = x, b = 3, so x² - 6x + 9 = (x - 3)².',
 'easy', 1),

('math','advanced-math','quadratics',
 'The function f(x) = x² - 4x - 12. What are the x-intercepts?',
 'multiple_choice',
 '[{"id":"A","text":"x = 6 and x = -2"},{"id":"B","text":"x = -6 and x = 2"},{"id":"C","text":"x = 4 and x = -3"},{"id":"D","text":"x = 3 and x = -4"}]',
 'A',
 'Factor: x² - 4x - 12 = (x - 6)(x + 2) = 0. So x = 6 or x = -2. These are the points where the parabola crosses the x-axis.',
 'medium', 2),

-- PROBLEM SOLVING
('math','problem-solving','ratios',
 'In a class of 30 students, the ratio of girls to boys is 2:3. How many girls are in the class?',
 'multiple_choice',
 '[{"id":"A","text":"10"},{"id":"B","text":"12"},{"id":"C","text":"15"},{"id":"D","text":"18"}]',
 'B',
 'The ratio 2:3 means for every 5 students, 2 are girls. 30 ÷ 5 = 6 groups. Girls: 2 × 6 = 12.',
 'easy', 1),

('math','problem-solving','ratios',
 'A recipe calls for 2.5 cups of flour per dozen cookies. How many cups of flour are needed to make 60 cookies?',
 'multiple_choice',
 '[{"id":"A","text":"10.5"},{"id":"B","text":"12.5"},{"id":"C","text":"15.0"},{"id":"D","text":"12.0"}]',
 'B',
 '60 cookies = 5 dozen. 5 × 2.5 = 12.5 cups of flour.',
 'easy', 2),

-- GEOMETRY
('math','geometry','triangles',
 'In triangle ABC, angle A = 45°, angle B = 90°, and side AB = 6. What is the length of side AC?',
 'multiple_choice',
 '[{"id":"A","text":"6"},{"id":"B","text":"6√2"},{"id":"C","text":"12"},{"id":"D","text":"3√2"}]',
 'B',
 'Since angle B = 90°, it is a right triangle. With angle A = 45°, angle C = 45°, making it a 45-45-90 triangle. In such triangles, the hypotenuse = leg × √2. AC = AB × √2 = 6√2.',
 'medium', 1),

('math','geometry','triangles',
 'A right triangle has legs of length 5 and 12. What is the length of the hypotenuse?',
 'multiple_choice',
 '[{"id":"A","text":"13"},{"id":"B","text":"15"},{"id":"C","text":"17"},{"id":"D","text":"√119"}]',
 'A',
 'By the Pythagorean theorem: c² = a² + b² = 25 + 144 = 169. c = √169 = 13. This is the classic 5-12-13 Pythagorean triple.',
 'easy', 2),

-- READING: INFORMATION & IDEAS
('reading','information-and-ideas','main-idea',
 'The following passage is adapted from a 2023 article on ocean ecosystems.\n\n"Coral reefs, often called the rainforests of the sea, harbor more than 25% of all marine species despite covering less than 1% of the ocean floor. Yet rising ocean temperatures have triggered mass bleaching events, causing corals to expel the symbiotic algae that give them both color and energy. Scientists warn that without significant reductions in carbon emissions, up to 90% of the world''s coral reefs could disappear by 2050."\n\nThe primary purpose of this passage is to:',
 'multiple_choice',
 '[{"id":"A","text":"Argue that all human activity in the ocean should be banned"},{"id":"B","text":"Describe the ecological importance of coral reefs and the threat they face"},{"id":"C","text":"Explain the process by which algae produce energy for corals"},{"id":"D","text":"Predict that ocean temperatures will rise dramatically within a decade"}]',
 'B',
 'The passage introduces coral reefs'' significance (housing 25% of marine species), describes the threat (bleaching, rising temperatures), and projects future loss. This is a description of importance + threat — choice B.',
 'easy', 1),

('reading','information-and-ideas','main-idea',
 'Based on the passage above, which of the following can be most directly inferred about coral bleaching?',
 'multiple_choice',
 '[{"id":"A","text":"It permanently kills all corals within weeks"},{"id":"B","text":"It is caused solely by pollution from coastal cities"},{"id":"C","text":"It disrupts the relationship between corals and their energy source"},{"id":"D","text":"It only affects reefs covering more than 1% of the ocean floor"}]',
 'C',
 'The passage states corals expel "symbiotic algae that give them both color and energy" during bleaching. This directly implies bleaching disrupts their energy relationship — choice C.',
 'medium', 2),

-- READING: CRAFT & STRUCTURE
('reading','craft-and-structure','vocabulary',
 'In the coral reef passage, the word "symbiotic" (as used in the context of algae and coral) most nearly means:',
 'multiple_choice',
 '[{"id":"A","text":"Parasitic — one organism harms another"},{"id":"B","text":"Competitive — two organisms fight for resources"},{"id":"C","text":"Mutually beneficial — both organisms gain from the relationship"},{"id":"D","text":"Temporary — the relationship lasts only a short time"}]',
 'C',
 'Context clue: the algae give corals "color and energy," implying corals benefit. Symbiosis in biology means a mutually beneficial relationship between different organisms.',
 'easy', 1),

-- WRITING: STANDARD ENGLISH
('writing','standard-english','subject-verb-agreement',
 'Choose the version that best corrects the underlined portion:\n\n"The team of researchers [have] published their findings in three different journals."\n\nThe underlined word is [have].',
 'multiple_choice',
 '[{"id":"A","text":"have (no change)"},{"id":"B","text":"has"},{"id":"C","text":"were"},{"id":"D","text":"are"}]',
 'B',
 '"Team" is a collective noun treated as singular in American English. The subject is "team" (singular), not "researchers." Correct: "The team... has published."',
 'medium', 1),

('writing','standard-english','subject-verb-agreement',
 'Which sentence contains a subject-verb agreement error?',
 'multiple_choice',
 '[{"id":"A","text":"Each of the students submits a separate report."},{"id":"B","text":"Neither the coach nor the players were ready."},{"id":"C","text":"The data collected over ten years shows a clear trend."},{"id":"D","text":"The bouquet of roses smell wonderful."}]',
 'D',
 'In choice D, the subject is "bouquet" (singular), not "roses." It should be "smells." The other sentences correctly apply agreement rules: "each" is singular (A); with "neither...nor" the verb agrees with the nearer subject "players" (B); "data" used as a singular mass noun (C).',
 'hard', 2),

-- WRITING: EXPRESSION OF IDEAS
('writing','expression-of-ideas','transitions',
 'A student writes: "The new policy reduced costs. ______ , employee morale declined significantly."\n\nWhich transition best completes the sentence to show contrast?',
 'multiple_choice',
 '[{"id":"A","text":"Therefore"},{"id":"B","text":"Furthermore"},{"id":"C","text":"However"},{"id":"D","text":"Similarly"}]',
 'C',
 '"However" signals contrast — the policy had a positive financial outcome but a negative human outcome. "Therefore" shows result, "Furthermore" adds supporting detail, and "Similarly" draws a comparison.',
 'easy', 1)
ON CONFLICT DO NOTHING;
