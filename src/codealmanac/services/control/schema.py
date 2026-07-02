from pathlib import Path

from codealmanac.database import (
    SQLiteConnection,
    SQLiteMigration,
    apply_migrations,
    connect_sqlite,
)

CONTROL_SCHEMA_VERSION = 2026070201

CONTROL_TABLES = (
    "repositories",
    "branches",
    "sessions",
    "turns",
    "turn_branches",
    "trigger_events",
    "runs",
    "run_events",
    "deliveries",
)

CONTROL_SCHEMA_DDL = """
CREATE TABLE IF NOT EXISTS repositories (
  id               TEXT PRIMARY KEY,
  provider         TEXT NOT NULL,
  provider_repo_id TEXT,
  owner_login      TEXT NOT NULL,
  owner_type       TEXT,
  name             TEXT NOT NULL,
  full_name        TEXT NOT NULL UNIQUE,
  default_branch   TEXT,
  almanac_root     TEXT NOT NULL,
  local_root_path  TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_repositories_provider_repo
  ON repositories(provider, provider_repo_id);
CREATE INDEX IF NOT EXISTS idx_repositories_local_root
  ON repositories(local_root_path);

CREATE TABLE IF NOT EXISTS branches (
  id                       TEXT PRIMARY KEY,
  repository_id            TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,
  trigger_enabled          INTEGER NOT NULL DEFAULT 0 CHECK (trigger_enabled IN (0, 1)),
  delivery_mode            TEXT NOT NULL CHECK (
    delivery_mode IN ('working_tree', 'commit', 'pr')
  ),
  last_seen_head_sha       TEXT,
  last_triggered_head_sha  TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  UNIQUE(repository_id, name)
);
CREATE INDEX IF NOT EXISTS idx_branches_repository
  ON branches(repository_id);

CREATE TABLE IF NOT EXISTS sessions (
  id                  TEXT PRIMARY KEY,
  provider            TEXT NOT NULL CHECK (provider IN ('codex', 'claude')),
  provider_session_id TEXT NOT NULL,
  source_ref          TEXT NOT NULL,
  started_at          TEXT,
  ended_at            TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  UNIQUE(provider, provider_session_id)
);

CREATE TABLE IF NOT EXISTS turns (
  id               TEXT PRIMARY KEY,
  session_id       TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  provider_turn_id TEXT,
  sequence         INTEGER NOT NULL CHECK (sequence >= 1),
  created_at       TEXT NOT NULL,
  metadata_json    TEXT NOT NULL DEFAULT '{}',
  UNIQUE(session_id, sequence)
);
CREATE INDEX IF NOT EXISTS idx_turns_session
  ON turns(session_id);

CREATE TABLE IF NOT EXISTS turn_branches (
  turn_id    TEXT NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
  branch_id  TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  detector   TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(turn_id, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_turn_branches_branch
  ON turn_branches(branch_id);

CREATE TABLE IF NOT EXISTS trigger_events (
  id                TEXT PRIMARY KEY,
  repository_id     TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  branch_id         TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL CHECK (
    kind IN (
      'cloud_webhook',
      'local_post_commit',
      'local_post_merge',
      'local_post_rewrite',
      'manual'
    )
  ),
  head_sha          TEXT NOT NULL,
  previous_head_sha TEXT,
  payload_ref       TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'claimed', 'ignored', 'superseded')
  ),
  created_at        TEXT NOT NULL,
  claimed_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_trigger_events_branch_status
  ON trigger_events(branch_id, status, created_at);

CREATE TABLE IF NOT EXISTS runs (
  id                 TEXT PRIMARY KEY,
  repository_id      TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  branch_id          TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  trigger_event_id   TEXT REFERENCES trigger_events(id) ON DELETE SET NULL,
  operation          TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (
    status IN ('queued', 'running', 'succeeded', 'failed', 'stale', 'cancelled')
  ),
  expected_head_sha  TEXT,
  source_bundle_ref  TEXT,
  request_ref        TEXT,
  result_ref         TEXT,
  summary            TEXT,
  commit_subject     TEXT,
  commit_body        TEXT,
  error              TEXT,
  started_at         TEXT,
  finished_at        TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_branch_status
  ON runs(branch_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_runs_trigger_event
  ON runs(trigger_event_id);

CREATE TABLE IF NOT EXISTS run_events (
  run_id       TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  sequence     INTEGER NOT NULL CHECK (sequence >= 1),
  timestamp    TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (
    kind IN ('status', 'message', 'tool', 'output', 'error')
  ),
  message      TEXT NOT NULL,
  event_json   TEXT,
  artifact_ref TEXT,
  PRIMARY KEY(run_id, sequence)
);

CREATE TABLE IF NOT EXISTS deliveries (
  id                 TEXT PRIMARY KEY,
  run_id             TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  mode               TEXT NOT NULL CHECK (mode IN ('working_tree', 'commit', 'pr')),
  status             TEXT NOT NULL CHECK (
    status IN ('pending', 'succeeded', 'failed', 'skipped')
  ),
  target_ref         TEXT,
  expected_head_sha  TEXT,
  delivered_head_sha TEXT,
  commit_sha         TEXT,
  pr_url             TEXT,
  summary            TEXT,
  error              TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  finished_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_deliveries_run
  ON deliveries(run_id);
"""

CONTROL_MIGRATIONS = (
    SQLiteMigration(version=CONTROL_SCHEMA_VERSION, sql=CONTROL_SCHEMA_DDL),
)


def connect_control(path: Path) -> SQLiteConnection:
    connection = connect_sqlite(path)
    apply_migrations(connection, CONTROL_MIGRATIONS)
    return connection
