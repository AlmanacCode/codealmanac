# Linux support — Option A: graceful automation skip on non-macOS

## Problem

Every lifecycle and read command already runs on Linux — `init`, `ingest`,
`garden`, `search`, indexing, the harness, telemetry are all platform-neutral
Python. The single blocker is **scheduled automation**. `create_app` wires
`AutomationService` with `LaunchdSchedulerAdapter`, which shells out to
`launchctl`. On Linux `launchctl` does not exist, so:

- `codealmanac setup --yes` crashes with
  `launchctl bootstrap failed for com.codealmanac.sync: [Errno 2] ... 'launchctl'`
  and exits 1 (issue #31).
- `config set automation.*` hits the same path (both routes run
  `AutomationService.reconcile_task` → `scheduler.install`).
- `config.toml` is written *before* the scheduler runs, so the crash leaves a
  half-configured global state.

This is **not** a rewrite. The `SchedulerAdapter` port already exists
(`services/automation/ports.py`, 3 methods) and `create_app` already accepts a
`scheduler` override. Launchd is just one implementation of that port.

## Scope (Option A)

Make the whole product usable on Linux **today** by degrading scheduled
automation gracefully instead of crashing. Scheduled background runs are not
provided on Linux in this slice; the user runs `codealmanac sync` / `garden`
manually (or wires their own cron). Real Linux scheduling (systemd user timers)
is **Option B**, a separate slice.

### In scope

1. Platform capability predicate in `core/` — single source of truth.
2. `UnsupportedSchedulerAdapter` implementing the existing port as a no-op.
3. Composition root selects the adapter by platform (launchd on macOS,
   unsupported elsewhere). Only branch point for the platform fact in wiring.
4. Setup and automation-status render tell the user clearly, on non-macOS, that
   scheduled automation is unavailable — and stop claiming schedules are
   "installed"/"automatic" when nothing was scheduled.
5. Suppress the macOS-only "Background Items Added" heads-up off-macOS.

### Out of scope

- systemd / cron backends (Option B).
- Renaming `plist_path` / `Library/LaunchAgents` in the shared model (Option B
  cleanup — the null adapter never touches those paths, so it can wait).
- Forcing `automation.*.enabled = false` in config on Linux. We keep config as
  recorded intent so Option B activates it later without a re-run. Render, not
  config, is where we tell the truth about what actually got scheduled.
- README / docs edits (fold into the commit if trivial; not gated here).

## Design

### Single platform predicate

New `src/codealmanac/core/platform.py`:

```python
import sys

def scheduler_supported() -> bool:
    """True when this platform has a scheduler backend CodeAlmanac can drive.

    Today the only backend is macOS launchd. Option B (systemd user timers)
    will widen this. Consulted at the composition root (adapter selection) and
    in render (what to tell the user about scheduling).
    """
    return sys.platform == "darwin"
```

One predicate, two honest consult sites (wiring + render). This is dependency
injection + presentation, not a scattered special-case: there is exactly one
definition of "can we schedule here".

### Null adapter

New `src/codealmanac/integrations/automation/scheduler/unsupported.py`:

```python
class UnsupportedSchedulerAdapter:
    def install(self, job): return _not_installed(job)
    def uninstall(self, job): return False
    def status(self, job): return _not_installed(job)
```

`_not_installed` returns `ScheduledJobStatus(installed=False, loaded=False)`.
No filesystem writes, no `Library/LaunchAgents` dirs, no subprocess. Because
`install()` no longer raises, `setup` completes and exits 0 — which also
**removes the half-configured-state bug on Linux** (nothing fails, so nothing
is left partial). `reconcile_task` already ignores the `install()` return value.

Export it from `integrations/automation/scheduler/__init__.py` and
`integrations/automation/__init__.py`.

### Composition root selects the adapter

`app.py`:

```python
def default_scheduler_adapter() -> SchedulerAdapter:
    if scheduler_supported():
        return LaunchdSchedulerAdapter()
    return UnsupportedSchedulerAdapter()
```

`create_services` uses `adapters.scheduler or default_scheduler_adapter()`.
Tests that inject a fake scheduler are unaffected (override still wins). Cosmic
Python ch.13: platform wiring belongs at the composition root, not in services.

### Honest render — reflect the outcome, not the platform

The setup step-builders derive "installed"/"automatic" from
`result.config_update.automation[].enabled` — config *intent*, which on Linux is
`true` while nothing is actually scheduled.

**Design correction (found during review/tests):** render must NOT re-derive
`sys.platform`. Terminal output describes *what actually happened*, and the
scheduler adapter — not the OS check — is the authority on whether a job was
activated. Re-checking the platform in render also broke tests that inject a
working fake scheduler to exercise macOS output on a Linux host. So the seam is
data, not platform:

- `AutomationTaskApplyResult` gains a `scheduled: bool` field. `reconcile_task`
  sets it from the adapter's real result: `scheduler.install(job).installed`.
  The launchd adapter returns `installed=True`; the unsupported adapter returns
  `installed=False`. It diverges from `enabled` exactly when the platform can't
  schedule.
- `render/setup/result.py` reads `item.scheduled`: an `enabled and not
  scheduled` task renders "manual — scheduling unavailable on this platform";
  wiki-maintenance and the "Background Items" confirmation are driven by the
  *scheduled* set. When any task is `enabled and not scheduled`, a single
  "Scheduled automation unavailable" note is rendered.
- `render/setup/background_items.py` keeps its original `len(tasks) == 0` guards
  (no platform check). The unavailable-notice builder is unconditional; the
  caller decides when to show it from result data. `platform_label()` is used
  only for the cosmetic OS name in the message text.
- `render/automation.py` is unchanged: it already prints "not installed" per
  task from the real adapter status, which is accurate on every platform.

Platform detection lives in exactly one place: the composition root
(`default_scheduler_adapter`). Render stays platform-free.

macOS path: launchd `install().installed` is `True` → `scheduled=True` → every
existing branch is taken unchanged → **terminal output byte-for-byte identical
on macOS** (non-negotiable per CLAUDE.md "Terminal output is behavior").

`--json` gains the additive `scheduled` field on the apply result; no existing
test asserts that structure, and it does not alter prose output.

## File changes

| File | Change |
|------|--------|
| `core/platform.py` | **new** — `scheduler_supported()` |
| `integrations/automation/scheduler/unsupported.py` | **new** — `UnsupportedSchedulerAdapter` |
| `integrations/automation/scheduler/__init__.py` | export new adapter |
| `integrations/automation/__init__.py` | export new adapter |
| `app.py` | `default_scheduler_adapter()`; use it in `create_services` |
| `services/automation/models.py` | add `scheduled: bool` to `AutomationTaskApplyResult` |
| `services/automation/service.py` | set `scheduled` from `install().installed` |
| `cli/render/setup/result.py` | steps + unavailable note driven by `scheduled` |
| `cli/render/setup/background_items.py` | unconditional unavailable-notice builder |
| `README.md` | supported-platforms + automation notes reflect Linux |

## Test coverage

New tests must sandbox `HOME` (repo convention) and force the platform rather
than depend on the host, so the suite behaves identically on macOS and Linux
CI. Patch `codealmanac.core.platform.scheduler_supported` (and its re-import
sites) via `monkeypatch`.

- **`UnsupportedSchedulerAdapter`**: `install`/`status` return not-installed,
  `uninstall` returns `False`, no filesystem side effects (no `Library/`
  created under a temp home).
- **`create_app` selection**: with `scheduler_supported` patched `False`, a real
  `create_app()` (no scheduler override) runs `config.update` /
  `setup.run(--yes)` end-to-end **without raising** and exits 0; `config.toml`
  is written.
- **No launchctl on the unsupported path**: assert the subprocess/`launchctl`
  entrypoint is never reached (e.g. monkeypatch `subprocess.run` to fail the
  test if called, or assert via the fake).
- **Render**: with support forced off, setup text shows the "unavailable" note
  and no "Background Items" notice; with support on, existing macOS output is
  byte-for-byte unchanged (snapshot/substring on both branches).
- Existing `test_automation_service.py` / `test_setup_service.py` continue to
  pass unchanged (they inject fakes / run on the real adapter via override).

Gates: `uv run pytest` and `uv run ruff check .`.

## Review focus (must-fix / should-fix / consider)

- **must-fix**: macOS output unchanged; no launchctl invocation on non-macOS;
  `setup --yes` exit 0 on Linux; no partial state on the unsupported path.
- **should-fix**: render no longer claims schedules are "automatic"/"installed"
  on Linux; platform predicate has exactly one definition.
- **consider**: whether `automation status` should say "unavailable on this
  platform" vs. plain "not installed" (chosen: add the note — clarity).
