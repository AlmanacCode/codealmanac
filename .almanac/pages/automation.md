---
title: Automation
summary: Automation is the macOS launchd layer that schedules `almanac capture sweep` and `almanac garden`, while capture eligibility and dedupe stay inside Almanac-owned state.
topics: [automation, cli, flows]
files:
  - src/commands/automation.ts
  - src/automation/tasks.ts
  - src/automation/launchd.ts
  - src/automation/legacy-hooks.ts
  - src/commands/setup.ts
  - src/commands/uninstall.ts
  - src/cli.ts
  - src/cli/register-setup-commands.ts
  - src/cli/register-wiki-lifecycle-commands.ts
  - src/commands/capture-sweep.ts
  - src/config/index.ts
  - test/automation.test.ts
  - test/cli.test.ts
  - test/uninstall.test.ts
sources:
  - docs/plans/2026-05-11-scheduled-quiet-session-capture.md
  - docs/plans/2026-05-14-provider-automation-boundary-refactor.md
  - /Users/rohan/.codex/sessions/2026/05/13/rollout-2026-05-13T23-00-06-019e246d-595d-76d3-bd45-6433245065ac.jsonl
  - /Users/rohan/.codex/sessions/2026/05/14/rollout-2026-05-14T11-33-08-019e271e-c639-72f2-bf85-e598ad83ce62.jsonl
status: active
verified: 2026-05-14
---

# Automation

Automation is the scheduler layer around Almanac's recurring maintenance work. In the current product shape, that means two launchd jobs on macOS: one wakes `almanac capture sweep`, and the other wakes `almanac garden`. The scheduler decides when Almanac starts. Almanac still decides what to capture, whether a wiki needs gardening, and how job state is recorded.

## Public command surface

`almanac automation install|status|uninstall` is the explicit scheduler-management surface. `install` writes launchd plists, bootstraps them with `launchctl`, and prints the effective capture interval, quiet window, activation timestamp, commands, and plist paths. `status` reads the plist files back and checks whether launchd has each job loaded, so a stale plist and a loaded scheduler job are separate reported facts. `uninstall` unloads and removes whichever CodeAlmanac plists exist.

`almanac setup` is the onboarding entry point for the same automation surface. Setup installs scheduled capture and scheduled Garden by default unless the user passes `--skip-automation` or `--garden-off`. That makes automation a first-run product behavior rather than a hidden expert-only command.

## Launchd contract

The capture plist path is `~/Library/LaunchAgents/com.codealmanac.capture-sweep.plist`. The Garden plist path is `~/Library/LaunchAgents/com.codealmanac.garden.plist`. Both plists write stdout and stderr logs under `~/.almanac/logs/`.

The capture job runs `almanac capture sweep` with a quiet-window argument. The default schedule is every `5h`, and the default quiet window is `45m`. The Garden job runs `almanac garden` every `2d` by default.

The automation code is split by responsibility. `[[src/automation/tasks.ts]]` owns labels, default durations, plist paths, and default command arguments. `[[src/automation/launchd.ts]]` owns plist rendering, PATH construction, bootstrap/removal, and loaded-state checks. `[[src/automation/legacy-hooks.ts]]` owns private migration cleanup for older hook-based installs. `[[src/commands/automation.ts]]` remains the command transaction that validates options, writes the activation baseline, calls launchd helpers, and formats user output.

Both jobs get an explicit `PATH` assembled for launchd from the current environment plus fallback locations such as `/usr/local/bin`, `/opt/homebrew/bin`, and `/usr/bin`. The Garden plist also records a `WorkingDirectory`: `runAutomationInstall()` resolves it to the nearest repo containing `.almanac/`, falling back to the current directory when no wiki root is found.

There are two command-path modes. Direct `almanac automation install` writes absolute `ProgramArguments` for the current Node executable and resolved `dist/codealmanac.js` entrypoint. Setup uses a stricter rule when it was launched from ephemeral `npx`: it installs automation only after a durable global install succeeds, then writes `/usr/bin/env almanac ...` commands instead of pinning launchd to the transient cache path.

## What the scheduler owns and what it does not

The scheduler owns wakeup cadence and command invocation. It does not own transcript eligibility, cursor state, or capture dedupe. Those remain inside Almanac and are described by [[capture-flow]], [[capture-automation]], and [[capture-ledger]].

The first time capture automation is enabled, `runAutomationInstall()` calls `ensureAutomationCaptureSince(...)` and records `automation.capture_since` in `~/.almanac/config.toml`. Future sweeps use that timestamp to ignore transcript material older than the activation baseline. Reinstalling automation preserves the existing timestamp, so repairing the scheduler does not silently redefine the historical capture backlog.

## Scheduled task terminology

Automation should be understood as scheduled invocation of known Almanac tasks, not as a generic "automate any operation" framework. A scheduled task is a typed local command entrypoint with a cadence, log paths, and scheduler metadata. The two current tasks are `capture-sweep` and `garden`.

The task/run/operation relationship is asymmetric:

- Automation schedules a task.
- A task invokes a CLI command.
- A CLI command may start zero, one, or many process-manager runs.
- A run executes one [[wiki-lifecycle-operations]] operation.

