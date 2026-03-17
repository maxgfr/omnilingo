-- Add AI provider settings
ALTER TABLE settings ADD COLUMN ai_provider TEXT DEFAULT 'anthropic';
ALTER TABLE settings ADD COLUMN ai_api_key TEXT DEFAULT '';
ALTER TABLE settings ADD COLUMN ai_model TEXT DEFAULT '';

UPDATE schema_version SET version = 2;
