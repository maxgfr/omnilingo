-- Migration 010 — Saved dictionary entries
--
-- The Dictionary view is AI-only: when the user looks up a word, the AI
-- generates a structured bilingual definition. Users can save those entries
-- to revisit them later, mirroring the save pattern of grammar_topics and
-- verbs. UPSERT on (language_pair_id, query) so re-saving the same word
-- overwrites the cached AI markdown.

CREATE TABLE IF NOT EXISTS dictionary_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language_pair_id INTEGER NOT NULL REFERENCES language_pairs(id),
    query TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(language_pair_id, query)
);

CREATE INDEX IF NOT EXISTS idx_dictionary_entries_pair
    ON dictionary_entries(language_pair_id);

INSERT OR REPLACE INTO schema_version (version) VALUES (10);
