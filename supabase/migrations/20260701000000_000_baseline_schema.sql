-- ============================================================================
-- BASELINE SCHEMA — fills the gap left by the original project's tables
-- having been created directly against the live Supabase project instead of
-- through a migration file. This is not a guess: every table, type, and
-- trigger below was verified by checking, for all 58 migrations that follow
-- this one, which objects they reference/use before any migration actually
-- creates them. This file creates exactly those objects — nothing more —
-- using CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE everywhere, so it is
-- always safe to run even against a project that already has some of this.
--
-- Run order matters: this file's timestamp (20260701) is earlier than every
-- other migration (earliest existing one is 20260702), so `supabase db push`
-- applies this first, then the other 58 in their original order, unchanged.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Enum types
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('student', 'creator', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- subjects — also created (IF NOT EXISTS) by a later migration; created here
-- first because an earlier migration (SAT structure seed) inserts into it.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- domains — never created anywhere in the 58 migrations.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, slug)
);
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- profiles — never created anywhere in the 58 migrations. Every RLS policy
-- in every other migration depends on this table and on get_my_role(),
-- which reads from it.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  role public.user_role NOT NULL DEFAULT 'student',
  grade_level integer,
  target_sat_score integer,
  preferred_subjects text[] NOT NULL DEFAULT '{}',
  bio text,
  specialties text[] NOT NULL DEFAULT '{}',
  is_verified boolean NOT NULL DEFAULT false,
  onboarding_completed boolean NOT NULL DEFAULT false,
  onboarding_step integer NOT NULL DEFAULT 0,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- role_approved_at / role_approved_by / test_date are added later by
-- existing migrations (ADD COLUMN IF NOT EXISTS) — intentionally not here.

-- ----------------------------------------------------------------------------
-- questions — never created anywhere in the 58 migrations.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  content text NOT NULL,
  question_type text NOT NULL DEFAULT 'text',
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  domain_id uuid REFERENCES public.domains(id) ON DELETE SET NULL,
  topic_id uuid,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending','processing','ai_ready','human_requested','claimed','human_ready','completed','archived')),
  student_notes text,
  difficulty_perceived text,
  ocr_extracted_text text,
  ocr_confidence numeric,
  human_requested boolean NOT NULL DEFAULT false,
  human_request_notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- attachments — never created anywhere in the 58 migrations.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer,
  mime_type text,
  storage_path text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'question-attachments',
  is_processed boolean NOT NULL DEFAULT false,
  ocr_text text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- ai_responses — never created anywhere in the 58 migrations.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  explanation text NOT NULL,
  hints text[],
  detected_subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  detected_domain_id uuid REFERENCES public.domains(id) ON DELETE SET NULL,
  detected_topic_id uuid,
  confidence_score numeric,
  follow_up_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_concepts text[],
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','ready','failed')),
  provider text,
  model_version text,
  tokens_used integer,
  student_rating integer,
  student_feedback text,
  processing_time_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_responses ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- human_responses — never created anywhere in the 58 migrations.
-- promoted_to_bank / bank_question_id / video_storage_path /
-- video_storage_bucket / rejection_reason are all added later by existing
-- migrations (ADD COLUMN IF NOT EXISTS) — intentionally not here, since they
-- reference tables (question_bank) that don't exist yet at this point.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.human_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  explanation text NOT NULL,
  teaching_notes text,
  video_url text,
  video_duration_seconds integer,
  annotated_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','ready','failed')),
  is_approved boolean NOT NULL DEFAULT false,
  student_rating integer,
  student_feedback text,
  admin_rating integer,
  admin_feedback text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);
ALTER TABLE public.human_responses ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- creator_profiles — never created anywhere in the 58 migrations. The
-- UNIQUE constraint on profile_id is intentionally NOT added here — an
-- existing migration adds it with ADD CONSTRAINT (no IF NOT EXISTS guard),
-- so adding it here first would make that migration fail instead.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_responses integer NOT NULL DEFAULT 0,
  average_rating numeric,
  total_claims integer NOT NULL DEFAULT 0,
  active_claims integer NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  max_active_claims integer NOT NULL DEFAULT 5,
  expertise jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- notifications — has its own CREATE TABLE IF NOT EXISTS later, but an
-- earlier migration (practice engine, July 2) already references it.
-- `link` is added later by an existing migration — not here.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('question_answered','human_response_ready','response_approved','claim_assigned')),
  title text NOT NULL,
  message text NOT NULL,
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  response_id uuid,
  human_response_id uuid REFERENCES public.human_responses(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- question_claims — has its own CREATE TABLE IF NOT EXISTS later, but
-- earlier migrations (creator/admin RLS fixes, July 7) already reference it.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  claimed_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  released_at timestamptz,
  claim_notes text,
  release_reason text
);
ALTER TABLE public.question_claims ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- The missing link: a profile row has to be created automatically when
-- someone signs up. Every later migration that touches handle_new_user()
-- uses CREATE OR REPLACE (safe with no prior definition), but nothing
-- anywhere actually attaches it to auth.users — so signups would silently
-- never create a profile at all without this.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- No custom-named RLS policies are created in this file on purpose — every
-- one of these tables gets its real, final policies from the 58 migrations
-- that follow (several of which specifically exist to fix earlier RLS
-- mistakes). Defining policies here too would risk name collisions with
-- those. RLS is enabled above so the tables are locked down by default
-- until those migrations run, which happens later in this same push.
