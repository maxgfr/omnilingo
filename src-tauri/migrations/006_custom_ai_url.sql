-- Add custom AI provider URL column
ALTER TABLE settings ADD COLUMN ai_custom_url TEXT DEFAULT '';
