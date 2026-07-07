REPOSITORY_TABLES = """
CREATE TABLE IF NOT EXISTS repositories (
    repository_id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    root_path TEXT NOT NULL UNIQUE,
    almanac_root TEXT NOT NULL,
    registered_at TEXT NOT NULL
);
"""
