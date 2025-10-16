-- Add new fields to bots table for chat functionality
ALTER TABLE bots ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'gpt-4o-mini';
ALTER TABLE bots ADD COLUMN IF NOT EXISTS temperature DECIMAL(3,2) DEFAULT 0.5;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS public BOOLEAN DEFAULT true;

-- Rename system_prompt to prompt for consistency with PRD
ALTER TABLE bots RENAME COLUMN system_prompt TO prompt;

-- Update existing bots to have default values
UPDATE bots SET model = 'gpt-4o-mini' WHERE model IS NULL;
UPDATE bots SET temperature = 0.5 WHERE temperature IS NULL;
UPDATE bots SET public = true WHERE public IS NULL;
