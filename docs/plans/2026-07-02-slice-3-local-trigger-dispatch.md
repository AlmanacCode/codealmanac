# Slice 3: Local Trigger Dispatcher

Date: 2026-07-02.
Status: implemented.

## Goal

Make local Git hook events callable through a hidden CLI dispatcher that records
trigger events using the Slice 2 control service.

This slice does not install hooks into `.git/hooks`. It builds the internal
entrypoint that installed hooks will call:

```bash
codealmanac __record-local-trigger --kind local_post_commit --cwd "$PWD"
```

## Read Before Coding

- `MANUAL.md`
- `docs/codealmanac-launch/schema-contract.md`
- `docs/plans/2026-07-02-slice-2-local-trigger-events.md`
- `src/codealmanac/services/control/`
- `src/codealmanac/integrations/workspaces/git/probe.py`
- `src/codealmanac/cli/parser/lifecycle.py`
- `src/codealmanac/cli/dispatch/lifecycle.py`
- `tests/test_cli.py`

## Target Shape

```python
state = app.control.record_current_git_trigger(
    RecordCurrentGitTriggerRequest(
        cwd=Path("."),
        kind=TriggerEventKind.LOCAL_POST_COMMIT,
    )
)
```

`ControlService` owns the product decision. A Git state probe only reports:

```text
repository_root
branch_name
head_sha
```

The CLI dispatch layer does not import Git integrations directly. `app.py`
wires the concrete Git probe into the control service.

## Behavior

- If Git state is unavailable, the hidden command exits `0` and records no
  event.
- If the repository root is not configured in the control DB, the hidden command
  exits `0` and records no event.
- If the branch is not enabled, the hidden command exits `0` and records no
  event.
- If the branch is enabled, the hidden command records a pending trigger event.
- `--json` prints the structured `RecordTriggerEventResult`; default output is
  silent for hook safety.

## Out Of Scope

- Installing Git hooks.
- Git remote parsing.
- Branch policy CLI commands.
- Worker claim/run/delivery.
- Capture/source bundle selection.

## Implementation Plan

1. Add a control-owned `LocalGitStateProbe` port and `LocalGitState` model.
2. Add `RecordCurrentGitTriggerRequest`.
3. Add a concrete `GitLocalStateProbe` integration using `git rev-parse` and
   `git branch --show-current`.
4. Wire the probe into `create_app()`.
5. Add `ControlService.record_current_git_trigger()`.
6. Add `ControlStore.record_local_trigger()` to map `repository_root` to the
   configured repository row by `local_root_path`.
7. Add hidden lifecycle command `__record-local-trigger`.
8. Add focused tests for the service, Git probe, and hidden CLI command.

## Verification

Run:

```bash
uv run pytest tests/test_control_service.py tests/test_git_workspace_probe.py tests/test_cli.py tests/test_architecture.py
git diff --check
```

Run full `uv run pytest` before committing.

## Result

Implemented the hidden local trigger dispatcher:

```bash
codealmanac __record-local-trigger --kind local_post_commit --cwd "$PWD"
```

The command uses `ControlService.record_current_git_trigger()`, which reads Git
state through the `LocalGitStateProbe` port and writes trigger events through
the control store. The CLI dispatch layer does not import Git integrations.

Default output is silent. `--json` prints the structured
`RecordTriggerEventResult`.

Focused verification passed:

```text
uv run pytest tests/test_control_service.py tests/test_git_workspace_probe.py tests/test_cli.py tests/test_architecture.py
104 passed

uv run ruff check .
passed

git diff --check
passed
```
