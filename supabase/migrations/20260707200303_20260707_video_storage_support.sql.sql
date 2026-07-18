-- Add video storage path to human_responses
ALTER TABLE human_responses ADD COLUMN IF NOT EXISTS video_storage_path TEXT;
ALTER TABLE human_responses ADD COLUMN IF NOT EXISTS video_storage_bucket TEXT DEFAULT 'response-videos';

-- Create storage bucket for response videos (if not exists)
-- Note: Storage buckets are created via Supabase dashboard or API, not SQL
-- We'll use 'response-videos' bucket for video uploads

-- Add RLS policy helper for video uploads
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role FROM profiles WHERE user_id = auth.uid()),
    'student'
  );
$$;

-- Update the video_url column comment to indicate it can be internal storage path
COMMENT ON COLUMN human_responses.video_url IS 'External video URL (YouTube/Vimeo) OR signed URL for internal storage';
