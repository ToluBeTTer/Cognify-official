-- Adds a test date field alongside the existing target_sat_score, so the
-- dashboard can show a real countdown to the student's actual SAT date
-- (an idea worth having — nothing here before this pulled double duty as
-- both a goal and a deadline).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS test_date date;
