---
title: Automation
summary: Automation is the macOS launchd layer that schedules `almanac capture sweep` and `almanac garden`, while capture eligibility and dedupe stay inside Almanac-owned state.
topics: [automation, cli, flows]
files:
  - src/commands/automation.ts
  - src/commands/setup.ts
  - src/commands/uninstall.ts
  - src/cli.ts
  - src/cli/register-setup-commands.ts
  - src/cli/register-wiki-lifecycle-commands.ts
  - src/commands/capture-sweep.ts
  - src/update/config.ts
  - test/automation.test.ts
  - test/cli.test.ts
  - test/uninstall.test.ts
sources:
  - docs/plans/2026-05-11-scheduled-quiet-session-capture.md
status: active
verified: 2026-05-13
---

# Automation

Automation is the scheduler layer around Almanac's recurring maintenance work. In the current product shape, that means two launchd jobs on macOS: one wakes `almanac capture sweep`, and the other wakes `almanac garden`. The scheduler decides when Almanac starts. Almanac still decides what to capture, whether a wiki needs gardening, and how job state is recorded.

## Public command surface

`almanac automation install|status|uninstall` is the explicit scheduler-management surface. `install` writes launchd plists, bootstraps them with `launchctl`, and prints the effective capture interval, quiet window, activation timestamp, commands, and plist paths. `status` reads the plist files back and reports whether capture and Garden automation are installed. `uninstall` unloads and removes whichever CodeAlmanac plists exist.

`almanac setup` is the onboarding entry point for the same automation surface. Setup installs scheduled capture and scheduled Garden by default unless the user passes `--skip-automation` or `--garden-off`. That makes automation a first-run product behavior rather than a hidden expert-only command.

## Launchd contract

The capture plist path is `~/Library/LaunchAgents/com.codealmanac.capture-sweep.plist`. The Garden plist path is `~/Library/LaunchAgents/com.codealmanac.garden.plist`. Both plists write stdout and stderr logs under `~/.almanac/logs/`.

The capture job runs `almanac capture sweep` with a quiet-window argument. The default schedule is every `5h`, and the default quiet window is `45m`. The Garden job runs `almanac garden` every `2d` by default.

Both jobs get an explicit `PATH` assembled for launchd from the current environment plus fallback locations such as `/usr/local/bin`, `/opt/homebrew/bin`, and `/usr/bin`. The Garden plist also records a `WorkingDirectory`: `runAutomationInstall()` resolves it to the nearest repo containing `.almanac/`, falling back to the current directory when no wiki root is found.

There are two command-path modes. Direct `almanac automation install` writes absolute `ProgramArguments` for the current Node executable and resolved `dist/codealmanac.js` entrypoint. Setup uses a stricter rule when it was launched from ephemeral `npx`: it installs automation only after a durable global install succeeds, then writes `/usr/bin/env almanac ...` commands instead of pinning launchd to the transient cache path.

## What the scheduler owns and what it does not

The scheduler owns wakeup cadence and command invocation. It does not own transcript eligibility, cursor state, or capture dedupe. Those remain inside Almanac and are described by [[capture-flow]], [[capture-automation]], and [[capture-ledger]].

The first time capture automation is enabled, `runAutomationInstall()` calls `ensureAutomationCaptureSince(...)` and records `automation.capture_since` in `~/.almanac/config.toml`. Future sweeps use that timestamp to ignore transcript material older than the activation baseline. Reinstalling automation preserves the existing timestamp, so repairing the scheduler does not silently redefine the historical capture backlog.

## Fast-path and failure posture

Automation management is intentionally reachable even when the query stack is broken. `src/cli.ts` handles `setup` and `automation install|status|uninstall` through a sqlite-free fast path before the full Commander and query stack initialize. That boundary matters when `better-sqlite3` cannot load, because scheduler repair should still work even if `almanac search` and `almanac show` do not.

The install path validates its duration flags instead of silently falling back to defaults. `--every` and `--garden-every` must parse to durations greater than zero, and `--quiet` must parse to a duration greater than or equal to zero.

## Migration and cleanup

Current automation is scheduler-first, but setup and uninstall still run private cleanup for older provider hook installs. `cleanupLegacyHooks()` removes CodeAlmanac-owned `almanac-capture.sh` commands from observed Claude, Codex, and Cursor hook files and deletes the old Claude shell script path when present. [[sessionend-hook]] keeps the historical shapes and rationale for that migration boundary.

`almanac uninstall` removes both launchd jobs unless the user passes `--keep-automation`. That keeps automation cleanup aligned with the broader global-install cleanup described in [[global-agent-instructions]].
