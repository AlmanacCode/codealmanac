---
title: Setup Automation And Update
topics: [architecture, setup, automation]
sources:
  - id: app
    type: file
    path: src/codealmanac/app.py
    note: Composition root wiring for the default scheduler and setup services.
  - id: setup_service
    type: file
    path: src/codealmanac/services/setup/service.py
    note: Setup and uninstall orchestration.
  - id: setup_requests
    type: file
    path: src/codealmanac/services/setup/requests.py
    note: Setup request fields, defaults, and validation.
  - id: setup_automation
    type: file
    path: src/codealmanac/services/setup/automation.py
    note: Setup-side automation task selection.
  - id: automation_service
    type: file
    path: src/codealmanac/services/automation/service.py
    note: Automation reconciliation, full removal, and status service.
  - id: automation_jobs
    type: file
    path: src/codealmanac/services/automation/jobs.py
    note: Scheduled job construction for sync, Garden, and update.
  - id: launchd
    type: file
    path: src/codealmanac/integrations/automation/scheduler/launchd.py
    note: macOS launchd scheduler adapter.
  - id: updates
    type: file
    path: src/codealmanac/services/updates/service.py
    note: Manual and scheduled package update behavior.
  - id: update_lock
    type: file
    path: src/codealmanac/services/updates/lock.py
    note: PID-file update lock implementation.
  - id: update_metadata
    type: file
    path: src/codealmanac/integrations/updates/package.py
    note: Installed package metadata and direct_url.json parsing.
  - id: update_tests
    type: file
    path: tests/test_update_service.py
    note: Tests for update planning, skip rules, locks, and smoke checks.
  - id: filelock_review
    type: conversation
    path: "/Users/divitsheth/.codex/sessions/2026/07/12/rollout-2026-07-12T18-18-36-019f590d-fa0d-75d3-811f-0044dc0a138f.jsonl"
    note: Review discussion of a FileLock-based update-lock replacement.
  - id: live_agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Active setup, uninstall, automation, and scheduled update decisions.
---

# Setup Automation And Update

Setup, automation, and update form CodeAlmanac's machine-level maintenance layer. `setup` installs local agent instructions and writes one user configuration update. The config service then makes launchd match that saved automation policy. `automation` owns recurring launchd jobs, while `update` owns package-manager upgrades for the installed CLI [@setup_service][@automation_service][@updates].

The area matters because it is local-only product infrastructure. Scheduled work runs local CodeAlmanac task entrypoints for sync, Garden, and update; it does not connect to a hosted service or perform cloud capture [@live_agreement]. Runtime state and scheduler logs belong under the user's machine state, while repository wiki source remains under `almanac/` [@live_agreement].

## Setup Boundary

`SetupService.run` builds one complete `UserConfig`, asks the config service to write it, and receives scheduler reconciliation results from that same update. It also installs instruction targets unless skipped and reports runner readiness [@setup_service]. Setup does not construct a separate automation-install command. Instruction installation is a separate concern with its own per-target mechanics; see [Instruction installation](instruction-installation).

The request model defaults to both instruction targets, Codex as the harness, auto-commit enabled, and all three automation tasks enabled. It accepts setup-time interval and disable controls and validates positive durations [@setup_requests].

Setup's automation policy lives outside the service. The default tasks are sync, Garden, and update. `selected_setup_tasks` reflects the three enable/disable choices, which are persisted in TOML before scheduler reconciliation [@setup_automation].

## Scheduled Jobs

`AutomationService` reconciles one task, removes all tasks during full uninstall, and reports status through a `SchedulerAdapter` port [@automation_service]. Reconciliation installs a job when enabled and uninstalls it when disabled. `AutomationJobFactory` turns saved task policy into a `ScheduledJob` [@automation_service][@automation_jobs].

The job factory gives each task concrete local execution details. The resolved `codealmanac` executable runs `sync`, `update --scheduled`, or `__garden-scheduler` [@automation_jobs]. Intervals come from saved user configuration; defaults are 5 hours, 4 hours, and 24 hours [@automation_jobs].

