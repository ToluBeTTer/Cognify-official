/*
# Add Visual Support and Gamemodes to Question Bank

1. New Columns
- `gamemodes` (text[]) - Array of supported game modes: Study, Practice, Review, Challenge
- `visual_spec` (jsonb) - Visual generation spec with type and bolt_instruction
- `visual_data` (jsonb) - Data for visual generation
- `passage_id` (text) - Identifier for grouping passage-based questions

2. Purpose
- Support the 100-question seed pack which includes visual questions (C001-C011)
- Allow filtering by gamemode
- Store visual generation instructions for Bolt
- Group passage-based questions that share the same passage

3. Notes
- All columns are nullable for backward compatibility
- existing questions will work without modification
*/

-- Add gamemodes column for filtering by game mode
ALTER TABLE public.question_bank 
ADD COLUMN IF NOT EXISTS gamemodes text[] DEFAULT '{"Study","Practice","Review","Challenge"}'::text[];

-- Add visual_spec column for storing visual generation instructions
ALTER TABLE public.question_bank 
ADD COLUMN IF NOT EXISTS visual_spec jsonb;

-- Add visual_data column for storing data to render visuals
ALTER TABLE public.question_bank 
ADD COLUMN IF NOT EXISTS visual_data jsonb;

-- Add passage_id for grouping passage-based questions
ALTER TABLE public.question_bank 
ADD COLUMN IF NOT EXISTS passage_id text;

-- Add display_id for the human-readable question ID (M001, W001, etc.)
ALTER TABLE public.question_bank 
ADD COLUMN IF NOT EXISTS display_id text;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_qb_gamemodes ON public.question_bank USING GIN(gamemodes);
CREATE INDEX IF NOT EXISTS idx_qb_passage_id ON public.question_bank(passage_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_qb_display_id ON public.question_bank(display_id);