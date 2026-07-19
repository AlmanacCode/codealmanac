---
title: Local State Layout
topics: [reference, local-state, repositories, persistence, index]
sources:
  - id: readme
    type: file
    path: README.md
    note: Public local-state and configuration layout.
  - id: settings
    type: file
    path: src/codealmanac/settings.py
    note: AppConfig defaults and LocalStatePaths helpers.
  - id: core-paths
    type: file
    path: src/codealmanac/core/paths.py
    note: Default state, database, config, logs, and normalization helpers.
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Active local-only product and runtime-state decisions.
  - id: index-schema
    type: file
    path: src/codealmanac/services/index/schema.py
    note: Per-repository index database filename.
  - id: health-runtime
    type: file
    path: src/codealmanac/services/health/runtime.py
    note: Runtime files and directories forbidden inside almanac/.
  - id: settings-tests
    type: file
    path: tests/test_settings.py
    note: Tests for implicit and explicit local-state config paths.
  - id: yoke-adapter
    type: file
    path: src/codealmanac/integrations/harnesses/yoke/adapter.py
    note: Consumer of the harness runtime directory for Yoke provider caching.
---

# Local State Layout

Local state layout is the split between committed wiki source and machine-local runtime files. The repository-owned wiki is the `almanac/` tree. The local database, user config, per-repository derived indexes, update lock, and scheduler logs live under `~/.codealmanac/` by default [@readme] [@core-paths].

This layout follows the local-only Python product decision: authored Markdown stays reviewable in Git, while runtime state is kept outside the repository and can be rebuilt or removed without editing wiki source [@live-agreement]. The architecture page for this area is [Repository local state](../architecture/repositories/local-state), and the persistence boundary is [SQLite store boundaries](../architecture/persistence/sqlite-store-boundaries).

## Default Paths

| Path | Owner | Purpose |
| --- | --- | --- |
| `<repo>/almanac/` | Repository source | Committed wiki pages and `topics.yaml`. |
| `<repo>/almanac/topics.yaml` | Repository source | Authored topic definitions. |
| `~/.codealmanac/` | Local runtime | Default global state directory. |
| `~/.codealmanac/codealmanac.db` | Local runtime | Local database for repositories, runs, run events, worker locks, and sync state. |
| `~/.codealmanac/config.toml` | Local runtime | User config. |
| `~/.codealmanac/repos/<repo-id>/index.db` | Derived runtime | Per-repository search and graph index. |
| `~/.codealmanac/update.lock` | Local runtime | Global update lock. |
| `~/.codealmanac/logs/` | Local runtime | Scheduler stdout and stderr logs. |
| `~/.codealmanac/harnesses/` | Local runtime | Product-owned cache root for harness runtimes (Yoke Claude/Codex compilation; OpenCode native adapter also receives this root). |

`core.paths` defines the default state directory as `Path.home() / ".codealmanac"`, the default database as `~/.codealmanac/codealmanac.db`, the default config as `~/.codealmanac/config.toml`, and scheduler logs as `~/.codealmanac/logs` [@core-paths].

## App Config Paths

`AppConfig` defaults `database_path` and `config_path` to the default local-state paths and normalizes both paths through `expanduser().resolve(strict=False)` [@settings] [@core-paths]. Environment variables use the `CODEALMANAC_` prefix because `AppConfig` is a Pydantic settings model [@settings]. Repository-level config is not supported.

`LocalStatePaths.from_config` derives `state_dir` from the database parent. If the database path is customized and `config_path` was not explicitly set, config moves beside that database as `<database-parent>/config.toml` [@settings]. Tests cover both the implicit config path and an explicit custom config path [@settings-tests].

The database path must live directly inside the state directory. `LocalStatePaths` rejects a shape where the database is nested more deeply than `state_dir / "codealmanac.db"` would imply [@settings].

`LocalStatePaths.harness_runtime_dir` is `state_dir / "harnesses"` [@settings]. The composition root passes it to default harness adapters so Yoke caches stay under CodeAlmanac local state and OpenCode receives the same product-owned root; see [Yoke harness boundary](../architecture/agent-runs/provider-adapters) and [OpenCode harness](../architecture/agent-runs/opencode-harness).

## Per-Repository Runtime

Per-repository runtime files live under `state_dir / "repos" / <repo-id>` [@settings]. The index schema defines the derived index filename as `index.db` inside that runtime directory [@index-schema]. The public README documents this as `~/.codealmanac/repos/<repo-id>/index.db` [@readme].

The derived index is not authored wiki data. It can be rebuilt from `almanac/**/*.md` and `almanac/topics.yaml`, while the committed Markdown remains the durable artifact [@live-agreement].

## What Must Not Live In `almanac/`

Runtime state does not belong in the committed wiki tree. Health checks flag `index.db`, `index.db-wal`, `index.db-shm`, `jobs/`, and `runs/` inside `almanac/` with the message that runtime state belongs under `~/.codealmanac/` [@health-runtime].

This is also the reason [Only Almanac Root](../decisions/only-almanac-root) matters. `almanac/` is the only repo wiki root, but it is not an application state directory.
