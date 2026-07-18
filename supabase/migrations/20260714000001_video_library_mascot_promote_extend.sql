-- ============================================================================
-- Video Library, Mascot Companion, and Question Promotion extensions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. VIDEO LIBRARY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  video_url TEXT NOT NULL,
  video_storage_path TEXT,
  video_storage_bucket TEXT DEFAULT 'response-videos',
  thumbnail_url TEXT,
  subject sat_section,
  topic TEXT,
  difficulty difficulty_level,
  question_type TEXT,
  creator_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  creator_name TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  source_question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'unlisted', 'draft')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_subject ON public.videos(subject);
CREATE INDEX IF NOT EXISTS idx_videos_topic ON public.videos(topic);
CREATE INDEX IF NOT EXISTS idx_videos_tags ON public.videos USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_videos_creator ON public.videos(creator_id);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "videos_select_published" ON public.videos
  FOR SELECT TO authenticated
  USING (status = 'published' OR creator_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY "videos_insert_creator_admin" ON public.videos
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'creator') AND creator_id = auth.uid());

CREATE POLICY "videos_update_own_or_admin" ON public.videos
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid() OR get_my_role() = 'admin')
  WITH CHECK (creator_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY "videos_delete_own_or_admin" ON public.videos
  FOR DELETE TO authenticated
  USING (creator_id = auth.uid() OR get_my_role() = 'admin');

-- Anyone authenticated can bump the view counter (SECURITY DEFINER keeps the
-- update scoped to just the counter, so a student view doesn't need broader
-- UPDATE rights on the row).
CREATE OR REPLACE FUNCTION public.increment_video_views(p_video_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.videos SET views = views + 1 WHERE id = p_video_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.increment_video_views(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. MASCOT COMPANION (floating "Milo Buddy" — cosmetics, credits, stats)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mascot_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  credits INTEGER NOT NULL DEFAULT 150,
  total_earned INTEGER NOT NULL DEFAULT 150,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_login_date DATE,
  mascot_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  owned_items TEXT[] NOT NULL DEFAULT ARRAY[
    'eyes-default', 'mouth-default', 'nose-none', 'hair-none',
    'acc-none', 'cloth-none', 'bg-default'
  ],
  equipped_items JSONB NOT NULL DEFAULT '{
    "eyes": "eyes-default", "mouth": "mouth-default", "nose": "nose-none",
    "hair": "hair-none", "accessory": "acc-none", "clothing": "cloth-none",
    "bg": "bg-default"
  }'::jsonb,
  positions JSONB NOT NULL DEFAULT '{}'::jsonb,
  stats JSONB NOT NULL DEFAULT '{"throws": 0, "chats": 0, "wallHits": 0, "offscreen": 0}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mascot_profiles_user ON public.mascot_profiles(user_id);

ALTER TABLE public.mascot_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mascot_profiles_own_select" ON public.mascot_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "mascot_profiles_own_insert" ON public.mascot_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "mascot_profiles_own_update" ON public.mascot_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Awards Cogs (mascot credits) for real study activity — not idle-clicking.
-- Called from the client right after a practice session actually finishes,
-- and gated so a single session can't be replayed for credits.
CREATE OR REPLACE FUNCTION public.award_mascot_credits_for_session(
  p_user_id UUID,
  p_session_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_session public.practice_sessions%ROWTYPE;
  v_already_awarded BOOLEAN;
  v_reward INTEGER;
BEGIN
  SELECT * INTO v_session FROM public.practice_sessions WHERE id = p_session_id AND user_id = p_user_id;
  IF NOT FOUND OR v_session.status != 'completed' THEN
    RETURN 0;
  END IF;

  -- session_id already recorded in stats.awarded_sessions -> no double-award
  SELECT EXISTS (
    SELECT 1 FROM public.mascot_profiles
    WHERE user_id = p_user_id
    AND (stats -> 'awardedSessions') ? p_session_id::text
  ) INTO v_already_awarded;

  IF v_already_awarded THEN
    RETURN 0;
  END IF;

  v_reward := 5 + COALESCE(v_session.correct_answers, 0) * 3
    + CASE WHEN COALESCE(v_session.score_percentage, 0) >= 80 THEN 25 ELSE 0 END;

  UPDATE public.mascot_profiles
  SET
    credits = credits + v_reward,
    total_earned = total_earned + v_reward,
    stats = jsonb_set(
      stats,
      '{awardedSessions}',
      COALESCE(stats -> 'awardedSessions', '{}'::jsonb) || jsonb_build_object(p_session_id::text, true)
    ),
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN v_reward;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.award_mascot_credits_for_session(UUID, UUID) TO authenticated;

-- Daily login streak bonus — call once per session on app load. Returns the
-- Cogs awarded (0 if already claimed today).
CREATE OR REPLACE FUNCTION public.claim_mascot_daily(p_user_id UUID)
RETURNS TABLE(reward INTEGER, streak INTEGER) AS $$
DECLARE
  v_last DATE;
  v_streak INTEGER;
  v_reward INTEGER;
BEGIN
  SELECT last_login_date, streak_days INTO v_last, v_streak
  FROM public.mascot_profiles WHERE user_id = p_user_id;

  IF v_last = CURRENT_DATE THEN
    RETURN QUERY SELECT 0, v_streak;
    RETURN;
  END IF;

  IF v_last = CURRENT_DATE - INTERVAL '1 day' THEN
    v_streak := v_streak + 1;
  ELSE
    v_streak := 1;
  END IF;

  v_reward := 20 + LEAST(v_streak, 7) * 10;

  UPDATE public.mascot_profiles
  SET credits = credits + v_reward,
      total_earned = total_earned + v_reward,
      streak_days = v_streak,
      last_login_date = CURRENT_DATE,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT v_reward, v_streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.claim_mascot_daily(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. EXTEND promote_response_to_bank WITH choices / passage / image_url
--    (previously the RPC had no way to set multiple-choice options at all —
--    every promoted question silently got an empty choices array)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION promote_response_to_bank(
  p_question_id UUID,
  p_response_id UUID,
  p_promoted_by UUID,
  p_section sat_section DEFAULT NULL,
  p_domain_id UUID DEFAULT NULL,
  p_skill_id UUID DEFAULT NULL,
  p_difficulty difficulty_level DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}',
  p_question_text TEXT DEFAULT NULL,
  p_correct_answer TEXT DEFAULT NULL,
  p_explanation TEXT DEFAULT NULL,
  p_hint TEXT DEFAULT NULL,
  p_estimated_time_seconds INTEGER DEFAULT NULL,
  p_calculator_allowed BOOLEAN DEFAULT TRUE,
  p_choices JSONB DEFAULT NULL,
  p_passage TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_question questions%ROWTYPE;
  v_response human_responses%ROWTYPE;
  v_question_id UUID;
  v_attachments JSONB;
BEGIN
  SELECT * INTO v_question FROM questions WHERE id = p_question_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found';
  END IF;

  SELECT * INTO v_response FROM human_responses WHERE id = p_response_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Response not found';
  END IF;

  IF NOT v_response.is_approved THEN
    RAISE EXCEPTION 'Response must be approved before promoting to question bank';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'file_name', file_name,
        'file_type', file_type,
        'storage_path', storage_path
      )
    ),
    '[]'::jsonb
  ) INTO v_attachments
  FROM attachments
  WHERE question_id = p_question_id;

  INSERT INTO question_bank (
    question_text,
    question_format,
    choices,
    passage,
    image_url,
    correct_answer,
    explanation,
    hint,
    section,
    domain_id,
    skill_id,
    difficulty,
    tags,
    estimated_time_seconds,
    calculator_allowed,
    source,
    source_reference,
    created_by,
    reviewed_by,
    status,
    metadata
  ) VALUES (
    COALESCE(p_question_text, v_question.content),
    CASE WHEN p_choices IS NOT NULL AND jsonb_array_length(p_choices) > 0 THEN 'multiple_choice' ELSE 'numeric_entry' END,
    COALESCE(p_choices, '[]'::jsonb),
    p_passage,
    p_image_url,
    COALESCE(p_correct_answer, 'A'),
    COALESCE(p_explanation, v_response.explanation),
    COALESCE(p_hint, v_response.teaching_notes),
    COALESCE(p_section, (
      SELECT CASE s.slug
        WHEN 'math' THEN 'math'::sat_section
        WHEN 'reading' THEN 'reading'::sat_section
        WHEN 'writing' THEN 'writing'::sat_section
        ELSE NULL
      END
      FROM subjects s WHERE s.id = v_question.subject_id
    )),
    p_domain_id,
    p_skill_id,
    COALESCE(p_difficulty, CASE
      WHEN v_question.difficulty_perceived = 'easy' THEN 'easy'::difficulty_level
      WHEN v_question.difficulty_perceived = 'medium' THEN 'medium'::difficulty_level
      WHEN v_question.difficulty_perceived = 'hard' THEN 'hard'::difficulty_level
      ELSE 'medium'::difficulty_level
    END),
    p_tags,
    COALESCE(p_estimated_time_seconds, 90),
    p_calculator_allowed,
    'promoted',
    p_question_id::text,
    p_promoted_by,
    p_promoted_by,
    'published',
    jsonb_build_object('promoted_from_response', p_response_id, 'attachments', v_attachments)
  )
  RETURNING id INTO v_question_id;

  RETURN v_question_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
