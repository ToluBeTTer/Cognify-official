/*
  Question Bank System
  
  A unified question bank supporting:
  - Official SAT questions
  - Creator-created questions
  - Community-submitted questions (after review)
  - Imported PDF/practice-test questions
  
  Based on SAT organization:
  - Section (Math, Reading, Writing)
  - Domain (e.g., Algebra, Advanced Math)
  - Skill (specific competency)
  - Difficulty (Easy, Medium, Hard)
*/

-- ============================================================
-- 1. Enum types for question bank
-- ============================================================

-- Question format types
CREATE TYPE public.question_format AS ENUM (
  'multiple_choice',
  'numeric_entry',
  'passage_based',
  'graph_table',
  'image_based',
  'two_part',
  'multi_select'
);

-- Question bank status
CREATE TYPE public.question_bank_status AS ENUM (
  'draft',
  'pending_review',
  'approved',
  'published',
  'archived',
  'rejected'
);

-- Question source type
CREATE TYPE public.question_source AS ENUM (
  'official',
  'creator',
  'community',
  'imported',
  'practice_test'
);

-- SAT Section
CREATE TYPE public.sat_section AS ENUM (
  'math',
  'reading',
  'writing'
);

-- Difficulty level
CREATE TYPE public.difficulty_level AS ENUM (
  'easy',
  'medium',
  'hard'
);

-- ============================================================
-- 2. Skills table (replaces topics with proper SAT skills)
-- ============================================================

-- First, let's update the domains to be SAT-specific
-- The existing domains table has some data, let's work with it

-- Create skills table (granular competencies within a domain)
CREATE TABLE public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  code text, -- SAT skill code like "HEA.1", "ALG.2"
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_skills_slug ON public.skills(slug);
CREATE INDEX idx_skills_domain ON public.skills(domain_id);

-- Enable RLS
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

-- RLS: Everyone can read skills
CREATE POLICY "skills_select_all" ON public.skills
  FOR SELECT TO authenticated
  USING (true);

-- RLS: Only admins can modify
CREATE POLICY "skills_admin_all" ON public.skills
  FOR ALL TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ============================================================
-- 3. Main Question Bank Table
-- ============================================================

CREATE TABLE public.question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  question_text text NOT NULL,
  question_text_html text, -- Rich text version
  
  -- For passage-based or image-based questions
  passage text,
  passage_html text,
  image_url text,
  image_caption text,
  graph_data jsonb, -- For graph/table questions
  
  -- Answer data
  question_format public.question_format NOT NULL DEFAULT 'multiple_choice',
  choices jsonb DEFAULT '[]', -- [{label: "A", text: "..."}, ...] for multiple choice
  correct_answer text NOT NULL, -- The answer label or value
  
  -- Explanations
  explanation text,
  explanation_html text,
  alternative_explanation text, -- Different way to explain
  hint text, -- Optional hint for students
  
  -- SAT Organization
  section public.sat_section NOT NULL,
  domain_id uuid REFERENCES public.domains(id),
  skill_id uuid REFERENCES public.skills(id),
  difficulty public.difficulty_level NOT NULL DEFAULT 'medium',
  
  -- Metadata
  tags text[] DEFAULT '{}',
  estimated_time_seconds int DEFAULT 90, -- Typical solving time
  calculator_allowed boolean DEFAULT true,
  
  -- Source tracking
  source public.question_source NOT NULL DEFAULT 'creator',
  source_reference text, -- Book, test name, page, etc.
  source_question_id text, -- ID from original source
  
  -- Ownership
  created_by uuid REFERENCES auth.users(id),
  reviewed_by uuid REFERENCES auth.users(id),
  published_by uuid REFERENCES auth.users(id),
  
  -- Status
  status public.question_bank_status NOT NULL DEFAULT 'draft',
  rejection_reason text,
  
  -- Usage stats
  times_used int DEFAULT 0,
  times_correct int DEFAULT 0,
  times_incorrect int DEFAULT 0,
  average_time_seconds int,
  
  -- Moderation
  admin_notes text,
  flags jsonb DEFAULT '[]', -- [{type, reason, reported_by}]
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  
  -- Constraints
  CONSTRAINT valid_choices CHECK (
    question_format != 'multiple_choice' OR 
    (choices IS NOT NULL AND jsonb_array_length(choices) >= 2)
  ),
  CONSTRAINT valid_numeric_entry CHECK (
    question_format != 'numeric_entry' OR 
    correct_answer ~ '^[0-9.,/-]+$'
  )
);

