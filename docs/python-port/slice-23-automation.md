# Slice 23 - Local Automation

## Scope

Add the first Python automation surface:

```text
codealmanac automation install [sync|garden...]
codealmanac automation status [sync|garden...]
codealmanac automation uninstall [sync|garden...]
```

This slice installs local launchd jobs for foreground `sync` and `garden`.
It does not add a background worker, pending sync reconciliation, legacy
capture migration, or scheduled update checks.

## Design

Automation is a service, not a workflow. It decides which local recurring tasks
should exist and how their commands should be shaped. It does not decide sync
eligibility, Garden behavior, run lifecycle, transcript parsing, or wiki writes.

```python
result = app.automation.install(InstallAutomationRequest(...))
report = app.automation.status(AutomationStatusRequest(...))
removed = app.automation.uninstall(UninstallAutomationRequest(...))
```

The scheduler is a port owned by `services/automation/ports.py`. The launchd
implementation lives under `integrations/automation/scheduler/launchd.py` and
translates `ScheduledJob` models into launchd plist files.

Cosmic Python chapter 13 shaped this slice: `app.py` is the composition root
that wires `AutomationService` to the concrete launchd adapter. CLI and tests
call the service boundary, and tests inject a fake scheduler instead of
monkeypatching launchctl behavior.

The adapter uses Python's stdlib `plistlib` for property-list serialization.
The archived TypeScript code hand-rendered XML; the Python rewrite should use
the structured plist API instead of rebuilding an XML serializer.

## Behavior

Default install selects `sync` and `garden`.

`sync` is machine-global:

```text
python -m codealmanac.cli.main sync --quiet 45m
```

It has no working directory because sync discovers quiet transcript stores and
maps them back to repos.

`garden` is repo-scoped:

```text
python -m codealmanac.cli.main garden
```

Installing Garden resolves the current workspace and writes that repo root as
launchd `WorkingDirectory`. `automation status` and `automation uninstall` do
not require a repo because they only inspect or remove plist state.

Task selection mirrors the old command feel but narrows valid v1 tasks to
`sync` and `garden`. `update` is not schedulable until the Python `update`
command exists.

## Tests

- `tests/test_automation_service.py` covers task planning, Garden workspace
  resolution, sync-only install outside a repo, `--garden-off`, validation, and
  launchd plist serialization.
- `tests/test_cli.py::test_cli_automation_install_status_and_uninstall` covers
  public command parsing and rendering with a fake scheduler.
- `tests/test_architecture.py` keeps services/workflows/CLI from importing
  integrations.

## Deferred

Background scheduled sync still uses the foreground `sync` command. Before
introducing pending cursor state, add a durable background owner and a
reconciliation loop over run records.

Scheduled update checks remain blocked on the Python `codealmanac update`
command and packaging policy.
