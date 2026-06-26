---
title: Automation
summary: >-
  Automation is the macOS launchd layer that schedules known Almanac maintenance tasks: sync,
  Garden, and opt-in self-update.
topics:
  - automation
  - cli
  - flows
sources:
  - id: sync-refactor-commit
    type: commit
    rev: 6fc4124bec3da04242077dcd01b26482d6f1126d
    note: >-
      Standardized scheduled session-memory vocabulary around sync and added migration for legacy
      capture-sweep launchd jobs.
  - id: sync-compat-session
    type: conversation
    path: >-
      /Users/rohan/.codex/sessions/2026/06/07/rollout-2026-06-07T17-38-44-019ea4aa-e76e-7841-94a0-b00f3c24ccf8.jsonl
    note: >-
      Records the 2026-06-08 compatibility discussion about `automation.capture_since`, legacy
      capture ledgers, and legacy hook cleanup.
  - id: migrate-automation-command
    type: file
    path: src/cli/commands/migrate.ts
    note: Implements `almanac migrate automation` for legacy capture-sweep plists.
  - id: automation
    type: file
    path: src/cli/commands/automation.ts
    note: Migrated from legacy files.
  - id: migrate
    type: file
    path: src/cli/commands/migrate.ts
    note: Migrated from legacy files.
  - id: tasks
    type: file
    path: src/platform/automation/tasks.ts
    note: Migrated from legacy files.
  - id: launchd
    type: file
    path: src/platform/automation/launchd.ts
    note: Migrated from legacy files.
  - id: legacy-capture
    type: file
    path: src/platform/automation/legacy-capture.ts
    note: Migrated from legacy files.
  - id: legacy-hooks
    type: file
    path: src/platform/automation/legacy-hooks.ts
    note: Migrated from legacy files.
  - id: index
    type: file
    path: src/cli/commands/setup/index.ts
    note: Migrated from legacy files.
  - id: automation-step
    type: file
    path: src/cli/commands/setup/automation-step.ts
    note: Migrated from legacy files.
  - id: uninstall
    type: file
    path: src/cli/commands/uninstall.ts
    note: Migrated from legacy files.
  - id: cli
    type: file
    path: src/cli.ts
    note: Migrated from legacy files.
  - id: register-setup-commands
    type: file
    path: src/cli/register-setup-commands.ts
    note: Migrated from legacy files.
  - id: register-wiki-lifecycle-commands
    type: file
    path: src/cli/register-wiki-lifecycle-commands.ts
    note: Migrated from legacy files.
  - id: sync
    type: file
    path: src/cli/commands/sync.ts
    note: Migrated from legacy files.
  - id: index-2
    type: file
    path: src/config/index.ts
    note: Migrated from legacy files.
  - id: config-store
    type: file
    path: src/config/store.ts
    note: Reads legacy `automation.capture_since`, writes canonical `automation.sync_since`, and removes the old key.
  - id: automation-test
    type: file
    path: test/automation.test.ts
    note: Migrated from legacy files.
  - id: cli-test
    type: file
    path: test/cli.test.ts
    note: Migrated from legacy files.
  - id: uninstall-test
    type: file
    path: test/uninstall.test.ts
    note: Migrated from legacy files.
  - id: auto-launch
    type: web
    url: https://www.npmjs.com/package/auto-launch
    note: Migrated from legacy sources.
  - id: node-schedule
    type: web
    url: https://www.npmjs.com/package/node-schedule
    note: Migrated from legacy sources.
  - id: node-windows
    type: web
    url: https://www.npmjs.com/package/node-windows
    note: Migrated from legacy sources.
  - docs/plans/2026-05-11-scheduled-quiet-session-capture.md
  - docs/plans/2026-05-14-provider-automation-boundary-refactor.md
  - >-
    /Users/rohan/.codex/sessions/2026/05/13/rollout-2026-05-13T23-00-06-019e246d-595d-76d3-bd45-6433245065ac.jsonl
  - >-
    /Users/rohan/.codex/sessions/2026/05/14/rollout-2026-05-14T11-33-08-019e271e-c639-72f2-bf85-e598ad83ce62.jsonl
  - >-
    /Users/rohan/.codex/sessions/2026/05/14/rollout-2026-05-14T16-02-00-019e2814-eaf1-77a1-848f-737a32ef277b.jsonl
  - >-
    /Users/rohan/.codex/sessions/2026/05/14/rollout-2026-05-14T15-56-34-019e280f-f145-7432-a87a-55b96c429856.jsonl
  - >-
    /Users/rohan/.codex/sessions/2026/05/14/rollout-2026-05-14T16-08-39-019e281b-0256-7b60-86f9-ca8990e73c39.jsonl
  - >-
    /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T11-12-35-019e6f5b-eaff-7600-abd8-c83c7cdc491a.jsonl
  - >-
    /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T12-14-55-019e6f94-fae1-7780-b2c9-3e2f3d6b6f3e.jsonl
