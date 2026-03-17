-- ClaudeLingo v2 — Initial Schema

-- Paires de langues installées
CREATE TABLE IF NOT EXISTS language_pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_lang TEXT NOT NULL,
    target_lang TEXT NOT NULL,
    source_name TEXT NOT NULL,
    target_name TEXT NOT NULL,
    source_flag TEXT NOT NULL,
    target_flag TEXT NOT NULL,
    is_active INTEGER DEFAULT 0,
    UNIQUE(source_lang, target_lang)
);

-- Packs de dictionnaires téléchargés
CREATE TABLE IF NOT EXISTS dictionary_packs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language_pair_id INTEGER NOT NULL REFERENCES language_pairs(id),
    source TEXT NOT NULL,
    version TEXT,
    word_count INTEGER DEFAULT 0,
    downloaded_at TEXT DEFAULT (datetime('now'))
);

-- Mots (dictionnaire)
CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language_pair_id INTEGER NOT NULL REFERENCES language_pairs(id),
    source_word TEXT NOT NULL,
    target_word TEXT NOT NULL,
    gender TEXT,
    plural TEXT,
    level TEXT,
    category TEXT,
    tags TEXT,
    example_source TEXT,
    example_target TEXT,
    pack_id INTEGER REFERENCES dictionary_packs(id),
    UNIQUE(language_pair_id, source_word)
);

-- Recherche full-text
CREATE VIRTUAL TABLE IF NOT EXISTS words_fts USING fts5(
    source_word, target_word, category, tags,
    content='words', content_rowid='id'
);

-- Triggers pour sync FTS
CREATE TRIGGER IF NOT EXISTS words_ai AFTER INSERT ON words BEGIN
    INSERT INTO words_fts(rowid, source_word, target_word, category, tags)
    VALUES (new.id, new.source_word, new.target_word, new.category, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS words_ad AFTER DELETE ON words BEGIN
    INSERT INTO words_fts(words_fts, rowid, source_word, target_word, category, tags)
    VALUES ('delete', old.id, old.source_word, old.target_word, old.category, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS words_au AFTER UPDATE ON words BEGIN
    INSERT INTO words_fts(words_fts, rowid, source_word, target_word, category, tags)
    VALUES ('delete', old.id, old.source_word, old.target_word, old.category, old.tags);
    INSERT INTO words_fts(rowid, source_word, target_word, category, tags)
    VALUES (new.id, new.source_word, new.target_word, new.category, new.tags);
END;

-- Cartes SRS
CREATE TABLE IF NOT EXISTS srs_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    language_pair_id INTEGER NOT NULL REFERENCES language_pairs(id),
    repetitions INTEGER DEFAULT 0,
    ease_factor REAL DEFAULT 2.5,
    interval_days INTEGER DEFAULT 0,
    next_review TEXT NOT NULL,
    last_score INTEGER,
    added_date TEXT DEFAULT (date('now')),
    UNIQUE(word_id)
);

-- Sujets de grammaire
CREATE TABLE IF NOT EXISTS grammar_topics (
    id TEXT PRIMARY KEY,
    language_pair_id INTEGER NOT NULL REFERENCES language_pairs(id),
    level TEXT NOT NULL,
    display_order INTEGER NOT NULL,
    title TEXT NOT NULL,
    title_source TEXT,
    explanation TEXT NOT NULL,
    key_points TEXT,
    examples TEXT,
    exercises TEXT
);

-- Progression grammaire
CREATE TABLE IF NOT EXISTS grammar_progress (
    topic_id TEXT NOT NULL REFERENCES grammar_topics(id),
    language_pair_id INTEGER NOT NULL REFERENCES language_pairs(id),
    completed INTEGER DEFAULT 0,
    score_correct INTEGER DEFAULT 0,
    score_total INTEGER DEFAULT 0,
    completed_at TEXT,
    PRIMARY KEY(topic_id, language_pair_id)
);

-- Verbes + conjugaisons
CREATE TABLE IF NOT EXISTS verbs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language_pair_id INTEGER NOT NULL REFERENCES language_pairs(id),
    infinitive TEXT NOT NULL,
    translation TEXT NOT NULL,
    level TEXT,
    verb_type TEXT,
    auxiliary TEXT,
    is_separable INTEGER DEFAULT 0,
    conjugations TEXT NOT NULL,
    examples TEXT,
    UNIQUE(language_pair_id, infinitive)
);

-- Sessions d'étude
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language_pair_id INTEGER NOT NULL REFERENCES language_pairs(id),
    session_type TEXT NOT NULL,
    session_data TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Paramètres (ligne unique)
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    active_language_pair_id INTEGER REFERENCES language_pairs(id),
    level TEXT DEFAULT 'A2',
    words_per_day INTEGER DEFAULT 10,
    streak INTEGER DEFAULT 0,
    last_session_date TEXT,
    start_date TEXT,
    dark_mode INTEGER DEFAULT 0,
    audio_enabled INTEGER DEFAULT 1
);

-- Log d'erreurs
CREATE TABLE IF NOT EXISTS errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language_pair_id INTEGER NOT NULL REFERENCES language_pairs(id),
    error_type TEXT NOT NULL,
    word_or_topic TEXT,
    user_answer TEXT,
    correct_answer TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
);
INSERT OR IGNORE INTO schema_version (version) VALUES (1);

-- Default settings row
INSERT OR IGNORE INTO settings (id, level, words_per_day) VALUES (1, 'A2', 10);
