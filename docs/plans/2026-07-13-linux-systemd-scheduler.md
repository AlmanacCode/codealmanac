# Linux systemd scheduler

Add Linux support to scheduled automation by implementing a systemd `--user`
timer scheduler adapter and selecting the scheduler adapter by platform.
Today `setup` and `automation` only work on macOS because the composition root
hardcodes `LaunchdSchedulerAdapter` and the domain model leaks launchd
vocabulary (`plist_path`).

## Scope

- A `SystemdSchedulerAdapter` under `integrations/automation/scheduler/`
  implementing the existing `SchedulerAdapter` port with `systemctl --user`
  timers.
- A `default_scheduler_adapter()` factory that returns the systemd adapter on
  Linux and the launchd adapter elsewhere, wired into `app.py`. The
  `adapters.scheduler` injection path is unchanged.
- De-launchd the automation domain model: `plist_path` becomes
  `manifest_path`, `plist_path_for` becomes `manifest_path_for` and computes
  the platform-correct manifest location. `launch_path` stops leaking
  macOS-only PATH fallbacks onto Linux.
- Render and docs updates: provider-neutral `automation status` labels,
  README support claim, and the stale "macOS-specific" line in the almanac
  automation page.

## Out of scope

- Windows support (no scheduler adapter, unchanged behavior).
- cron support (rejected alternative, below).
- Non-systemd Linux init systems. `systemctl --user` failures surface the
  same way a missing `launchctl` does on macOS: as command errors, not
  crashes.
- Any change to what the scheduled jobs run or when they run by default.

## Design

### Platform-selecting factory

`integrations/automation/scheduler/__init__.py` gains:

```python
def default_scheduler_adapter() -> SchedulerAdapter:
    if sys.platform.startswith("linux"):
        return SystemdSchedulerAdapter()
    return LaunchdSchedulerAdapter()
```

`create_services` in `app.py` uses it instead of the hardcoded
`LaunchdSchedulerAdapter()`. Integrations already implement service-owned
ports, so the platform branch lives in the integration layer, not in the
service. Non-Linux, non-Darwin platforms keep the launchd adapter and fail
the same way they do today (missing `launchctl` binary), which keeps the
factory honest without inventing an unsupported-platform error path.

### `plist_path` becomes `manifest_path`

`ScheduledJob`, `ScheduledJobStatus`, and `AutomationTaskApplyResult` rename
`plist_path` to `manifest_path`. `jobs.plist_path_for` becomes
`manifest_path_for(task, home, platform=None)`:

- macOS: `~/Library/LaunchAgents/{label}.plist` (unchanged).
- Linux: `~/.config/systemd/user/{label}.timer`. The `.timer` unit is the
  primary manifest; the systemd adapter derives the sibling `.service` path
  from it.

**Deliberate output change:** `automation status --json` (and the setup /
config JSON payloads that embed apply results) now emit `manifest_path`
instead of `plist_path`, and the human status output says `manifest:` and
`scheduler loaded:` instead of `plist:` and `launchd loaded:`. This is a
pre-1.0 contract fix, not an accident: a provider-specific field name in the
scheduler-neutral service model was a leak (the repo's honest-modules rule),
and it becomes actively wrong the moment a second scheduler exists. Callers
of the JSON contract must rename one key.

`launch_path` keeps the macOS PATH byte-identical and selects Linux
fallbacks (`/usr/local/bin`, `/usr/bin`, `/bin`, `/usr/sbin`, `/sbin`) on
Linux. `LAUNCHD_FALLBACK_PATHS` is renamed to platform-named constants in
`defaults.py`. The home-relative additions (`~/.local/bin`, `~/.bun/bin`)
apply on both platforms.

The `platform` parameter defaults to `sys.platform` so production callers
never pass it; tests pin `"darwin"` and `"linux"` explicitly to cover both
mappings on any CI host.

### `SystemdSchedulerAdapter`

Mirrors the launchd adapter's shape (install/uninstall/status plus module
helper functions) with one improvement: the `systemctl` invocation goes
through an injectable command runner (`run_command` constructor argument
defaulting to a subprocess-backed function). The launchd adapter shells out
directly, which forces tests to monkeypatch `subprocess.run`; the new
adapter should not repeat that. The runner keeps the launchd adapter's
graceful `OSError` handling: a missing `systemctl` binary becomes a failed
`CompletedProcess`, not a crash.

