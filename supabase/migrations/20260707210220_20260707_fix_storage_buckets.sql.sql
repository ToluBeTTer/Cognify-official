-- Create missing storage buckets and fix policies

-- Create response-videos bucket
INSERT INTO storage.buckets (id, name, public, owner)
VALUES ('response-videos', 'response-videos', false, null)
ON CONFLICT (id) DO NOTHING;

-- Create milo-uploads bucket
INSERT INTO storage.buckets (id, name, public, owner)
VALUES ('milo-uploads', 'milo-uploads', false, null)
ON CONFLICT (id) DO NOTHING;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "response_videos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "response_videos_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "milo_uploads_user_upload" ON storage.objects;
DROP POLICY IF EXISTS "milo_uploads_user_read" ON storage.objects;
DROP POLICY IF EXISTS "question_attachments_public_read" ON storage.objects;
DROP POLICY IF EXISTS "question_attachments_authenticated_upload" ON storage.objects;

-- Create policies for response-videos
CREATE POLICY "response_videos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'response-videos');

CREATE POLICY "response_videos_authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'response-videos');

-- Create policies for milo-uploads
CREATE POLICY "milo_uploads_user_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'milo-uploads');

CREATE POLICY "milo_uploads_user_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'milo-uploads');

-- Create policies for question-attachments
CREATE POLICY "question_attachments_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'question-attachments');

CREATE POLICY "question_attachments_authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'question-attachments');
