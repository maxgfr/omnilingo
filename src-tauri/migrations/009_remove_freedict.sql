-- Migration 009 — Remove FreeDict and dictionary-pack infrastructure
--
-- The Dictionary feature is now AI-only: there are no pre-loaded words,
-- no FreeDict pack downloads, and no client-side word search. The
-- favorites tables had no UI today and only existed because they FK'd
-- into `words`, so they go too.

DROP TRIGGER IF EXISTS words_ai;
DROP TRIGGER IF EXISTS words_ad;
DROP TRIGGER IF EXISTS words_au;

DROP TABLE IF EXISTS words_fts;
DROP TABLE IF EXISTS favorite_list_items;
DROP TABLE IF EXISTS favorite_lists;
DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS words;
DROP TABLE IF EXISTS dictionary_packs;

INSERT OR REPLACE INTO schema_version (version) VALUES (9);
