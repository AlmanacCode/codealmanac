# Slice 89: CLI Run Surface Convergence

## Intent

Bring the local CLI surface into the launch model from
`docs/codealmanac-launch/cli-inconsistency-ledger.md`.

The product noun for wiki-maintenance execution is `run`. Cloud already exposes
`codealmanac runs ...`; local should expose `codealmanac local runs ...`.
The old `sync` and scheduled `automation` surfaces encode the previous
time-based model and should disappear from the launch-facing CLI.

## Read Before Coding

- `MANUAL.md`: the unit of work is reshaping the codebase so the feature fits.
- `.almanac/README.md`: wiki conventions and current repo taxonomy.
- `docs/codealmanac-launch/cli-inconsistency-ledger.md`: concrete command
  cleanup contract.
- `docs/reference/cosmic-python/chapter_04_service_layer.md`: CLI edges should
  call service-layer use cases.
- `docs/reference/cosmic-python/chapter_10_commands.md`: public commands express
  user intent; events are facts recorded behind the service boundary.

Useful Cosmic Python line for this slice: commands "capture intent" and should
fail noisily, while events are facts. That maps to `local runs start` as the
intent and `trigger_events` as the internal fact table.

## Scope

Must change:

- Replace public `codealmanac local update` with
  `codealmanac local runs start`.
- Replace public `codealmanac local jobs list|show|logs` with
  `codealmanac local runs list|show|logs`.
- Keep local run execution backed by the existing control DB `runs` and
  `run_events` tables.
- Remove public `codealmanac sync` parsing and dispatch.
- Remove public `codealmanac automation install|status|uninstall`.
- Remove old sync/automation composition from `app.py` if no current launch
  caller remains.
- Move internal local trigger and worker entrypoints out of the product CLI
  grammar. Git hooks and spawned workers should use private Python modules.
- Update README, launch CLI docs, worklog, verification notes, and tests.
- Keep `codealmanac update` as package self-update. That command is not part of
  this cleanup.

Should change if clean:

- Rename local run-read models and requests from `LocalJob*` to `LocalRun*`.
- Delete unused CLI render/dispatch/parser files for sync and automation.
- Delete `tests/test_sync_workflow.py` and `tests/test_automation_service.py` if
  the corresponding production modules are removed.

Out of scope:

- Designing future timer policy. Future timers should create normal trigger rows
  and should not revive `sync`.
- Changing cloud hosted API behavior.
- Removing repo-local historical plan files that mention old commands. Launch
  docs and public docs must be current; old plans can remain as history.

## Architecture Wireframe

```python
# public local CLI edge
codealmanac.local.runs.start(args)
  -> LocalRunsWorkflow.start(StartLocalRunRequest(...))
     -> LocalStatusWorkflow.status(...)
     -> ControlService.record_trigger_event(kind=manual, ...)
     -> LocalWorkerWorkflow.run_next(...)

codealmanac.local.runs.list(args)
  -> LocalRunsWorkflow.list(ListLocalRunsRequest(...))
     -> ControlService.list_runs(...)

# private process edge used by Git hooks / subprocesses, not product CLI
codealmanac-local-trigger --cwd ... --kind local_post_commit --spawn-worker
  -> ControlService.record_current_git_trigger(...)
  -> LocalWorkerSpawner.spawn(...)

codealmanac-local-worker --repository-id ... --branch-id ...
  -> LocalWorkerWorkflow.run_next(...)
```

The CLI remains an adapter. The new `LocalRunsWorkflow` owns the product verb
`start`; the control DB owns persistence; private process modules own only
argument parsing for machine entrypoints.

## Verification

Focused gates:

```bash
uv run pytest tests/test_cli.py tests/test_public_contract.py tests/test_architecture.py
uv run pytest tests/test_local_runs_workflow.py tests/test_local_worker_spawner.py tests/test_local_hooks.py
uv run ruff check .
uv run ruff format --check .
git diff --check
```

If full `tests/test_cli.py` is too broad after deleting old sync/automation
tests, run targeted CLI tests first and then the full suite before commit.

## Risk

The biggest risk is deleting useful transcript-discovery logic while removing
`sync`. The ledger says the old `sync-ledger.json` route is the wrong product
model; any reusable transcript reader should be rehomed later under source or
capture services that populate control DB sessions and branch links.
