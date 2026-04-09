-- Favorite lists (like playlists for words)
CREATE TABLE IF NOT EXISTS favorite_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    language_pair_id INTEGER NOT NULL REFERENCES language_pairs(id),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(name, language_pair_id)
);

-- Join table: which favorites belong to which lists
CREATE TABLE IF NOT EXISTS favorite_list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL REFERENCES favorite_lists(id) ON DELETE CASCADE,
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(list_id, word_id)
);

CREATE INDEX IF NOT EXISTS idx_fli_list ON favorite_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_fli_word ON favorite_list_items(word_id);

INSERT OR REPLACE INTO schema_version (version) VALUES (7);
