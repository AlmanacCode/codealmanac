RUN_TABLES = """
CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    title TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    record_json TEXT NOT NULL,
    spec_json TEXT,
    FOREIGN KEY (repository_id) REFERENCES repositories(repository_id)
);

CREATE INDEX IF NOT EXISTS runs_repository_created_idx
    ON runs(repository_id, created_at);

CREATE INDEX IF NOT EXISTS runs_status_created_idx
    ON runs(status, created_at);
"""

RUN_EVENT_TABLES = """
CREATE TABLE IF NOT EXISTS run_events (
    run_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    event_json TEXT NOT NULL,
    PRIMARY KEY (run_id, sequence),
    FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE
);
"""

WORKER_LOCK_TABLES = """
CREATE TABLE IF NOT EXISTS worker_locks (
    name TEXT PRIMARY KEY,
    owner_json TEXT NOT NULL
);
"""