status: active
verified: 2026-06-08T00:00:00.000Z

---

# Automation

Automation is the scheduler layer around Almanac's recurring maintenance work. In the current product shape, that means launchd jobs on macOS for `almanac sync`, `almanac garden`, and `almanac update`. The scheduler decides when Almanac starts. Almanac still decides which quiet transcripts to sync into Absorb, whether a wiki needs gardening, whether a package update exists, and how job state is recorded.

## Public command surface

`almanac automation install|status|uninstall` is the explicit scheduler-management surface. `install` writes launchd plists, bootstraps them with `launchctl`, and prints the effective sync interval, quiet window, activation timestamp, commands, and plist paths. `status` reads the plist files back and checks whether launchd has each job loaded, so a stale plist and a loaded scheduler job are separate reported facts. `uninstall` unloads and removes whichever CodeAlmanac plists exist.

`almanac setup` uses the automation surface only for setup-plan gates. Default setup installs scheduled CLI self-update and does not install scheduled sync or Garden. Interactive setup asks "Keep the Almanac CLI updated automatically?" with default yes; unattended setup uses the same default unless `--skip-automation` is present. Sync/Garden automation is installed manually with `almanac automation install`, or through setup only when explicit legacy sync/Garden flags such as `--sync-every`, `--sync-quiet`, `--garden-every`, or `--garden-off` are present.

## Launchd contract

The sync plist path is `~/Library/LaunchAgents/com.codealmanac.sync.plist`. The legacy capture-sweep plist path is `~/Library/LaunchAgents/com.codealmanac.capture-sweep.plist`; current status and migration code treats that as removed automation. The Garden plist path is `~/Library/LaunchAgents/com.codealmanac.garden.plist`. The update plist path is `~/Library/LaunchAgents/com.codealmanac.update.plist`. All task plists write stdout and stderr logs under `~/.almanac/logs/`.

The sync job runs `almanac sync --quiet <duration>`. The default schedule is every `5h`, and the default quiet window is `45m`. The Garden job runs `almanac garden` every `4h` by default. The update job runs bare `almanac update` every `1d` by default and relies on [[self-update]] for no-op behavior when the installed package is current.

The automation code is split by responsibility. `[[src/platform/automation/tasks.ts]]` owns `ScheduledTaskDefinition` records for sync, Garden, and update: labels, default intervals, plist paths, log filenames, working-directory policy, and default command arguments. `[[src/platform/automation/launchd.ts]]` owns plist rendering, PATH construction, bootstrap/removal, and loaded-state checks. `[[src/platform/automation/legacy-hooks.ts]]` owns private migration cleanup for older hook-based installs. `[[src/platform/automation/legacy-capture.ts]]` detects legacy launchd plists that still invoke `capture sweep`, and `[[src/cli/commands/migrate.ts]]` owns `almanac migrate automation`. `[[src/cli/commands/automation.ts]]` remains the command transaction that validates options, writes the activation baseline for sync, turns task definitions into launchd jobs, calls launchd helpers, and formats user output. [@migrate-automation-command]

Every task gets an explicit `PATH` assembled for launchd from the current environment plus fallback locations such as `/usr/local/bin`, `/opt/homebrew/bin`, and `/usr/bin`. The Garden plist also records a `WorkingDirectory`: `runAutomationInstall()` resolves it to the nearest repo containing `.almanac/`, falling back to the current directory when no wiki root is found.

There are two command-path modes. Direct `almanac automation install` writes absolute `ProgramArguments` for the current Node executable and resolved `dist/codealmanac.js` entrypoint. Setup uses a stricter rule when it was launched from ephemeral `npx`: it installs automation only after a durable global install succeeds, then writes `/usr/bin/env almanac ...` commands instead of pinning launchd to the transient cache path.

## What the scheduler owns and what it does not

The scheduler owns wakeup cadence and command invocation. It does not own transcript eligibility, cursor state, or sync dedupe. Those remain inside Almanac and are described by [[capture-flow]], [[capture-automation]], and [[capture-ledger]].

