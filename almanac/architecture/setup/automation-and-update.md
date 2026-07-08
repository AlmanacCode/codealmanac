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
    note: Automation install, uninstall, and status service.
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
  - id: update_metadata
    type: file
    path: src/codealmanac/integrations/updates/package.py
    note: Installed package metadata and direct_url.json parsing.
  - id: update_tests
    type: file
    path: tests/test_update_service.py
    note: Tests for update planning, skip rules, locks, and smoke checks.
  - id: live_agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Active setup, uninstall, automation, and scheduled update decisions.
---

# Setup Automation And Update

Setup, automation, and update form CodeAlmanac's machine-level maintenance layer. `setup` installs local agent instructions, writes user configuration, optionally installs scheduled local automation, and reports runner readiness. `automation` owns recurring launchd jobs. `update` owns package-manager upgrades for the installed CLI. These responsibilities are deliberately split so setup can compose the machine state without containing scheduler or updater details [@setup_service][@automation_service][@updates].

The area matters because it is local-only product infrastructure. Scheduled work runs local `sync`, Garden, and `update` commands; it does not connect to a hosted service or perform cloud capture [@live_agreement]. Runtime state and scheduler logs belong under the user's machine state, while repository wiki source remains under `almanac/` [@live_agreement].

## Setup Boundary

`SetupService.run` is the entrypoint for machine setup. It sets configuration, installs instruction targets unless skipped, installs automation when the selected setup tasks are non-empty, and returns a `SetupResult` containing the plan, config updates, instruction changes, automation result, and runner readiness [@setup_service].

The request model makes the defaults explicit. `RunSetupRequest` defaults to both Codex and Claude instruction targets, Codex as the default harness, `auto_commit = True`, and `auto_update = True` [@setup_requests]. It also accepts automation controls such as `sync_every`, `sync_off`, `garden_every`, `garden_off`, and `automation_tasks`, while validating that targets are non-empty, tasks are unique, the model string is present, and durations are not negative [@setup_requests].

Setup's automation policy lives outside the service. The default setup automation tasks are sync, Garden, and update. `selected_setup_tasks` removes sync when `sync_off` is set, removes Garden when `garden_off` is set, and removes update when `auto_update` is false [@setup_automation]. This keeps setup orchestration small and leaves task-selection rules in the setup automation helper.

## Scheduled Jobs

`AutomationService` installs, uninstalls, and reports status for scheduled tasks through a `SchedulerAdapter` port [@automation_service]. It asks `AutomationJobFactory` to turn selected tasks into `ScheduledJob` objects, then passes each job to the adapter [@automation_service][@automation_jobs].

The job factory gives each task concrete local execution details. Sync runs `python -m codealmanac.cli.main sync`, update runs `python -m codealmanac.cli.main update --scheduled`, and Garden runs `python -m codealmanac.cli.main __garden-scheduler` [@automation_jobs]. Job intervals come from task-specific defaults unless the request overrides them; update uses the daily update interval except when update is the only explicit task and `--every` was provided [@automation_jobs].

The macOS implementation writes launchd plists under `~/Library/LaunchAgents`, creates stdout and stderr log directories, bootouts any existing job, bootstraps the new job, and reads status back from launchd [@launchd]. The generated plist contains the label, program arguments, start interval, environment variables, `RunAtLoad`, and log paths [@launchd]. This keeps the service boundary scheduler-neutral while the adapter owns launchd mechanics.

The default application wiring is currently launchd-backed. `create_services` constructs `AutomationService` with `LaunchdSchedulerAdapter` when no scheduler adapter is injected, and the adapter shells out to `launchctl` for install, uninstall, and status checks [@app][@launchd]. That means the production setup and automation path is macOS-specific until another scheduler adapter is added and wired.

## Update Safety

Manual update and scheduled update share the same planning logic. `plan_update` refuses editable installs, maps uv installs to `uv tool upgrade codealmanac`, maps pip installs to `python -m pip install --upgrade codealmanac`, and refuses unknown installers with a suggested manual command [@updates].

Scheduled update adds safety checks before running the package command. It skips if the install is not ready, if an update lock is already held, or if the local database shows active CodeAlmanac jobs [@updates]. After a successful scheduled package update, it runs two smoke checks: `codealmanac --version` and `codealmanac doctor --json` [@updates]. Tests cover the uv and pip plans, editable-install refusal, active-job skip, held-lock skip, smoke success, and smoke failure paths [@update_tests].

The editable-install guard does not cover every PEP 610 direct-url install. The metadata reader records `source_url` from `direct_url.json`, but `update_method` only uses the `editable` flag before falling through to the installer-based uv or pip plan [@update_metadata][@updates]. A non-editable local path, VCS, or direct archive install with `INSTALLER` set to `uv` or `pip` can therefore still be upgraded through the normal package command.

This shape matches the active agreement: scheduled auto-update is an explicit local automation task, not a sync or Garden side effect. The agreement also states that scheduled update should skip editable installs, skip active lifecycle jobs, use a global lock, support uv tool and pip installs, and run the same two smoke checks [@live_agreement].

## Uninstall

`SetupService.uninstall` removes setup-owned instructions, uninstalls automation through the automation service, removes global CodeAlmanac state, and asks the package uninstaller to remove the installed binary when supported [@setup_service]. The live agreement says uninstall is full uninstall and should not expose partial flags such as keeping automation or instructions; it also says uninstall never deletes a repository's `almanac/` tree [@live_agreement].

The consequence is a clear ownership line. Machine-level setup can be removed, but repo-owned wiki source stays with the repository. That line supports [Only Almanac Root](../../decisions/only-almanac-root), [SQLite store boundaries](../persistence/sqlite-store-boundaries), and the local-only product decision.
