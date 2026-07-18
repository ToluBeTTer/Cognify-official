-- Fix RLS policies for question_bank to ensure students can read published questions
-- and creators/admins can manage questions

-- First, drop existing policies
DROP POLICY IF EXISTS qb_select_published ON question_bank;
DROP POLICY IF EXISTS qb_select_own ON question_bank;
DROP POLICY IF EXISTS qb_insert ON question_bank;
DROP POLICY IF EXISTS qb_update ON question_bank;
DROP POLICY IF EXISTS qb_delete ON question_bank;

-- Select: Everyone can read published questions, creators/admins can read all
CREATE POLICY "qb_select_published" ON question_bank
  FOR SELECT TO authenticated
  USING (status = 'published'::question_bank_status);

CREATE POLICY "qb_select_admin" ON question_bank
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin'::user_role, 'creator'::user_role))
  );

-- Insert: Only creators and admins
CREATE POLICY "qb_insert_creator" ON question_bank
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin'::user_role, 'creator'::user_role))
  );

-- Update: Only creators and admins, own questions or all for admins
CREATE POLICY "qb_update_creator" ON question_bank
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin'::user_role, 'creator'::user_role))
    AND (
      created_by = auth.uid() 
      OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role)
    )
  );

-- Delete: Only admins
CREATE POLICY "qb_delete_admin" ON question_bank
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role)
  );

-- Fix skills RLS - ensure all authenticated can read
DROP POLICY IF EXISTS skills_admin_all ON skills;
DROP POLICY IF EXISTS skills_select_all ON skills;

CREATE POLICY "skills_select_all" ON skills
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "skills_admin_all" ON skills
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role)
  );
