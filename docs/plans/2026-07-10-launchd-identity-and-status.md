# Launchd Identity And Status

## Goal

Make scheduled macOS jobs launch through the `codealmanac` console command and
show whether launchd has actually run each job successfully.

## Scope

- Generate branded `ProgramArguments` for sync, Garden, and update.
- Read launchd's state, run count, PID, and last exit code.
- Show those facts in `codealmanac automation status`.
- Reinstall the three local jobs and verify them.

## Out Of Scope

- A signed macOS app bundle or icon in System Settings.
- A non-macOS scheduler.
- Exact last-run timestamps, which launchd does not expose in job status.

## Design

`AutomationJobFactory` continues to own known CodeAlmanac task commands. The
launchd adapter continues to own plist and `launchctl` details. Scheduler facts
cross that boundary as typed status fields; the CLI only renders them.

The service-layer reference describes a service layer as the entry point for a
use case; scheduler parsing therefore stays out of CLI dispatch. See
`docs/reference/cosmic-python/chapter_04_service_layer.md`.

## Files

- `src/codealmanac/services/automation/{jobs,models,requests}.py`
- `src/codealmanac/integrations/automation/scheduler/launchd.py`
- `src/codealmanac/cli/render/automation.py`
- `tests/test_automation_service.py`
- `almanac/guides/setup-local-automation.md`

## Tests

- Job commands begin with the CodeAlmanac executable.
- launchd status parsing tolerates running, idle, failed, and missing jobs.
- Human and JSON status include run health.
- `uv run pytest` and `uv run ruff check .` pass.
