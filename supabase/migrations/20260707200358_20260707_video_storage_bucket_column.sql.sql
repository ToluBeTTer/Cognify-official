-- Ensure video_storage_bucket column exists
ALTER TABLE human_responses ADD COLUMN IF NOT EXISTS video_storage_bucket TEXT;