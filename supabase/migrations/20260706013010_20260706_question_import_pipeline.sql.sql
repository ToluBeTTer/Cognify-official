-- Question Import Pipeline Schema
-- Stores raw imports before they're processed into the canonical question bank

-- Import batch status enum
CREATE TYPE import_batch_status AS ENUM (
  'pending',
  'processing',
  'ai_extraction',
  'manual_review',
  'completed',
  'failed'
);

-- Individual question import status
CREATE TYPE question_import_status AS ENUM (
  'pending',
  'extracted',
  'reviewing',
  'approved',
  'rejected',
  'published',
  'duplicate_detected'
);

-- Import batches: groups of uploaded files
CREATE TABLE import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status import_batch_status NOT NULL DEFAULT 'pending',
  batch_name TEXT,
  source_description TEXT,
  total_files INTEGER DEFAULT 0,
  processed_files INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  ai_extraction_enabled BOOLEAN DEFAULT false,
  CONSTRAINT valid_batch_status CHECK (status IN ('pending', 'processing', 'ai_extraction', 'manual_review', 'completed', 'failed'))
);

-- Uploaded files within a batch
CREATE TABLE import_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  storage_path TEXT NOT NULL,
  status import_batch_status NOT NULL DEFAULT 'pending',
  extracted_text TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Individual extracted questions before approval
CREATE TABLE question_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  file_id UUID REFERENCES import_files(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status question_import_status NOT NULL DEFAULT 'pending',
  
  -- Extracted question data
  question_text TEXT NOT NULL,
  question_format question_format DEFAULT 'multiple_choice',
  choices JSONB,
  correct_answer TEXT,
  explanation TEXT,
  hint TEXT,
  
  -- Metadata (predicted or manually assigned)
  section sat_section,
  domain_id UUID REFERENCES domains(id) ON DELETE SET NULL,
  skill_id UUID REFERENCES skills(id) ON DELETE SET NULL,
  difficulty difficulty_level,
  tags TEXT[] DEFAULT '{}',
  estimated_time_seconds INTEGER,
  calculator_allowed BOOLEAN DEFAULT true,
  
  -- Source tracking
  source question_source DEFAULT 'imported',
  source_reference TEXT,
  
  -- Duplicate detection
  duplicate_of UUID REFERENCES question_bank(id) ON DELETE SET NULL,
  similarity_score DECIMAL(5,4),
  
  -- AI confidence scores
  section_confidence DECIMAL(5,4),
  domain_confidence DECIMAL(5,4),
  skill_confidence DECIMAL(5,4),
  difficulty_confidence DECIMAL(5,4),
  
  -- Review tracking
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Published question link
  published_question_id UUID REFERENCES question_bank(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_imports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for import_batches
CREATE POLICY "import_batches_select_own" ON import_batches FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "import_batches_insert_own" ON import_batches FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "import_batches_update_own" ON import_batches FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "import_batches_delete_own" ON import_batches FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Admin access to import_batches
CREATE POLICY "import_batches_admin_all" ON import_batches FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role)
  );

-- RLS Policies for import_files
CREATE POLICY "import_files_select_batch_owner" ON import_files FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM import_batches WHERE id = batch_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role)
  );

CREATE POLICY "import_files_insert_batch_owner" ON import_files FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM import_batches WHERE id = batch_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role)
  );

CREATE POLICY "import_files_update_batch_owner" ON import_files FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM import_batches WHERE id = batch_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role)
  );

CREATE POLICY "import_files_delete_batch_owner" ON import_files FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM import_batches WHERE id = batch_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role)
  );

-- RLS Policies for question_imports
CREATE POLICY "question_imports_select_own" ON question_imports FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "question_imports_insert_own" ON question_imports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "question_imports_update_own" ON question_imports FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "question_imports_delete_own" ON question_imports FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Admin and creator access to question_imports
CREATE POLICY "question_imports_admin_all" ON question_imports FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin'::user_role, 'creator'::user_role))
  );

-- Indexes for performance
CREATE INDEX idx_import_batches_user ON import_batches(user_id);
CREATE INDEX idx_import_batches_status ON import_batches(status);
CREATE INDEX idx_import_files_batch ON import_files(batch_id);
CREATE INDEX idx_question_imports_batch ON question_imports(batch_id);
CREATE INDEX idx_question_imports_user ON question_imports(user_id);
CREATE INDEX idx_question_imports_status ON question_imports(status);
CREATE INDEX idx_question_imports_duplicate ON question_imports(duplicate_of);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER import_batches_updated
  BEFORE UPDATE ON import_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER question_imports_updated
  BEFORE UPDATE ON question_imports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to publish approved import to question bank
CREATE OR REPLACE FUNCTION publish_import_to_bank(p_import_id UUID)
RETURNS UUID AS $$
DECLARE
  v_import question_imports%ROWTYPE;
  v_question_id UUID;
BEGIN
  SELECT * INTO v_import FROM question_imports WHERE id = p_import_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import not found';
  END IF;
  
  IF v_import.status NOT IN ('approved', 'reviewing') THEN
    RAISE EXCEPTION 'Import must be approved before publishing';
  END IF;
  
  -- Insert into question bank
  INSERT INTO question_bank (
    question_text,
    question_format,
    choices,
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
    created_by,
    status
  ) VALUES (
    v_import.question_text,
    v_import.question_format,
    v_import.choices,
    v_import.correct_answer,
    v_import.explanation,
    v_import.hint,
    v_import.section,
    v_import.domain_id,
    v_import.skill_id,
    v_import.difficulty,
    v_import.tags,
    v_import.estimated_time_seconds,
    v_import.calculator_allowed,
    v_import.source,
    v_import.user_id,
    'pending_review'::question_bank_status
  )
  RETURNING id INTO v_question_id;
  
  -- Update import record
  UPDATE question_imports SET
    status = 'published'::question_import_status,
    published_question_id = v_question_id,
    updated_at = now()
  WHERE id = p_import_id;
  
  -- Update batch counts
  UPDATE import_batches b SET
    total_questions = (
      SELECT COUNT(*) FROM question_imports WHERE batch_id = b.id
    )
  WHERE id = v_import.batch_id;
  
  RETURN v_question_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for potential duplicates
CREATE OR REPLACE FUNCTION check_import_duplicates(p_import_id UUID, p_similarity_threshold DECIMAL DEFAULT 0.8)
RETURNS TABLE(match_id UUID, similarity DECIMAL) AS $$
DECLARE
  v_import question_imports%ROWTYPE;
BEGIN
  SELECT * INTO v_import FROM question_imports WHERE id = p_import_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Simple similarity check based on question text
  RETURN QUERY
  SELECT 
    qb.id,
    similarity(v_import.question_text, qb.question_text)::DECIMAL AS sim
  FROM question_bank qb
  WHERE similarity(v_import.question_text, qb.question_text) >= p_similarity_threshold
  ORDER BY sim DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;