The macOS implementation writes launchd plists under `~/Library/LaunchAgents`, creates stdout and stderr log directories, bootouts any existing job, bootstraps the new job, and reads status back from launchd [@launchd]. The generated plist contains the label, program arguments, start interval, environment variables, `RunAtLoad`, and log paths [@launchd]. This keeps the service boundary scheduler-neutral while the adapter owns launchd mechanics.

The default application wiring is launchd-backed. `create_services` constructs `AutomationService` with `LaunchdSchedulerAdapter`, then injects it into the config service. The adapter shells out to `launchctl` for install, uninstall, and status checks [@app][@launchd]. Config reconciliation is macOS-specific until another scheduler adapter is wired. There is no platform-selection branch in the composition root, so setup on a machine without `launchctl` reaches the launchd adapter and surfaces a scheduler execution failure instead of selecting a Linux or Windows scheduler [@app][@launchd].

## Update Safety

Manual update and scheduled update share the same planning logic. `plan_update` refuses editable installs, maps uv installs to `uv tool upgrade codealmanac`, maps pip installs to `python -m pip install --upgrade codealmanac`, and refuses unknown installers with a suggested manual command [@updates].

Scheduled update adds safety checks before running the package command. It skips if the install is not ready, if an update lock is already held, or if the local database shows active CodeAlmanac jobs [@updates]. After a successful scheduled package update, it runs two smoke checks: `codealmanac --version` and `codealmanac doctor --json` [@updates]. Tests cover the uv and pip plans, editable-install refusal, active-job skip, held-lock skip, smoke success, and smoke failure paths [@update_tests].

The current update lock is a PID-file lease. `UpdateLockStore.acquire` writes a JSON record with the current PID and timestamp using exclusive file creation, treats old records as stale, unlinks stale files, then tries once more [@update_lock]. Because the replacement of a stale file is not an OS-backed lock held for the full update, future changes to update concurrency should prefer a real process lock and prove that a second process cannot enter while the first still owns the update [@update_lock][@update_tests].

If the lock is replaced with FileLock or another file-locking library, the release path should let the library own the lock file instead of deleting it after release. The reviewed FileLock replacement showed why: a process can acquire after the release call and before the manual deletion, then another process can create a new lock file while the acquired process still holds the old file descriptor [@filelock_review]. Tests for that shape should assert that another process can acquire after release, not that the lock file disappears; once timestamp staleness is gone, `now`, `stale_after`, and `lock_stale_after` should be removed from the update path instead of kept as unused request plumbing [@filelock_review][@setup_requests].

The editable-install guard does not cover every PEP 610 direct-url install. The metadata reader records `source_url` from `direct_url.json`, but `update_method` only uses the `editable` flag before falling through to the installer-based uv or pip plan [@update_metadata][@updates]. A non-editable local path, VCS, or direct archive install with `INSTALLER` set to `uv` or `pip` can therefore still be upgraded through the normal package command.

This shape matches the active agreement: scheduled auto-update is an explicit local automation task, not a sync or Garden side effect. The agreement also states that scheduled update should skip editable installs, skip active lifecycle jobs, use a global lock, support uv tool and pip installs, and run the same two smoke checks [@live_agreement].

## Uninstall

`SetupService.uninstall` removes setup-owned instructions, uninstalls automation through the automation service, removes global CodeAlmanac state, and asks the package uninstaller to remove the installed binary when supported [@setup_service]. The live agreement says uninstall is full uninstall and should not expose partial flags such as keeping automation or instructions; it also says uninstall never deletes a repository's `almanac/` tree [@live_agreement].

The consequence is a clear ownership line. Machine-level setup can be removed, but repo-owned wiki source stays with the repository. That line supports [Only Almanac Root](../../decisions/only-almanac-root), [SQLite store boundaries](../persistence/sqlite-store-boundaries), and the local-only product decision.
