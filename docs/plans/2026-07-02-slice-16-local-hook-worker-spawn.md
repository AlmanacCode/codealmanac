# Slice 16 Plan: Local Hook Worker Spawn

Status: planned.
Date: 2026-07-02.

## Intent

Connect local Git hooks to the local worker without running model work inside
the Git hook process.

The hook path becomes:

```text
post-commit/post-merge/post-rewrite
  -> codealmanac __record-local-trigger --spawn-worker
       -> record trigger synchronously
       -> spawn codealmanac __run-local-worker for the recorded repo/branch
```

## Product Contract

- Git hooks still record the trigger synchronously.
- Git hooks do not run the model worker inline.
- The trigger command spawns a detached local worker only when a trigger event
  was actually recorded.
- The spawned worker is filtered to the recorded repository and branch.
- The hidden trigger command remains quiet by default.
- `--json` includes worker spawn data when a worker was spawned.

## Code Shape

```python
result = app.control.record_current_git_trigger(...)
if args.spawn_worker and result.event is not None:
    worker = app.local_worker_spawner.spawn(
        SpawnLocalWorkerRequest(
            cwd=Path(args.cwd),
            repository_id=result.event.repository_id,
            branch_id=result.event.branch_id,
        )
    )
```

The process command is:

```bash
python -m codealmanac.cli.main __run-local-worker \
  --repository-id <repo-id> \
  --branch-id <branch-id> \
  --operation update \
  --using codex
```

## Implementation Scope

Add:

- `SpawnLocalWorkerRequest`
- `LocalWorkerSpawner` port
- `SubprocessLocalWorkerSpawner` integration
- `app.local_worker_spawner`
- `__record-local-trigger --spawn-worker`
- Git hook block update to include `--spawn-worker`
- tests for command building, trigger-spawn JSON, no-spawn when ignored, and
  hook content

Out of scope:

- public local setup command
- worker process lock beyond atomic trigger claiming
- logging worker output to a surfaced UI
- retry/backoff machinery

## Verification

Focused:

```bash
uv run pytest tests/test_cli.py tests/test_local_hooks.py tests/test_local_worker_spawner.py tests/test_architecture.py
```

Full gate:

```bash
uv run pytest
uv run ruff check .
git diff --check
```