- `install(job)`: write `{label}.service` and `{label}.timer` under
  `~/.config/systemd/user/`, create log directories, then `daemon-reload`,
  `enable {label}.timer` (boot persistence), `restart {label}.timer`
  (activate now and re-trigger on reinstall, mirroring launchd's
  bootout/bootstrap cycle), and return `status(job)`.
- `uninstall(job)`: `disable --now {label}.timer`, `stop {label}.service`
  (parity with launchd `bootout` terminating a running job), remove both
  unit files, `daemon-reload`, then `reset-failed` for both units.
  The `reset-failed` matters: stopping the timer can fire one last trigger
  that the service stop then TERM-kills, which would otherwise leave a
  residual `not-found failed` unit in the user manager (observed during the
  real smoke test). Unit-not-found results are tolerated; other `systemctl`
  failures raise `ExecutionFailed` before any file is removed, matching the
  launchd adapter. Returns true when a unit file existed or the timer was
  actually disabled.
- `status(job)`: `installed` = timer file exists; parse
  `systemctl --user show` properties — timer `LoadState` (loaded),
  service `ActiveState` (state), `ExecMainStatus`/`ExecMainExitTimestampMonotonic`
  (last exit code, only once the service has actually exited), `MainPID`.
  The interval is read back from the timer file's `OnUnitActiveSec=` line,
  matching how the launchd adapter reads `StartInterval` from the plist.

Unit file shape:

```ini
# {label}.service
[Unit]
Description=CodeAlmanac {task} automation

[Service]
Type=oneshot
ExecStart=/path/to/codealmanac sync
Environment="PATH=..."
StandardOutput=append:~/.codealmanac/logs/sync.out.log
StandardError=append:~/.codealmanac/logs/sync.err.log

# {label}.timer
[Unit]
Description=CodeAlmanac {task} automation timer

[Timer]
OnActiveSec=0
OnUnitActiveSec={interval seconds}
Unit={label}.service

[Install]
WantedBy=timers.target
```

`ExecStart` and `Environment` values are quoted and `%`-escaped per
systemd's unit-file syntax so paths with spaces survive.

**RunAtLoad parity:** launchd runs the job at load (`RunAtLoad=True`) and
then every `StartInterval`. The systemd equivalent chosen here is
`OnActiveSec=0` + `OnUnitActiveSec={interval}`: the timer fires immediately
when activated (install, login, boot) and then keeps an interval cadence
from each run. `OnBootSec` would be redundant with `OnActiveSec=0`.
`Persistent=true` is deliberately omitted: per systemd.timer(5) it only
affects `OnCalendar=` timers, so writing it into a monotonic timer would be
inert configuration — the kind of decorative setting the honest-modules rule
exists to keep out.

**run_count stays `None` on Linux:** systemd does not track a trigger count
(`NRestarts` counts `Restart=` restarts, which is always 0 for a oneshot and
would misreport "runs: 0" forever). Reporting nothing is more honest than
reporting a wrong number. macOS keeps launchd's `runs` value.

### Rejected alternative: cron

Cron is more portable but strictly worse for this job shape: no per-job
environment blocks without shell wrapping, no native append-to-log-file
redirection (needs shell), no run-at-install semantics, no status/last-exit
introspection (the `status` verb would have to parse log files), and
crontab editing is a single shared file rather than per-job manifests. The
systemd user manager is present on every mainstream Linux distribution this
project can realistically claim support for, and its unit files map
one-to-one onto the existing `ScheduledJob` model.

