---
title: Automation
summary: Automation is the platform scheduler layer that wakes `almanac capture sweep` and `almanac garden`, while capture eligibility and dedupe stay inside Almanac-owned state.
topics: [automation, cli, flows]
files:
  - src/commands/automation.ts
  - src/commands/automation/windows.ts
  - src/install/ephemeral.ts
  - src/commands/setup.ts
  - src/commands/uninstall.ts
  - src/cli.ts
  - src/cli/register-setup-commands.ts
  - src/cli/register-wiki-lifecycle-commands.ts
  - .github/workflows/ci.yml
  - src/commands/capture-sweep.ts
  - src/update/config.ts
  - test/automation.test.ts
  - test/codex-harness-provider.test.ts
  - test/cli.test.ts
  - test/uninstall.test.ts
sources:
  - docs/plans/2026-05-11-scheduled-quiet-session-capture.md
  - docs/plans/2026-05-14-windows-support.md
status: active
verified: 2026-05-14
---

# Automation

Automation is the scheduler layer around Almanac's recurring maintenance work. The current implementation has two platform adapters: macOS writes launchd jobs, and Windows writes Task Scheduler tasks through `schtasks`. In both cases one scheduler entry wakes `almanac capture sweep`, and the other wakes `almanac garden`. The scheduler decides when Almanac starts. Almanac still decides what to capture, whether a wiki needs gardening, and how job state is recorded.

## Public command surface

`almanac automation install|status|uninstall` is the explicit scheduler-management surface. On macOS, `install` writes launchd plists, bootstraps them with `launchctl`, and prints the effective capture interval, quiet window, activation timestamp, commands, and plist paths. On Windows, `install` calls `schtasks /Create` and writes local manifests under `~/.almanac/automation/` so status and doctor can report the installed task names without shelling out. `status` reads the platform-owned record, and `uninstall` removes the scheduled capture and Garden entries for the active platform.

`almanac setup` is the onboarding entry point for the same automation surface. Setup installs scheduled capture and scheduled Garden by default unless the user passes `--skip-automation` or `--garden-off`. That makes automation a first-run product behavior rather than a hidden expert-only command.

## Launchd contract

The capture plist path is `~/Library/LaunchAgents/com.codealmanac.capture-sweep.plist`. The Garden plist path is `~/Library/LaunchAgents/com.codealmanac.garden.plist`. Both plists write stdout and stderr logs under `~/.almanac/logs/`.

The capture job runs `almanac capture sweep` with a quiet-window argument. The default schedule is every `5h`, and the default quiet window is `45m`. The Garden job runs `almanac garden` every `2d` by default.

Both jobs get an explicit `PATH` assembled for launchd from the current environment plus fallback locations such as `/usr/local/bin`, `/opt/homebrew/bin`, and `/usr/bin`. The Garden plist also records a `WorkingDirectory`: `runAutomationInstall()` resolves it to the nearest repo containing `.almanac/`, falling back to the current directory when no wiki root is found.

There are two command-path modes. Direct `almanac automation install` writes absolute `ProgramArguments` for the current Node executable and resolved `dist/codealmanac.js` entrypoint. Setup uses a stricter rule when it was launched from ephemeral `npx`: it installs automation only after a durable global install succeeds, then writes `/usr/bin/env almanac ...` commands instead of pinning launchd to the transient cache path.

## Windows Task Scheduler contract

On Windows, capture uses the task name `\CodeAlmanac\CaptureSweep`, and Garden uses `\CodeAlmanac\Garden`. `runAutomationInstall({ platform: "win32" })` maps minute-sized intervals to `schtasks /Create /SC MINUTE /MO <minutes>` and whole-day intervals to `/SC DAILY /MO <days>`. The default capture cadence (`5h`) is therefore a 300-minute task, and the default Garden cadence (`2d`) is a two-day task.

The Windows adapter stores manifests at `~/.almanac/automation/windows-capture-sweep.json` and `~/.almanac/automation/windows-garden.json`. Those files are local scheduler metadata, not capture state. They record the task name, command, interval seconds, and quiet window where applicable. Doctor uses the capture manifest to decide whether automation is installed on Windows; it no longer checks a launchd plist on that platform.

Setup also changes the durable-global command shape on Windows. After an ephemeral `npx` setup successfully installs the package globally, scheduled commands use npm's Windows command shim (`almanac.cmd ...`) instead of `/usr/bin/env almanac ...`. The global install helper uses `cmd.exe /d /s /c npm.cmd install -g codealmanac@latest` on Windows because Node's `execFile` cannot directly launch `.cmd` files.

The repository verifies this path in GitHub Actions with a matrix over `ubuntu-latest` and `windows-latest` on Node 20 and Node 22. Keep platform-specific scheduler tests explicit about `platform: "darwin"` or `platform: "win32"` rather than inheriting `process.platform`; otherwise a Windows runner will correctly take the Task Scheduler branch while a macOS-oriented test is still asserting launchd plist behavior. Fake command-line binaries in tests need the same split: extensionless executable scripts work on Unix-like runners, while Windows needs a `.cmd` shim on the executable search path. When a test mutates the path on Windows, update and restore the `Path` key as well as `PATH`; spawned child processes may ignore a newly-added uppercase `PATH` when the original environment uses `Path`.

## What the scheduler owns and what it does not

The scheduler owns wakeup cadence and command invocation. It does not own transcript eligibility, cursor state, or capture dedupe. Those remain inside Almanac and are described by [[capture-flow]], [[capture-automation]], and [[capture-ledger]].

The first time capture automation is enabled, `runAutomationInstall()` calls `ensureAutomationCaptureSince(...)` and records `automation.capture_since` in `~/.almanac/config.toml`. Future sweeps use that timestamp to ignore transcript material older than the activation baseline. Reinstalling automation preserves the existing timestamp, so repairing the scheduler does not silently redefine the historical capture backlog.

## Fast-path and failure posture

Automation management is intentionally reachable even when the query stack is broken. `src/cli.ts` handles `setup` and `automation install|status|uninstall` through a sqlite-free fast path before the full Commander and query stack initialize. That boundary matters when `better-sqlite3` cannot load, because scheduler repair should still work even if `almanac search` and `almanac show` do not.

The install path validates its duration flags instead of silently falling back to defaults. `--every` and `--garden-every` must parse to durations greater than zero, and `--quiet` must parse to a duration greater than or equal to zero.

## Migration and cleanup

Current automation is scheduler-first, but setup and uninstall still run private cleanup for older provider hook installs. `cleanupLegacyHooks()` removes CodeAlmanac-owned `almanac-capture.sh` commands from observed Claude, Codex, and Cursor hook files and deletes the old Claude shell script path when present. [[sessionend-hook]] keeps the historical shapes and rationale for that migration boundary.

`almanac uninstall` removes both platform scheduler jobs unless the user passes `--keep-automation`. That keeps automation cleanup aligned with the broader global-install cleanup described in [[global-agent-instructions]].
