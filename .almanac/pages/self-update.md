---
title: Self Update
summary: Almanac self-update uses a background notifier plus an idempotent global npm install path, and scheduled self-update runs the normal `almanac update` command.
topics: [cli, systems, automation, decisions]
files:
  - src/commands/update.ts
  - src/update/check.ts
  - src/update/notifier-worker.ts
  - src/update/announce.ts
  - src/update/state.ts
  - src/update/install.ts
  - src/update/lock.ts
  - src/update/version.ts
  - src/commands/doctor-checks/updates.ts
  - src/cli/sqlite-free.ts
  - src/automation/tasks.ts
  - src/commands/automation.ts
  - src/commands/setup.ts
  - src/commands/setup/automation-step.ts
sources:
  - /Users/rohan/.codex/sessions/2026/05/14/rollout-2026-05-14T15-56-34-019e280f-f145-7432-a87a-55b96c429856.jsonl
  - /Users/rohan/.codex/sessions/2026/05/14/rollout-2026-05-14T16-08-39-019e281b-0256-7b60-86f9-ca8990e73c39.jsonl
status: active
verified: 2026-05-14
---

# Self Update

Almanac self-update means updating the globally installed `codealmanac` package that runs future CLI invocations. The current behavior is notifier-first plus an idempotent update command: normal commands may spawn a detached registry check, the pre-command banner reads cached update state, and `almanac update` checks npm before installing.

## Current contract

`[[src/update/notifier-worker.ts]]` spawns a detached copy of the current CLI with `--internal-check-updates` after normal commands. The worker calls `checkForUpdate()` and writes `~/.almanac/update-state.json`; it never prints output and it skips test, worker, help, version, and notifier-disabled paths.

`[[src/update/check.ts]]` queries `https://registry.npmjs.org/codealmanac` for `dist-tags.latest` with a 24h cache and a 3s timeout. Failed checks record `last_fetch_failed_at` and preserve the last known `latest_version`, so an offline check does not forget a previously discovered release.

`[[src/update/announce.ts]]` synchronously reads `~/.almanac/update-state.json` and `~/.almanac/config.toml` before Commander handles a command. It prints the update banner to stderr only when `latest_version` is newer than the installed package version, the version has not been dismissed, and `update_notifier` is not `false`.

`[[src/commands/update.ts]]` owns the update surface. `almanac update --check` forces a registry query, `--dismiss` suppresses the current latest version, the deprecated notifier flags write `update_notifier`, and bare `almanac update` checks npm before running `npm i -g codealmanac@latest` with inherited stdio. The install path does not run `sudo`; permission failures are left visible in npm output and summarized afterward.

`[[src/update/install.ts]]` owns the npm install subprocess and its user-facing failure messages. `[[src/update/lock.ts]]` owns the global `.update-install.lock` file so manual and scheduled update attempts cannot overlap. `[[src/update/version.ts]]` owns installed package-version lookup for the check, announce, and update paths.

`[[src/update/state.ts]]` is intentionally a small regenerable JSON file. Missing, empty, malformed, or unreadable state becomes an empty state instead of breaking every CLI invocation.

## Auto-update design pressure

The 2026-05-14 auto-update implementation rejected private scheduler-only update commands. `almanac update` remains the work command:

- `almanac update` updates now.
- `almanac update --check` checks now.
- `almanac update --dismiss` suppresses the current latest version.

The scheduled job runs the same visible command, `almanac update`. There is no documented private flag like `--auto-if-needed`, `--scheduled`, or `--from-automation`.

The scheduler-management surface stays under [[automation]] as task selection: `almanac automation install update`, `almanac automation status update`, and `almanac automation uninstall update`. Installing the update task without `--every` uses the default `1d` cadence from `[[src/automation/tasks.ts]]`, which renders to a launchd `StartInterval` of `86400` seconds. That shape keeps the product concepts separate: `update` owns package mutation and version checks, while `automation` owns launchd installation, status, and removal for recurring Almanac tasks.

Bare `almanac update` is idempotent enough for launchd. It checks the registry first, exits successfully when the installed version is current, installs only when a newer version exists, skips dismissed versions, and holds a global lock so manual and scheduled invocations cannot overlap.

## Boundaries for automatic self-update

Automatic self-update changes executable code outside the current repo, so it is a different trust boundary from scheduled capture or Garden. `npm i -g codealmanac@latest` replaces the global CLI binary that later runs setup, capture, indexing, automation, uninstall, and scheduler tasks. Interactive setup asks whether to enable scheduled self-update after scheduled wiki maintenance is accepted and installed; that self-update prompt defaults to yes. Unattended setup exposes the same opt-in through the explicit `--auto-update` flag.

Global npm is also a rougher substrate than a GUI app updater. It may write into an `nvm`, Homebrew, system Node, Volta, or other npm prefix; it may fail with permissions; and it may rebuild native modules such as `better-sqlite3`. The updater never runs `sudo`, does not prompt, and leaves npm failure details in the scheduler logs.

The user-facing syntax does not leak launchd implementation details. The public command for the scheduled work remains `almanac update`; task installation uses the existing automation surface.

## Relationship to automation

`[[src/automation/tasks.ts]]` models known scheduled Almanac tasks with labels, default intervals, plist paths, log names, working-directory policy, and program arguments. Auto-update extends that task-definition model instead of copying plist construction into `[[src/commands/update.ts]]` or adding another ad hoc branch to `[[src/commands/automation.ts]]`.

`[[src/commands/automation.ts]]` selects task IDs and iterates task definitions. The default install still targets capture plus Garden for compatibility, while positional task selection handles explicit operations such as `almanac automation install update --every 1d`.

The 2026-05-14 discussion also exposed a product naming tension. Setup currently asks whether to "keep your codebase wiki up to date automatically," but the implementation installs capture and Garden automation, not CLI self-update. Adding self-update as another special case under that wording would make the boundary less clear unless setup and automation language distinguish wiki maintenance from updating Almanac itself.

Unattended setup does not enable automatic CLI self-update by default. Unlike capture and Garden, self-update mutates the user's global install, so `almanac setup --yes` leaves it disabled unless `--auto-update` is passed. Interactive setup still makes the choice part of onboarding by asking the user directly when the automation step is installing recurring maintenance.

Automation status reports automatic self-update through the same task status API that reports capture and Garden scheduler state. That avoids duplicating manifest or launchd interpretation in update-specific diagnostics.

## Simplification before implementation

`[[src/update/notifier-worker.ts]]` is named for the detached notifier worker for `--internal-check-updates`. Recurring launchd automation lives under `[[src/automation/]]`, so notifier scheduling and OS scheduler management do not share a misleading module name.

Installed-version lookup has one shared owner in `[[src/update/version.ts]]`. Update-state parsing still has a tolerant async owner in `[[src/update/state.ts]]` and a small synchronous doctor reader in `[[src/update/notifier-worker.ts]]`.

## Fast-path requirement

Update, setup, automation, config, doctor, and uninstall live in the sqlite-free fast path described by [[lifecycle-cli]]. The auto-update path preserves that recovery property, because one practical reason to run `almanac update` is repairing a global install whose `better-sqlite3` binding no longer loads under the active Node runtime.
