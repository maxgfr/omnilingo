-- Migration 005: Simplification — conversation scenarios, grammar SRS, flashcard extensions

-- Conversation scenarios (user-defined + system)
CREATE TABLE IF NOT EXISTS conversation_scenarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language_pair_id INTEGER NOT NULL REFERENCES language_pairs(id),
    name TEXT NOT NULL,
    icon TEXT DEFAULT '',
    description TEXT DEFAULT '',
    system_prompt TEXT DEFAULT '',
    is_builtin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Conversation sessions (history of past conversations)
CREATE TABLE IF NOT EXISTS conversation_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language_pair_id INTEGER NOT NULL REFERENCES language_pairs(id),
    scenario_id INTEGER REFERENCES conversation_scenarios(id),
    mode TEXT NOT NULL,
    title TEXT DEFAULT '',
    messages TEXT NOT NULL DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conv_sessions_pair ON conversation_sessions(language_pair_id, created_at);

-- Grammar SRS (spaced repetition on grammar topics)
CREATE TABLE IF NOT EXISTS grammar_srs (
    topic_id TEXT NOT NULL,
    language_pair_id INTEGER NOT NULL,
    repetitions INTEGER DEFAULT 0,
    ease_factor REAL DEFAULT 2.5,
    interval_days INTEGER DEFAULT 0,
    next_review TEXT NOT NULL,
    last_score INTEGER,
    PRIMARY KEY(topic_id, language_pair_id)
);

-- Extensions flashcards: card type, deck, cloze sentence
ALTER TABLE srs_cards ADD COLUMN card_type TEXT DEFAULT 'translation';
ALTER TABLE srs_cards ADD COLUMN deck TEXT DEFAULT 'default';
ALTER TABLE srs_cards ADD COLUMN cloze_sentence TEXT;

INSERT OR REPLACE INTO schema_version (version) VALUES (5);
