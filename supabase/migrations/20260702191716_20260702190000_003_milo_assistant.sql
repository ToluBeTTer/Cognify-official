-- Milo AI Assistant chat history
CREATE TABLE IF NOT EXISTS milo_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS milo_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'chat' CHECK (message_type IN ('chat', 'question', 'calculation', 'grammar', 'writing', 'concept')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_conversation FOREIGN KEY (conversation_id) REFERENCES milo_conversations(id) ON DELETE CASCADE
);

-- User learning analytics
CREATE TABLE IF NOT EXISTS user_learning_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE DEFAULT auth.uid(),
  
  -- Learning style analysis
  preferred_learning_style TEXT CHECK (preferred_learning_style IN ('visual', 'verbal', 'kinesthetic', 'mixed')),
  response_time_preference TEXT CHECK (response_time_preference IN ('quick_hints', 'detailed_explanations', 'step_by_step')),
  
  -- Topic mastery (SAT domains)
  topic_mastery JSONB DEFAULT '{}',
  -- Example: {"algebra": 0.85, "geometry": 0.72, "reading_comprehension": 0.90}
  
  -- Weakness tracking
  weakness_areas JSONB DEFAULT '[]',
  -- Example: [{"topic": "quadratics", "missed": 5, "correct": 2, "trend": "declining"}]
  
  -- Study patterns
  peak_study_hours JSONB DEFAULT '[]',
  average_session_length_minutes INT DEFAULT 0,
  total_study_sessions INT DEFAULT 0,
  
  -- Question patterns
  common_mistake_types JSONB DEFAULT '[]',
  question_type_preferences JSONB DEFAULT '{}',
  
  -- Interaction stats
  total_questions_asked INT DEFAULT 0,
  total_ai_interactions INT DEFAULT 0,
  total_human_help_requests INT DEFAULT 0,
  average_rating_given DECIMAL(3,2) DEFAULT 0,
  
  -- Adaptive AI settings
  hint_frequency TEXT DEFAULT 'moderate' CHECK (hint_frequency IN ('minimal', 'moderate', 'detailed')),
  explanation_depth TEXT DEFAULT 'balanced' CHECK (explanation_depth IN ('concise', 'balanced', 'thorough')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_user_learning FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- User progress tracking
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Daily stats
  questions_asked INT DEFAULT 0,
  questions_answered_correctly INT DEFAULT 0,
  ai_interactions INT DEFAULT 0,
  study_time_minutes INT DEFAULT 0,
  
  -- Topic breakdown for the day
  topics_practiced JSONB DEFAULT '[]',
  
  -- Score tracking
  practice_score INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_user_progress FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- Creator feedback data (for improving responses)
CREATE TABLE IF NOT EXISTS creator_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  user_id UUID NOT NULL,
  
  -- Common issues identified
  issue_type TEXT,
  issue_description TEXT,
  
  -- Learning insights
  learning_style_observation TEXT,
  recommended_approach TEXT,
  
  -- Metadata
  question_id UUID,
  response_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_creator_insight FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_insight FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- RLS Policies
ALTER TABLE milo_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE milo_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_insights ENABLE ROW LEVEL SECURITY;

-- Milo conversations policies
CREATE POLICY "select_own_conversations" ON milo_conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_conversations" ON milo_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_conversations" ON milo_conversations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_conversations" ON milo_conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Milo messages policies
CREATE POLICY "select_own_messages" ON milo_messages FOR SELECT
  TO authenticated USING (
    conversation_id IN (SELECT id FROM milo_conversations WHERE user_id = auth.uid())
  );
CREATE POLICY "insert_own_messages" ON milo_messages FOR INSERT
  TO authenticated WITH CHECK (
    conversation_id IN (SELECT id FROM milo_conversations WHERE user_id = auth.uid())
  );

-- User learning profiles policies
CREATE POLICY "select_own_learning_profile" ON user_learning_profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_learning_profile" ON user_learning_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_learning_profile" ON user_learning_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- User progress policies
CREATE POLICY "select_own_progress" ON user_progress FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_progress" ON user_progress FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_progress" ON user_progress FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Creator insights policies
CREATE POLICY "select_own_creator_insights" ON creator_insights FOR SELECT
  TO authenticated USING (creator_id = auth.uid() OR user_id = auth.uid());
CREATE POLICY "insert_creator_insights" ON creator_insights FOR INSERT
  TO authenticated WITH CHECK (creator_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_milo_conversations_user ON milo_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_milo_messages_conversation ON milo_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_date ON user_progress(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_learning_profile_user ON user_learning_profiles(user_id);