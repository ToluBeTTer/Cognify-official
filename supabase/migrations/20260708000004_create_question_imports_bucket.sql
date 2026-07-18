-- The bulk-import "Upload" tab (app/(app)/question-bank/import/page.tsx)
-- lets a creator pick files but never actually uploaded them anywhere — no
-- bucket existed for them to go to. Creating it here as part of wiring up
-- the real upload -> AI extraction -> review pipeline.

INSERT INTO storage.buckets (id, name, public, owner)
VALUES ('question-imports', 'question-imports', false, null)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "question_imports_creator_upload" ON storage.objects;
CREATE POLICY "question_imports_creator_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'question-imports' AND get_my_role() IN ('creator', 'admin'));

DROP POLICY IF EXISTS "question_imports_creator_read" ON storage.objects;
CREATE POLICY "question_imports_creator_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'question-imports' AND get_my_role() IN ('creator', 'admin'));

DROP POLICY IF EXISTS "question_imports_creator_delete" ON storage.objects;
CREATE POLICY "question_imports_creator_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'question-imports' AND get_my_role() IN ('creator', 'admin'));