That terminology keeps `capture sweep` honest. `capture sweep` is not a lifecycle operation; it is a capture coordinator that discovers quiet external transcripts, maps them to repos, reconciles ledger state, and may enqueue zero or more Absorb runs. Scheduled Garden is simpler: the scheduler invokes `almanac garden`, and that command starts one Garden operation run.

The 2026-05-14 refactor plan chose a `ScheduledTaskDefinition` model for known Almanac tasks such as `capture-sweep` and `garden`. That model shares launchd plist rendering, PATH construction, log naming, bootstrap/bootout, and status mechanics while preserving the distinction between scheduler tasks, coordinator commands, process-manager runs, and semantic wiki operations.

## Fast-path and failure posture

Automation management is intentionally reachable even when the query stack is broken. `src/cli.ts` handles `setup` and `automation install|status|uninstall` through a sqlite-free fast path before the full Commander and query stack initialize. That boundary matters when `better-sqlite3` cannot load, because scheduler repair should still work even if `almanac search` and `almanac show` do not.

The install path validates its duration flags instead of silently falling back to defaults. `--every` and `--garden-every` must parse to durations greater than zero, and `--quiet` must parse to a duration greater than or equal to zero.

## Migration and cleanup

Current automation is scheduler-first, but setup and uninstall still run private cleanup for older provider hook installs. `cleanupLegacyHooks()` removes CodeAlmanac-owned `almanac-capture.sh` commands from observed Claude, Codex, and Cursor hook files and deletes the old Claude shell script path when present. [[sessionend-hook]] keeps the historical shapes and rationale for that migration boundary.

`almanac uninstall` removes both launchd jobs unless the user passes `--keep-automation`. That keeps automation cleanup aligned with the broader global-install cleanup described in [[global-agent-instructions]].

## Review pressure and resolved cleanup

A 2026-05-14 review against `.claude/agents/review.md` did not question the scheduler, quiet window, ledger cursors, prefix hash, pending reconciliation, or repo lock as concepts. Those pieces protect real correctness invariants in [[capture-ledger]] and [[capture-flow]].

The review did identify placement and product-scope pressure in the pre-refactor automation shape:

- `runAutomationInstall()` manages both capture scheduling and Garden scheduling, with `--garden-every` and `--garden-off` living under an `automation` command that users may read as auto-capture-specific.
- `cleanupLegacyHooks()` is justified migration glue, but it lives in [[src/commands/automation.ts]] beside launchd install/status/uninstall; a cleaner boundary would isolate provider-hook cleanup and let setup call it explicitly.
- Setup's ephemeral-`npx` handling is justified because launchd must not pin itself to a transient cache path, but the special path should stay named and contained so it does not become general scheduler behavior by accident.
- `automation status` originally read plist presence and quiet-window text without checking loaded `launchd` state, so a stale or unloaded plist could look healthier than it was.

The merged provider/automation boundary refactor resolved the mechanical parts of that pressure by splitting task definitions, launchd mechanics, and legacy hook cleanup into separate modules, and by making status report loaded state separately from plist presence. The remaining product question is whether Garden scheduling should continue to live under the same `automation install` surface as auto-capture. The current code keeps the shared command because both jobs are recurring local Almanac maintenance tasks, but future scheduled tasks should extend the typed task model rather than adding ad hoc branches inside the command file.

## Windows scheduler boundary

A 2026-05-14 review of `origin/codex/windows-support` added a second scheduler constraint: Windows support should not become a generic path/platform abstraction. Node's `node:path` module owns filesystem joining, normalization, parsing, and forced `path.win32` / `path.posix` formatting. It does not abstract scheduler behavior, `cmd.exe` quoting, npm `.cmd` shims, `launchctl`, `schtasks`, process spawning, or scheduler-owned metadata.

The durable abstraction should sit at the external scheduler boundary. `automation.ts` should parse common CLI options, choose a scheduler adapter for the active platform, and pass typed capture and Garden task definitions into that adapter. A `launchdScheduler` owns plist rendering, bootout/bootstrap, PATH construction, log paths, and launchd status. A `windowsTaskScheduler` owns Task Scheduler task names, `schtasks` create/query/delete calls, task command quoting, Windows interval limits, manifests, status, uninstall, and doctor checks.

The Windows branch exposed two source-of-truth risks that future work should avoid:

- Windows Task Scheduler task names such as `\CodeAlmanac\CaptureSweep` and `\CodeAlmanac\Garden` should be authoritative for uninstall and status repair. JSON manifests are adapter-private metadata for display details such as interval, quiet window, command, and working directory; they must not be required before deleting known tasks.
- Windows manifest parsing should have one owner. Doctor and automation should call the scheduler boundary instead of duplicating validation and status interpretation in separate modules.

Windows command launching needs a smaller shared helper, not a broad platform abstraction. Any place that runs npm-installed command shims on Windows should use one helper for `cmd.exe` / `.cmd` behavior, because quoting bugs around paths with spaces are scheduler- and process-launch correctness issues rather than wiki-operation logic.
