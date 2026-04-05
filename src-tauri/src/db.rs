use rusqlite::Connection;
use std::path::Path;

pub fn init_database(base_dir: &Path) -> Result<Connection, String> {
    let db_path = base_dir.join("omnilingo.db");
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // Enable WAL mode for better performance
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Failed to set pragmas: {}", e))?;

    run_migrations(&conn)?;
    Ok(conn)
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
