---
title: Sync And Automation
summary: Sync scans local transcripts and automation installs local scheduled jobs.
topics: [architecture, operations, cli]
sources:
  - id: sync-dispatch
    type: file
    path: src/codealmanac/cli/dispatch/sync.py
    note: CLI dispatch for sync and sync status.
  - id: sync-service
    type: file
    path: src/codealmanac/workflows/sync/service.py
    note: Sync workflow coordination.
  - id: sync-queue
    type: file
    path: src/codealmanac/workflows/sync/queue.py
    note: Turns eligible transcript groups into queued ingest runs.
  - id: automation-service
    type: file
    path: src/codealmanac/services/automation/service.py
    note: Automation install, uninstall, and status service.
  - id: automation-jobs
    type: file
    path: src/codealmanac/services/automation/jobs.py
    note: Scheduled job construction.
  - id: automation-selection
    type: file
    path: src/codealmanac/services/automation/selection.py
    note: Automation task defaulting and explicit-task validation.
  - id: updates-service
    type: file
    path: src/codealmanac/services/updates/service.py
    note: Manual and scheduled package update policy.
  - id: updates-lock
    type: file
    path: src/codealmanac/services/updates/lock.py
    note: Global scheduled update lock.
  - id: updates-activity
    type: file
    path: src/codealmanac/services/updates/activity.py
    note: Active lifecycle run detection for scheduled update.
---

# Sync And Automation

`codealmanac sync` defaults to scanning Claude and Codex transcript sources unless `--from` restricts the app set [@sync-dispatch]. The dispatch layer resolves CLI config and harness, then calls the sync workflow [@sync-dispatch].

`SyncWorkflow` evaluates transcript candidates active since the last completed sync, matches each transcript cwd to an exact registered repository root, and delegates ingest run queueing to `SyncIngestQueue` [@sync-service] [@sync-queue]. `sync status` runs the same evaluation path without starting ingest work [@sync-service].

Automation installs scheduled jobs through `AutomationService`, which builds task jobs and passes them to the scheduler adapter [@automation-service]. The default automation task set is `sync`, `garden`, and `update`; explicit task requests stay explicit, setup can remove default tasks through opt-out flags, and the shared `--every` cadence applies to sync while update keeps its daily default unless update is the only explicit task [@automation-selection] [@automation-jobs].

The job factory writes logs under `~/.codealmanac/logs`, uses the Python executable with `-m codealmanac.cli.main`, schedules `sync` without a working directory, schedules machine-level garden through `__garden-scheduler`, and schedules `update --scheduled` without a working directory [@automation-jobs].

Scheduled `update` is owned by `UpdatesService`, not by sync or Garden [@updates-service]. It acquires a global update lock, skips if queued or running lifecycle jobs exist, skips editable/source installs, supports uv-tool and pip installs, and runs `codealmanac --version` plus `codealmanac doctor --json` after a successful scheduled package update [@updates-service] [@updates-lock] [@updates-activity].

Automation is local. It schedules local `sync`, `garden`, and `update`; it does not install hosted capture, upload, login, or cloud polling.