The first time sync automation is enabled, `runAutomationInstall()` calls `ensureAutomationSyncSince(...)` and records `automation.sync_since` in `~/.almanac/config.toml`. Future sync runs use that timestamp to ignore transcript material older than the activation baseline. Reinstalling automation preserves the existing timestamp, so repairing the scheduler does not silently redefine the historical transcript backlog.

`automation.capture_since` is legacy compatibility for users who installed automation before the sync vocabulary replaced capture vocabulary. `[[src/config/store.ts]]` accepts a valid legacy value as the existing activation baseline, writes it back as `automation.sync_since`, and deletes `capture_since`. The compatibility branch prevents a rename from backfilling old transcripts, but new code and docs should treat `sync_since` as the only current key. [@config-store] [@sync-compat-session]

## Scheduled task terminology

Automation should be understood as scheduled invocation of known Almanac tasks, not as a generic "automate any operation" framework. A scheduled task is a typed local command entrypoint with a cadence, log paths, and scheduler metadata. The current tasks are sync, Garden, and update.

The task/run/operation relationship is asymmetric:

- Automation schedules a task.
- A task invokes a CLI command.
- A CLI command may start zero, one, or many jobs.
- A job executes one [[wiki-lifecycle-operations]] operation.

That terminology keeps `sync` honest. `sync` is not a lifecycle operation; it is a coordinator that discovers quiet external transcripts, maps them to repos, reconciles ledger state, and may enqueue zero or more Absorb runs. Scheduled Garden is simpler: the scheduler invokes `almanac garden`, and that command starts one Garden operation run.

The 2026-05-14 refactor chose a `ScheduledTaskDefinition` model for known Almanac tasks such as sync, Garden, and update. That model shares launchd plist rendering, PATH construction, log naming, bootstrap/bootout, and status mechanics while preserving the distinction between scheduler tasks, coordinator commands, jobs, and semantic wiki operations. Adding another scheduled Almanac maintenance command should start by adding a task definition, not by copying plist labels, log paths, and working-directory rules into `[[src/cli/commands/automation.ts]]`.

The task definition is the source of truth for each task's scheduler identity: label, plist path, logs, working-directory policy, and command arguments. The default interval constants live in `[[src/platform/automation/tasks.ts]]` beside those task records, so changing scheduled task cadence stays inside the task-definition module instead of in command-level plist branches.

The 2026-05-14 [[self-update]] work added a boundary case to this model. Automatic CLI self-update uses scheduler mechanics, but the work command stays `almanac update` rather than becoming a private scheduler-only update command. Automation owns task selection, the launchd task definition, and status plumbing through `almanac automation install update`; the update command owns package mutation, version checks, and idempotent no-op behavior when the installed version is current.

There is no `.almanac/triggers.yaml` in the current implementation. A trigger file is a future product generalization discussed for non-code Almanacs: one scheduler command such as `almanac sweep` could read project-local trigger rules and decide whether to index changed sources, absorb new source records, or garden a changed graph. The current implementation uses typed scheduled tasks in `[[src/platform/automation/tasks.ts]]`, not project-local trigger configuration.

## Freshness trigger policy

The product rule for keeping a wiki current is semantic rather than file-count based. Absorb keeps facts current from completed work sessions; Garden keeps the wiki graph healthy after accumulated drift. A raw threshold such as "run Garden after five changed files" is too weak because small edits can touch many files without changing durable project memory, while one prompt, indexer, provider-harness, lifecycle-command, source-parsing, schema, automation, or viewer API change can materially change the wiki's current truth.

The current default posture is:

- run `almanac sync` on its scheduler cadence, with quiet-session eligibility deciding whether any Absorb run starts
- run `almanac garden` every `4h` by default
- run `almanac health` after wiki-writing runs and before committing wiki changes
- use `almanac review` only when Absorb or Garden finds a verified source conflict that needs human judgment

Manual Garden is justified after high-impact work, not after arbitrary file counts. Useful signals include a large feature branch, a public CLI contract change, changes to prompts or lifecycle commands, changes to the indexer or source model, changes to automation or provider runtime boundaries, more than about five pages changed by one Absorb pass, `almanac health` reporting structural problems, or several pages changing around one topic until navigation starts to feel unclear.

## Fast-path and failure posture

Automation management is intentionally reachable even when the query stack is broken. `src/cli.ts` handles `setup` and `automation install|status|uninstall` through a sqlite-free fast path before the full Commander and query stack initialize. That boundary matters when `better-sqlite3` cannot load, because scheduler repair should still work even if `almanac search` and `almanac show` do not.

The install path validates its duration flags instead of silently falling back to defaults. `--every` and `--garden-every` must parse to durations greater than zero, and `--quiet` must parse to a duration greater than or equal to zero.

