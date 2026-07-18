-- Create a default import batch for manual entries if none exists
-- Or make batch_id nullable for question_imports

-- First, let's make batch_id nullable to allow manual entries without a batch
ALTER TABLE question_imports ALTER COLUMN batch_id DROP NOT NULL;
