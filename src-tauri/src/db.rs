use rusqlite::Connection;
use std::path::Path;

pub fn init_database(base_dir: &Path) -> Result<Connection, String> {
    let db_path = base_dir.join("omnilingo.db");
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // Enable WAL mode for better performance
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Failed to set pragmas: {}", e))?;

    register_custom_functions(&conn)?;
    run_migrations(&conn)?;
    Ok(conn)
}

fn register_custom_functions(conn: &Connection) -> Result<(), String> {
    conn.create_scalar_function(
        "unaccent",
        1,
        rusqlite::functions::FunctionFlags::SQLITE_UTF8
            | rusqlite::functions::FunctionFlags::SQLITE_DETERMINISTIC,
        |ctx| {
            let s: String = ctx.get(0)?;
            Ok(normalize_for_search(&s))
        },
    )
    .map_err(|e| format!("Failed to register unaccent function: {}", e))?;
    Ok(())
}

/// Normalize a string for accent-insensitive, case-insensitive search.
/// Strips diacritics, lowercases, expands ß→ss, æ→ae, œ→oe.
pub fn normalize_for_search(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            'à' | 'á' | 'â' | 'ã' | 'ä' | 'å' | 'À' | 'Á' | 'Â' | 'Ã' | 'Ä' | 'Å' => {
                result.push('a')
            }
            'è' | 'é' | 'ê' | 'ë' | 'È' | 'É' | 'Ê' | 'Ë' => result.push('e'),
            'ì' | 'í' | 'î' | 'ï' | 'Ì' | 'Í' | 'Î' | 'Ï' => result.push('i'),
            'ò' | 'ó' | 'ô' | 'õ' | 'ö' | 'Ò' | 'Ó' | 'Ô' | 'Õ' | 'Ö' => result.push('o'),
            'ù' | 'ú' | 'û' | 'ü' | 'Ù' | 'Ú' | 'Û' | 'Ü' => result.push('u'),
            'ñ' | 'Ñ' => result.push('n'),
            'ç' | 'Ç' => result.push('c'),
            'ß' => result.push_str("ss"),
            'ÿ' | 'Ÿ' => result.push('y'),
            'æ' | 'Æ' => result.push_str("ae"),
            'œ' | 'Œ' => result.push_str("oe"),
            _ => {
                for lc in c.to_lowercase() {
                    result.push(lc);
                }
            }
        }
    }
    result
}

fn run_migrations(conn: &Connection) -> Result<(), String> {
    let current_version = get_schema_version(conn);

    if current_version < 1 {
        let migration_sql = include_str!("../migrations/001_initial_schema.sql");
        conn.execute_batch(migration_sql)
            .map_err(|e| format!("Migration 001 failed: {}", e))?;
    }

    if current_version < 2 {
        let migration_sql = include_str!("../migrations/002_ai_providers.sql");
        conn.execute_batch(migration_sql)
            .map_err(|e| format!("Migration 002 failed: {}", e))?;
    }

    if current_version < 3 {
        let migration_sql = include_str!("../migrations/003_favorites_and_stats.sql");
        conn.execute_batch(migration_sql)
            .map_err(|e| format!("Migration 003 failed: {}", e))?;
    }

    if current_version < 4 {
        let migration_sql = include_str!("../migrations/004_chat_history.sql");
        conn.execute_batch(migration_sql)
            .map_err(|e| format!("Migration 004 failed: {}", e))?;
        conn.execute("INSERT OR REPLACE INTO schema_version (version) VALUES (4)", [])
            .map_err(|e| format!("Failed to update schema version: {}", e))?;
    }

    if current_version < 5 {
        let migration_sql = include_str!("../migrations/005_simplification.sql");
        conn.execute_batch(migration_sql)
            .map_err(|e| format!("Migration 005 failed: {}", e))?;
    }

    if current_version < 6 {
        let migration_sql = include_str!("../migrations/006_custom_ai_url.sql");
        conn.execute_batch(migration_sql)
            .map_err(|e| format!("Migration 006 failed: {}", e))?;
        conn.execute("INSERT OR REPLACE INTO schema_version (version) VALUES (6)", [])
            .map_err(|e| format!("Failed to update schema version: {}", e))?;
    }

    if current_version < 7 {
        let migration_sql = include_str!("../migrations/007_favorite_lists.sql");
        conn.execute_batch(migration_sql)
            .map_err(|e| format!("Migration 007 failed: {}", e))?;
    }

    if current_version < 8 {
        let migration_sql = include_str!("../migrations/008_drop_srs.sql");
        conn.execute_batch(migration_sql)
            .map_err(|e| format!("Migration 008 failed: {}", e))?;
    }

    if current_version < 9 {
        let migration_sql = include_str!("../migrations/009_remove_freedict.sql");
        conn.execute_batch(migration_sql)
            .map_err(|e| format!("Migration 009 failed: {}", e))?;
    }

    if current_version < 10 {
        let migration_sql = include_str!("../migrations/010_dictionary_entries.sql");
        conn.execute_batch(migration_sql)
            .map_err(|e| format!("Migration 010 failed: {}", e))?;
    }

    Ok(())
}

fn get_schema_version(conn: &Connection) -> i64 {
    conn.query_row(
        "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1",
        [],
        |row| row.get(0),
    )
    .unwrap_or(0)
}
