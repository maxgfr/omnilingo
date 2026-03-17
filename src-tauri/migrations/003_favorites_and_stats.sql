-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    language_pair_id INTEGER NOT NULL REFERENCES language_pairs(id),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(word_id)
);

-- Daily stats cache (for charts)
CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT NOT NULL,
    language_pair_id INTEGER NOT NULL REFERENCES language_pairs(id),
    words_learned INTEGER DEFAULT 0,
    words_reviewed INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    time_spent_seconds INTEGER DEFAULT 0,
    PRIMARY KEY(date, language_pair_id)
);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    unlocked_at TEXT,
    progress INTEGER DEFAULT 0
);

UPDATE schema_version SET version = 3;
