---
title: Lifecycle CLI
summary: The V1 lifecycle CLI routes Build, Absorb, Garden, and scheduled capture sweep through backgroundable run infrastructure.
topics: [cli, flows, agents]
files:
  - src/cli/register-wiki-lifecycle-commands.ts
  - src/cli.ts
  - src/cli/sqlite-free.ts
  - src/commands/operations.ts
  - src/commands/jobs.ts
  - src/commands/session-transcripts.ts
  - src/commands/setup.ts
  - src/commands/automation.ts
sources:
  - /Users/kushagrachitkara/.codex/sessions/2026/05/11/rollout-2026-05-11T14-32-08-019e18f4-5e73-7790-ba49-73cc02544a58.jsonl
verified: 2026-05-13
---

# Lifecycle CLI

The V1 lifecycle CLI routes write-capable wiki work into [[wiki-lifecycle-operations]] and [[process-manager-runs]]. Query and organization commands remain deterministic over the filesystem, [[global-registry]], and SQLite index; AI execution is limited to the lifecycle commands.

## Write-capable commands

`almanac init` maps to Build and defaults foreground. It refuses a populated wiki unless `--force` is set.

`almanac capture` maps to Absorb with coding-session transcript context and defaults background. Explicit transcript files work. Claude latest-session, `--session`, `--since`, `--limit`, and `--all` discovery are implemented; Codex/Cursor discovery and `--all-apps` still fail clearly unless transcript files are provided.

`almanac capture sweep` is the scheduler-owned automatic capture entry point. It scans Claude and Codex transcript stores, applies the quiet-window rule, maps transcript cwd values to repos with `.almanac/`, reconciles `.almanac/runs/capture-ledger.json`, and starts ordinary background `capture` jobs for eligible continuations.

There is one CLI-shape wrinkle inside that surface: `capture` itself has `--json`, and `capture sweep` also has `--json`. Commander can attach `almanac capture sweep --json` to the parent command object, so the sweep action now reads merged options with `optsWithGlobals()` instead of trusting only the leaf `opts` object. Future `capture` subcommands that reuse parent flag names should preserve that pattern.

[[ingest-operation]] (`almanac ingest <file-or-folder>`) maps to Absorb with user-provided file/folder context and defaults background.

`almanac garden` maps to Garden and defaults background because it can make broad graph edits.

## Shared flags

`--using <provider[/model]>` overrides the configured provider/model for one run. Without it, command handling reads the configured default provider/model. `--foreground` keeps capture, ingest, and garden attached. `--background` detaches init. `--json` is for background start responses and cannot be combined with foreground streaming. Attached lifecycle runs are quiet by default: they print the final `started` or `finished` line, while live agent text/tool activity is only streamed when `--verbose` is passed. `almanac init` is the one attached command with an extra UX line: it prints `Analyzing codebase... This usually takes 5-10 minutes.` before the build begins and recommends `almanac serve` after a successful foreground build.

## Viewer command

`almanac serve` starts a local read-only HTTP viewer for the wiki. It is not an AI lifecycle command — it runs no agent, writes no pages, and makes no AI calls. It is a pure query command over the same `index.db` and `pages/*.md` data the CLI already uses. See [[almanac-serve]] for the full implementation, routes, and design rationale.

## Jobs commands

`almanac jobs`, `jobs show`, `jobs logs`, `jobs attach`, and `jobs cancel` are pure process-inspection commands over `.almanac/runs/`. They do not run AI and do not read or write wiki page content except through normal run records and logs.

## Automation commands

`almanac automation install|status|uninstall` manages macOS launchd jobs for scheduled capture and scheduled Garden. Capture runs `almanac capture sweep` every 5h by default; Garden runs `almanac garden` every 2d by default. `automation install --every <duration> --quiet <duration>` customizes capture cadence and the transcript quiet window, `--garden-every <duration>` customizes Garden cadence, and `--garden-off` removes the Garden plist while leaving capture automation installed. Direct automation installs write absolute `ProgramArguments` for the current Node executable plus the resolved `dist/codealmanac.js` entrypoint, and the Garden plist records the nearest wiki root as `WorkingDirectory` so scheduled `almanac garden` resolves the intended `.almanac/` graph. Setup adds one extra rule for ephemeral `npx` launches: it installs automation only after a durable global install succeeds, and in that case writes `/usr/bin/env almanac capture sweep --quiet ...` and `/usr/bin/env almanac garden` instead of pinning launchd to the transient cache path.

