# Slice 19 Plan: Local Update Command

Status: implemented.
Date: 2026-07-02.

## Intent

Add the public command that runs the local maintenance pipeline now:

```bash
codealmanac local update
codealmanac local update --using codex --json
```

This command is the local equivalent of a user-triggered run. It should work
after `codealmanac local setup` without waiting for a Git hook.

## Product Contract

- `local update` is foreground by default.
- `local update` runs for the current Git checkout and current branch.
- The current branch must already be configured by `local setup`.
- The command creates a `manual` trigger event for the current HEAD.
- Manual triggers may run again on the same Git head because source/capture
  material can change while code does not.
- The command does not start a duplicate run when the same branch already has a
  queued or running local run.
- The worker path stays the same: trigger -> prepare -> engine -> delivery.

## Code Shape

```python
result = app.workflows.local_update.update(
    RunLocalUpdateRequest(
        cwd=Path.cwd(),
        harness=HarnessKind(args.using),
    )
)
```

Inside the workflow:

```python
checkout = repository_probe.read(cwd)
repository = control.find_repository_by_local_root(checkout.repository_root)
branch = control.find_branch_by_name(repository.id, checkout.branch_name)
active = control.list_runs(branch_id=branch.id, statuses=(queued, running))
trigger = control.record_trigger_event(
    RecordTriggerEventRequest(
        repository_id=repository.id,
        branch_name=branch.name,
        kind=TriggerEventKind.MANUAL,
        head_sha=checkout.head_sha,
        allow_duplicate_head=True,
        replace_pending=True,
    )
)
worker = local_worker.run_next(repository_id=repository.id, branch_id=branch.id)
```

Ownership:

- `workflows/local_update/` owns manual local update orchestration.
- `control` owns duplicate-head and pending-trigger semantics.
- `local_worker` remains the only owner of the local run execution pipeline.
- CLI dispatch maps args to the workflow and renders the typed result.

## Implementation Scope

Add:

- manual trigger flags on `RecordTriggerEventRequest`
  - `allow_duplicate_head`
  - `replace_pending`
- store behavior for same-head manual reruns and replacing older pending
  triggers.
- `workflows/local_update/` with models, requests, and service.
- `codealmanac local update`.
- focused control, workflow, CLI, and architecture tests.

Out of scope:

- background `local update`
- schedule installation
- cloud `runs start`
- capture setup
- migration from repo-local `almanac/jobs/`

## Verification

Focused:

```bash
uv run pytest tests/test_control_service.py tests/test_local_update_workflow.py tests/test_cli.py tests/test_architecture.py
```

Result: `131 passed`.

Full gate:

```bash
uv run pytest
uv run ruff check .
git diff --check
```

Result: `446 passed`; ruff and diff-check passed.
