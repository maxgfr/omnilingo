-- Chat message persistence (replaces sessionStorage)
CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language_pair_id INTEGER NOT NULL REFERENCES language_pairs(id),
    role TEXT NOT NULL,          -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_pair ON chat_messages(language_pair_id, created_at);
