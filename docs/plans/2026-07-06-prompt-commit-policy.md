# Prompt Commit Policy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make auto-commit a lifecycle prompt permission, not CodeAlmanac Git orchestration.

**Architecture:** `services/config` owns the persisted `auto_commit` setting. CLI dispatch loads config and passes a boolean into lifecycle request models. Ingest and Garden render a typed `source_control` block into the prompt runtime context. No service stages files, commits, splits diffs, transports commits, or owns Git commit behavior.

**Tech Stack:** Pydantic config/request models, TOML user config file, thin argparse/dispatch/render CLI edges, existing lifecycle prompt renderer.

---

### Task 1: Add The Config Setting

**Files:**
- Modify: `src/codealmanac/services/config/models.py`
- Modify: `src/codealmanac/services/config/requests.py`
- Modify: `src/codealmanac/services/config/service.py`
- Modify: `src/codealmanac/services/config/store.py`
- Test: `tests/test_config_service.py`

**Steps:**

1. Add `auto_commit: bool = True` to `UserConfig`.
2. Add `ConfigKey.AUTO_COMMIT`, `SetConfigValueRequest`, and `ConfigSetResult`.
3. Add `ConfigService.set(...)` that writes user config through `ConfigStore`.
4. Add `ConfigStore.set_auto_commit(path, enabled)` using a small TOML-line writer for this one top-level key.
5. Test default true, user/project precedence, and setting false/true in the user config.

### Task 2: Add The Public CLI Surface

**Files:**
- Create: `src/codealmanac/cli/parser/config.py`
- Create: `src/codealmanac/cli/dispatch/config_command.py`
- Create: `src/codealmanac/cli/render/config.py`
- Modify: `src/codealmanac/cli/parser/admin.py`
- Modify: `src/codealmanac/cli/dispatch/admin.py`
- Modify: `src/codealmanac/cli/render/admin.py`
- Test: `tests/test_cli.py`

**Steps:**

1. Add `codealmanac config set auto_commit true|false`.
2. Dispatch it to `app.config.set(...)`.
3. Render plain text as `config: auto_commit = false`.
4. Add CLI tests for setting false and for parser help including `config`.

### Task 3: Add Setup Flag

**Files:**
- Modify: `src/codealmanac/cli/parser/setup.py`
- Modify: `src/codealmanac/cli/dispatch/setup.py`
- Modify: `src/codealmanac/services/setup/requests.py`
- Modify: `src/codealmanac/services/setup/service.py`
- Modify: `src/codealmanac/services/setup/models.py`
- Modify: `src/codealmanac/cli/render/setup.py`
- Test: `tests/test_setup_service.py`
- Test: `tests/test_cli.py`

**Steps:**

1. Add `setup --no-auto-commit`.
2. Default setup writes `auto_commit = true`; `--no-auto-commit` writes false.
3. Include the result in `SetupResult`.
4. Render the selected policy in setup output/JSON.

### Task 4: Thread Policy Into Lifecycle Prompts

**Files:**
- Create: `src/codealmanac/workflows/lifecycle_commit.py`
- Modify: `src/codealmanac/workflows/ingest/requests.py`
- Modify: `src/codealmanac/workflows/garden/requests.py`
- Modify: `src/codealmanac/workflows/ingest/models.py`
- Modify: `src/codealmanac/workflows/garden/models.py`
- Modify: `src/codealmanac/workflows/ingest/service.py`
- Modify: `src/codealmanac/workflows/garden/service.py`
- Modify: `src/codealmanac/workflows/run_queue/service.py`
- Modify: `src/codealmanac/services/runs/models.py`
- Modify: `src/codealmanac/cli/dispatch/operations.py`
- Test: `tests/test_ingest_workflow.py`
- Test: `tests/test_run_queue_workflow.py`

**Steps:**

1. Add a typed `LifecycleCommitPolicy` with:
   - `auto_commit`
   - allowed wiki source patterns
   - forbidden file categories
   - commit message shape `almanac: <summary>`
   - instruction text that either permits or forbids committing.
2. Add `auto_commit: bool = True` to ingest/garden request models and durable `RunSpec`.
3. CLI operations pass `cli_config.auto_commit`.
4. Background queue persists and rehydrates `auto_commit`.
5. Prompt payloads include `source_control`.

### Task 5: Guard Against Git Machinery

**Files:**
- Test: `tests/test_architecture.py`

**Steps:**

1. Add an architecture test that fails if CodeAlmanac grows a committer/staging service name.
2. Add or keep text assertions proving prompts say to use normal git when allowed and say not to commit when disabled.
3. Run:

```bash
uv run pytest tests/test_config_service.py tests/test_setup_service.py tests/test_ingest_workflow.py tests/test_run_queue_workflow.py tests/test_cli.py tests/test_architecture.py
uv run ruff check .
uv run pytest
uv run codealmanac validate
```