-- Indexes for filtering
CREATE INDEX idx_qb_section ON public.question_bank(section);
CREATE INDEX idx_qb_domain ON public.question_bank(domain_id);
CREATE INDEX idx_qb_skill ON public.question_bank(skill_id);
CREATE INDEX idx_qb_difficulty ON public.question_bank(difficulty);
CREATE INDEX idx_qb_status ON public.question_bank(status);
CREATE INDEX idx_qb_source ON public.question_bank(source);
CREATE INDEX idx_qb_created_by ON public.question_bank(created_by);
CREATE INDEX idx_qb_tags ON public.question_bank USING GIN(tags);

-- Enable RLS
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

-- RLS: Published questions visible to all authenticated users
CREATE POLICY "qb_select_published" ON public.question_bank
  FOR SELECT TO authenticated
  USING (status = 'published');

-- RLS: Creators/admins can see their own drafts and pending
CREATE POLICY "qb_select_own" ON public.question_bank
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid() OR 
    public.get_my_role() IN ('admin', 'creator')
  );

-- RLS: Creators/admins can insert
CREATE POLICY "qb_insert" ON public.question_bank
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() IN ('admin', 'creator') AND
    created_by = auth.uid()
  );

-- RLS: Creators can update own drafts, admins can update all
CREATE POLICY "qb_update" ON public.question_bank
  FOR UPDATE TO authenticated
  USING (
    (created_by = auth.uid() AND status IN ('draft', 'pending_review', 'rejected')) OR
    public.get_my_role() = 'admin'
  )
  WITH CHECK (
    (created_by = auth.uid() AND status IN ('draft', 'pending_review', 'rejected')) OR
    public.get_my_role() = 'admin'
  );

-- RLS: Admins can delete
CREATE POLICY "qb_delete" ON public.question_bank
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'admin');

-- ============================================================
-- 4. Question Bank Review Queue
-- ============================================================

CREATE TABLE public.question_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.question_bank(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id),
  
  -- Review data
  accuracy_score int CHECK (accuracy_score BETWEEN 1 AND 5),
  clarity_score int CHECK (clarity_score BETWEEN 1 AND 5),
  difficulty_appropriate boolean,
  
  content_issues text[],
  suggested_fixes text,
  
  recommendation public.question_bank_status, -- approved or rejected
  review_notes text,
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_qr_question ON public.question_reviews(question_id);
CREATE INDEX idx_qr_reviewer ON public.question_reviews(reviewer_id);

-- Enable RLS
ALTER TABLE public.question_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_select_admin" ON public.question_reviews
  FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE POLICY "qr_insert_admin" ON public.question_reviews
  FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'admin');

-- ============================================================
-- 5. Helper functions
-- ============================================================

-- Function to submit question for review
CREATE OR REPLACE FUNCTION public.submit_question_for_review(p_question_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE question_bank
  SET status = 'pending_review',
      updated_at = now()
  WHERE id = p_question_id AND created_by = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found or not authorized';
  END IF;
  
  RETURN jsonb_build_object('success', true, 'question_id', p_question_id);
END;
$$;

-- Function to approve a question (admin)
CREATE OR REPLACE FUNCTION public.approve_bank_question(
  p_question_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_question question_bank%ROWTYPE;
BEGIN
  -- Verify admin
  IF public.get_my_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can approve questions';
  END IF;
  
  SELECT * INTO v_question FROM question_bank WHERE id = p_question_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found';
  END IF;
  
  UPDATE question_bank
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_notes = COALESCE(p_notes, admin_notes),
      updated_at = now()
  WHERE id = p_question_id;
  
  RETURN jsonb_build_object('success', true, 'question_id', p_question_id);
END;
$$;

-- Function to publish an approved question (admin)
CREATE OR REPLACE FUNCTION public.publish_bank_question(
  p_question_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify admin
  IF public.get_my_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can publish questions';
  END IF;
  
  UPDATE question_bank
  SET status = 'published',
      published_by = auth.uid(),
      published_at = now(),
      updated_at = now()
  WHERE id = p_question_id AND status = 'approved';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found or not approved';
  END IF;
  
  RETURN jsonb_build_object('success', true, 'question_id', p_question_id);
END;
$$;

-- Function to reject a question (admin)
CREATE OR REPLACE FUNCTION public.reject_bank_question(
  p_question_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify admin
  IF public.get_my_role() != 'admin' THEN
    RAISE EXCEPTION 'Only admins can reject questions';
  END IF;
  
  UPDATE question_bank
  SET status = 'rejected',
      rejection_reason = p_reason,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_question_id;
  
  RETURN jsonb_build_object('success', true, 'question_id', p_question_id);
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.submit_question_for_review(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_question_for_review(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_bank_question(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_bank_question(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.publish_bank_question(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_bank_question(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_bank_question(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_bank_question(uuid, text) TO authenticated;