## Migration and cleanup

Current automation is scheduler-first, but setup and uninstall still run private cleanup for older provider hook installs. `cleanupLegacyHooks()` removes CodeAlmanac-owned `almanac-capture.sh` commands from observed Claude, Codex, and Cursor hook files and deletes the old Claude shell script path when present. [[sessionend-hook]] keeps the historical shapes and rationale for that migration boundary.

`almanac uninstall` removes both launchd jobs unless the user passes `--keep-automation`. That keeps automation cleanup aligned with the broader global-install cleanup described in [[global-agent-instructions]].

## Review pressure and resolved cleanup

A 2026-05-14 review against `.claude/agents/review.md` did not question the scheduler, quiet window, ledger cursors, prefix hash, pending reconciliation, or repo lock as concepts. Those pieces protect real correctness invariants in [[capture-ledger]] and [[capture-flow]].

The review did identify placement and product-scope pressure in the pre-refactor automation shape:

- `runAutomationInstall()` manages both sync scheduling and Garden scheduling, with `--garden-every` and `--garden-off` living under an `automation` command that users may read as sync-specific.
- `cleanupLegacyHooks()` is justified migration glue, but it lives in [[src/cli/commands/automation.ts]] beside launchd install/status/uninstall; a cleaner boundary would isolate provider-hook cleanup and let setup call it explicitly.
- Setup's ephemeral-`npx` handling is justified because launchd must not pin itself to a transient cache path, but the special path should stay named and contained so it does not become general scheduler behavior by accident.
- `automation status` originally read plist presence and quiet-window text without checking loaded `launchd` state, so a stale or unloaded plist could look healthier than it was.

The merged provider/automation boundary refactor resolved the mechanical parts of that pressure by splitting task definitions, launchd mechanics, and legacy hook cleanup into separate modules, and by making status report loaded state separately from plist presence. The remaining product question is whether Garden scheduling should continue to live under the same `automation install` surface as sync. The current code keeps the shared command because both jobs are recurring local Almanac maintenance tasks, but future scheduled tasks should extend the typed task model rather than adding ad hoc branches inside the command file.

## Windows scheduler boundary

A 2026-05-14 review of `origin/codex/windows-support` added a second scheduler constraint: Windows support should not become a generic path/platform abstraction. Node's `node:path` module owns filesystem joining, normalization, parsing, and forced `path.win32` / `path.posix` formatting. It does not abstract scheduler behavior, `cmd.exe` quoting, npm `.cmd` shims, `launchctl`, `schtasks`, process spawning, or scheduler-owned metadata.

The same boundary applies to npm dependencies that appear to make scheduling portable. Packages such as `auto-launch` cover login/startup registration rather than interval scheduling; packages such as `node-schedule` run schedules inside an already-running Node process; packages such as `node-windows` install a service or daemon substrate rather than a one-shot scheduled CLI task. Almanac's current requirement is narrower and more operational: install user-level recurring scheduler jobs, keep logs and status inspectable, avoid admin prompts, uninstall cleanly, and preserve exact CLI/env behavior. That makes a small Almanac scheduler adapter boundary safer than depending on a broad npm wrapper that hides launchd, Task Scheduler, and systemd differences behind a least-common-denominator API.

The durable abstraction should sit at the external scheduler boundary. `automation.ts` should parse common CLI options, choose a scheduler adapter for the active platform, and pass typed capture and Garden task definitions into that adapter. A `launchdScheduler` owns plist rendering, bootout/bootstrap, PATH construction, log paths, and launchd status. A `windowsTaskScheduler` owns Task Scheduler task names, `schtasks` create/query/delete calls, task command quoting, Windows interval limits, manifests, status, uninstall, and doctor checks.

The Windows branch exposed two source-of-truth risks that future work should avoid:

- Windows Task Scheduler task names such as `\CodeAlmanac\CaptureSweep` and `\CodeAlmanac\Garden` should be authoritative for uninstall and status repair. JSON manifests are adapter-private metadata for display details such as interval, quiet window, command, and working directory; they must not be required before deleting known tasks.
- Windows manifest parsing should have one owner. Doctor and automation should call the scheduler boundary instead of duplicating validation and status interpretation in separate modules.

Windows command launching needs a smaller shared helper, not a broad platform abstraction. Any place that runs npm-installed command shims on Windows should use one helper for `cmd.exe` / `.cmd` behavior, because quoting bugs around paths with spaces are scheduler- and process-launch correctness issues rather than wiki-operation logic.