The install command also establishes the auto-capture activation cursor. On first install it writes `automation.capture_since` to `~/.almanac/config.toml`; future sweeps skip transcripts whose mtime is before that timestamp. Reinstalling automation preserves the existing timestamp so rerunning setup repairs the scheduler without redefining what historical transcript material is in scope. The config write now runs legacy config migration first, so introducing `automation.capture_since` does not clobber older JSON-based agent settings.

Setup now installs capture and Garden automation by default, with `--skip-automation`, `--auto-capture-every <duration>`, `--auto-capture-quiet <duration>`, `--garden-every <duration>`, and `--garden-off` replacing the old hook-oriented setup controls. The shared duration parser now accepts seconds as well as minutes/hours/days/weeks, which mainly matters for focused scheduler smoke tests such as `--quiet 1s` rather than for normal defaults. The same setup path also installs the global Claude and Codex instruction surfaces described in [[global-agent-instructions]]. Auto-commit is a separate permission boundary: interactive setup asks whether Almanac may commit wiki updates, unattended `--yes` keeps it disabled unless `--auto-commit` is passed, and the resulting `auto_commit` user config controls operation prompt behavior rather than the scheduler itself. When both `--skip-automation` and `--skip-guides` are passed, `runSetup()` short-circuits before rendering the setup banner and prints only `almanac: nothing to install — use --help to see what setup does`.

Bare `codealmanac` setup has one extra install-path rule captured in [[install-time-node-launcher]]. If setup starts from an `npx` or other non-global package root, `src/install/global.ts` upgrades or reuses the durable global install and reruns `setup` from that package's `dist/launcher.js`. That keeps setup and later interactive CLI invocations on the same pinned Node runtime instead of letting SQLite behavior depend on whichever `node` happens to resolve later from `PATH`.

Setup and uninstall still run private legacy-hook cleanup before touching scheduler state. That cleanup is intentionally shape-aware: it removes CodeAlmanac-owned `almanac-capture.sh` commands across provider-era event names such as `SessionEnd`, `Stop`, and `sessionEnd`, then drops empty wrapper objects and empty hook containers so historical hook files are actually healed rather than left with dead scaffolding.

One debugging lesson from the 2026-05-12 launchd smoke tests is worth preserving alongside that cleanup contract: if "scheduled automation" appears to be spawning more jobs than the configured sweep cadence should allow, check for multiple capture mechanisms before blaming launchd. The observed duplicate-job burst came from two active sources at once: scheduled sweeps plus still-installed legacy hooks.

There is one implementation wrinkle worth remembering: setup, automation, agents, config, update, doctor, and uninstall are also wired through the sqlite-free fast path in [[src/cli/sqlite-free.ts]], before the full Commander CLI and SQLite-backed query stack are initialized. That is why recovery and install-management commands still work when a local or global install cannot load `better-sqlite3`, but it also means some flag parsing is custom code in that fast path. The 2026-05-11 review originally found that a bare `almanac automation install --every` could silently fall back to the default 5h interval; the implementation now validates that case explicitly and applies the same care to the quiet-window flag path.

The 2026-05-13 merge of `v1` into `dev` preserved one extra invariant: new setup and automation flags added on `dev` must be carried into the extracted sqlite-free module, not only into Commander registration. That includes `--auto-commit`, `--garden-every`, `--garden-off`, equals-style values such as `--auto-capture-quiet=1m`, and launcher-preserved invocation behavior for `codealmanac` setup.

## Removed public paths

`almanac bootstrap` is not part of the V1 public CLI. `capture status` and `ps` were rerouted to the jobs surface with deprecation warnings during the V1 cleanup.

`almanac hook ...` was removed from the public CLI. Automatic capture is scheduler-only: setup offers scheduled automatic capture directly, while `almanac automation ...` remains available for explicit scheduler management.