## File changes

- `services/automation/models.py` — `plist_path` → `manifest_path` (3 models).
- `services/automation/jobs.py` — `manifest_path_for`, per-platform
  `launch_path` fallbacks.
- `services/automation/defaults.py` — platform-named PATH fallback constants.
- `services/automation/service.py`, `services/automation/ports.py` — field
  rename, docstring.
- `integrations/automation/scheduler/systemd.py` — new adapter.
- `integrations/automation/scheduler/__init__.py`,
  `integrations/automation/__init__.py` — exports + factory.
- `app.py` — use `default_scheduler_adapter()`.
- `cli/render/automation.py` — `manifest:` / `scheduler loaded:` labels.
- `tests/test_automation_service.py` — rename, platform-pinned
  `manifest_path_for` tests, systemd adapter tests (fake runner).
- `tests/test_cli.py`, `tests/test_config_service.py`,
  `tests/test_setup_service.py`, `tests/test_architecture.py` — rename and
  fragment-list updates.
- `README.md`, `almanac/architecture/setup/automation-and-update.md` — Linux
  support claim, generalized wording.

## Test plan

- Unit: `manifest_path_for` on `darwin` and `linux`; `launch_path` fallback
  selection per platform (macOS string byte-identical to today's).
- Unit: systemd unit-file rendering (ExecStart quoting, PATH environment,
  log redirection, timer interval), install command sequence
  (`daemon-reload` then `enable --now`), uninstall semantics (present /
  not-found / real failure preserves files), `status` parsing from fake
  `systemctl show` output including never-run and mid-run shapes,
  `default_scheduler_adapter` platform selection.
- Existing suite: all launchd, service, CLI, config, setup tests updated for
  the rename must pass unchanged in behavior.
- Real smoke on a Linux host with a running user manager: install a job with
  a harmless command and long interval into the real
  `~/.config/systemd/user`, verify `list-timers`/`is-enabled`, `status()`
  fields, then uninstall and verify nothing is left.
- Gates: `uv run pytest`, `uv run ruff check .`, `uv build`.

## Read before coding

- `src/codealmanac/integrations/automation/scheduler/launchd.py` — the shape
  to mirror, including `ExecutionFailed` and not-found tolerance.
- `src/codealmanac/services/automation/jobs.py` — job construction and PATH
  assembly.
- `tests/test_automation_service.py` — fake scheduler style and launchd
  adapter test conventions.
- `tests/test_architecture.py`
  (`test_automation_service_keeps_selection_and_job_construction_boundaries`)
  — fragment lists that pin the service/jobs split.
- `docs/reference/cosmic-python/chapter_13_dependency_injection.md` — the
  book's "_Composition Root_ (a bootstrap script to you and me)" with
  "manual DI" is why the platform switch is a default the composition root
  consumes (`app.py` calling `default_scheduler_adapter()`), not a branch
  inside `AutomationService`.

## Correctness notes

Two platform-specific correctness details, each covered by a regression test.

- **Honor `XDG_CONFIG_HOME` for user units** — `manifest_path_for` hard-coded
  `~/.config/systemd/user`. When a Linux user sets `XDG_CONFIG_HOME`, systemd
  searches `$XDG_CONFIG_HOME/systemd/user`, so units were written outside the
  manager's search path and `enable` failed. `systemd_user_dir` now derives the
  directory from an absolute `XDG_CONFIG_HOME` when present, falling back to
  `~/.config/systemd/user` (a relative value is invalid per the XDG spec and is
  ignored).
- **Gate `is_loaded` on `ActiveState`, not just `LoadState`** — a stopped,
  disabled, or failed timer still reports `LoadState=loaded` because systemd can
  parse its unit file, so `automation status` printed `scheduler loaded: yes`
  for a timer that schedules nothing. `is_loaded` now also requires
  `ActiveState` to be `active`/`activating`.
