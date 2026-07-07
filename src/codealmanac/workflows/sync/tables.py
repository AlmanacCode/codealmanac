SYNC_STATE_TABLES = """
CREATE TABLE IF NOT EXISTS sync_state (
    name TEXT PRIMARY KEY,
    last_completed_at TEXT
);
"""
