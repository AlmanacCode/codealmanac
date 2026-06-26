---
title: Lifecycle CLI
summary: >-
  The V1 lifecycle CLI routes Build, Absorb, Garden, and scheduled maintenance through
  backgroundable run infrastructure and sqlite-free install-management paths.
topics:
  - cli
  - flows
  - agents
sources:
  - id: register-wiki-lifecycle-commands
    type: file
    path: src/cli/register-wiki-lifecycle-commands.ts
    note: Migrated from legacy files.
  - id: register-edit-commands
    type: file
    path: src/cli/register-edit-commands.ts
    note: Migrated from legacy files.
  - id: cli
    type: file
    path: src/cli.ts
    note: Migrated from legacy files.
  - id: sqlite-free
    type: file
    path: src/cli/sqlite-free.ts
    note: Migrated from legacy files.
  - id: operations
    type: file
    path: src/cli/commands/operations.ts
    note: Migrated from legacy files.
  - id: review
    type: file
    path: src/cli/commands/review.ts
    note: Migrated from legacy files.
  - id: jobs
    type: file
    path: src/cli/commands/jobs.ts
    note: Migrated from legacy files.
  - id: sync
    type: file
    path: src/cli/commands/sync.ts
    note: Migrated from legacy files.
  - id: sync-2
    type: file
    path: src/sync/
    note: Migrated from legacy files.
  - id: index
    type: file
    path: src/cli/commands/setup/index.ts
    note: Migrated from legacy files.
  - id: automation-step
    type: file
    path: src/cli/commands/setup/automation-step.ts
    note: Migrated from legacy files.
  - id: automation
    type: file
    path: src/cli/commands/automation.ts
    note: Migrated from legacy files.
  - id: store
    type: file
    path: src/review/store.ts
    note: Migrated from legacy files.
  - id: tasks
    type: file
    path: src/platform/automation/tasks.ts
    note: Migrated from legacy files.
  - >-
    /Users/kushagrachitkara/.codex/sessions/2026/05/11/rollout-2026-05-11T14-32-08-019e18f4-5e73-7790-ba49-73cc02544a58.jsonl
  - docs/research/2026-05-07-cli-surface-design.md
  - docs/research/2026-05-07-cli-config-best-practices.md
  - docs/plans/2026-05-08-wiki-agent-operations-and-cli-design.md
  - >-
    /Users/rohan/.codex/sessions/2026/05/15/rollout-2026-05-15T01-43-21-019e2a29-293a-7263-b6ce-0a9dc0af792a.jsonl
verified: 2026-05-15T00:00:00.000Z

---

# Lifecycle CLI

The V1 lifecycle CLI routes write-capable wiki work into [[wiki-lifecycle-operations]] and [[process-manager-runs]]. Query and organization commands remain deterministic over the filesystem, [[global-registry]], and SQLite index; AI execution is limited to the lifecycle commands.

## CLI guidance fit

A 2026-05-15 audit against `docs/research/2026-05-07-cli-surface-design.md`, `docs/research/2026-05-07-cli-config-best-practices.md`, and `docs/plans/2026-05-08-wiki-agent-operations-and-cli-design.md` found that the current CLI mostly follows the repo's own guidance. Commands generally express user intent rather than internals: `init`, `absorb`/`ingest`, `sync`, and `garden` map to Build, Absorb, quiet-session transcript syncing, and Garden, while `agents`, `config`, `topics`, `jobs`, and `automation` keep noun-specific verbs grouped.

The implemented positional arguments also fit the docs' operand rule. `show <slug>`, `absorb <inputs...>`, `ingest <inputs...>`, and `tag <page> <topic...>` use positionals for direct objects rather than for execution options.

The main CLI-contract gap is config and environment precedence. The docs specify `flag > ALMANAC_* env > project config > user config > defaults`; current code has user/project config plus per-command `--using`, but broad `ALMANAC_*` environment overrides are not yet a general config layer.

Two other drifts are intentional or bounded. Older docs refer to separate `--agent` / `--model` flags, while the current public surface uses `--using <provider[/model]>`; the later lifecycle docs and README use `--using`, so old research docs now carry historical terminology. The old `capture sweep --dry-run` verification path was replaced by `sync status`, which keeps the read-only preview behavior without adding a dry-run flag.

The remaining quality gap is help shape. Commander help is grouped and clean, but the research docs call for example-led help; current help output is still mostly flag and subcommand listings.

## Write-capable commands

`almanac init` maps to Build and defaults foreground. It refuses a populated wiki unless `--force` is set.

`almanac absorb <inputs...>` maps to Absorb with bounded user-provided paths or source refs and defaults background. `almanac ingest <inputs...>` is an alias for the same command path.

`almanac sync` is the scheduler-owned automatic session-memory entry point. It scans Claude and Codex transcript stores, applies the quiet-window rule, maps transcript cwd values to repos with `.almanac/`, reconciles `.almanac/jobs/sync-ledger.json`, and starts ordinary background Absorb jobs for eligible continuations. `almanac sync status` runs the same discovery and cursor evaluation without enqueueing jobs.

[[ingest-operation]] records the absorb/ingest input contract, including local paths, GitHub PR or issue refs, GitHub PR or issue URLs, and generic HTTP(S) URLs.

`almanac garden` maps to Garden and defaults background because it can make broad graph edits.

`almanac review` is a deterministic edit command over `.almanac/review.yaml`, not an AI lifecycle command. `review add` records an open Markdown review item, `review decide` records the human decision, `review apply` records that an agent applied the decision to the wiki, and `review reopen` returns a decided or applied item to open. `review list` defaults to open items and supports `--status open|decided|applied|all`; `review show` and `review list` support JSON for agents and future viewer APIs. The command belongs beside edit commands because it writes wiki source state, but it does not itself edit pages or run an agent.

## Command source layout

The 2026-05-30 command-folder refactor set a concrete source-layout rule for `src/cli/commands/`. Small single-file commands stay as `src/cli/commands/<command>.ts`. Multi-file commands use `src/cli/commands/<command>/index.ts` as the public command entrypoint, with command-private helpers beside it. The current examples are `[[src/cli/commands/doctor/index.ts]]`, `[[src/cli/commands/health/index.ts]]`, `[[src/cli/commands/setup/index.ts]]`, and `[[src/cli/commands/topics/index.ts]]`.

`src/cli/commands/` is the terminal CLI surface, not the owner of every user-facing surface. `[[src/cli/commands/serve.ts]]` stays a thin command wrapper that starts the viewer, while the local browser surface remains under `[[src/viewer/]]`. Shared read models should move to shared query modules when both CLI commands and the viewer need them, as `[[src/wiki/query/page-view.ts]]` already does for page views.

## Shared flags

`--using <provider[/model]>` overrides the configured provider/model for one run. Without it, command handling reads the configured default provider/model. `--foreground` keeps absorb, ingest, and garden attached. `--background` detaches init. `--json` is for background start responses and cannot be combined with foreground streaming. Attached lifecycle runs are quiet by default: they print the final `started` or `finished` line, while live agent text/tool activity is only streamed when `--verbose` is passed. `almanac init` is the one attached command with an extra UX line: it prints `Analyzing codebase... This usually takes 5-10 minutes.` before the build begins and recommends `almanac serve` after a successful foreground build.

## Viewer command

`almanac serve` starts a local read-only HTTP viewer for the wiki. It is not an AI lifecycle command — it runs no agent, writes no pages, and makes no AI calls. It is a pure query command over the same `index.db` and `pages/*.md` data the CLI already uses. See [[almanac-serve]] for the full implementation, routes, and design rationale.

## Jobs commands

`almanac jobs`, `jobs show`, `jobs logs`, `jobs attach`, and `jobs cancel` are pure process-inspection commands over `.almanac/jobs/`, with legacy `.almanac/runs/` records still readable. They do not run AI and do not read or write wiki page content except through normal job records and logs.

## Automation commands

`almanac automation install|status|uninstall` manages macOS launchd jobs for known scheduled tasks: sync, Garden, and update. Sync runs `almanac sync --quiet 45m` every 5h by default; Garden runs `almanac garden` every 4h by default; update runs `almanac update` every 1d by default. `automation install --every <duration> --quiet <duration>` customizes the default sync install, `--garden-every <duration>` customizes Garden cadence, and positional task selection handles explicit operations such as `almanac automation install update --every 1d`, `almanac automation status update`, and `almanac automation uninstall update`. Direct automation installs write absolute `ProgramArguments` for the current Node executable plus the resolved `dist/codealmanac.js` entrypoint, and the Garden plist records the nearest wiki root as `WorkingDirectory` so scheduled `almanac garden` resolves the intended `.almanac/` graph. Setup adds one extra rule for ephemeral `npx` launches: it installs automation only after a durable global install succeeds, and in that case writes `/usr/bin/env almanac ...` task commands instead of pinning launchd to the transient cache path.

The install command also establishes the sync activation cursor. On first install it writes `automation.sync_since` to `~/.almanac/config.toml`; future sync runs skip transcripts whose mtime is before that timestamp. Reinstalling automation preserves the existing timestamp so rerunning setup repairs the scheduler without redefining what historical transcript material is in scope. The config write now runs legacy config migration first, so introducing `automation.sync_since` does not clobber older JSON-based agent settings.

Setup now builds a setup plan before running install steps. Default onboarding installs CLI self-update and the global Claude/Codex instruction surfaces described in [[global-agent-instructions]], but it does not install sync/Garden automation and it does not ask about auto-commit. `--sync-every <duration>`, `--sync-quiet <duration>`, `--garden-every <duration>`, and `--garden-off` are explicit compatibility gates that install sync/Garden automation from setup; the normal manual path remains `almanac automation install`. Interactive setup asks "Keep the Almanac CLI updated automatically?" with default yes, and unattended `setup --yes` uses the same yes default unless `--skip-automation` is present. `--skip-automation` disables all scheduled setup tasks, including CLI self-update. Auto-commit is a separate source-control boundary from scheduling: `defaultConfig().auto_commit` is false, `setup --yes` preserves that default, `--auto-commit` opts in, and `--no-auto-commit` or `almanac config set auto_commit false` opt out. Existing `auto_commit = true` config remains true unless explicitly disabled. When both `--skip-automation` and `--skip-guides` are passed, `runSetup()` short-circuits before rendering the setup banner and prints only `almanac: nothing to install — use --help to see what setup does`.

Bare `codealmanac` setup has one extra install-path rule captured in [[install-time-node-launcher]]. If setup starts from an `npx` or other non-global package root, `src/platform/install/global.ts` upgrades or reuses the durable global install and reruns `setup` from that package's `dist/launcher.js`. That keeps setup and later interactive CLI invocations on the same pinned Node runtime instead of letting SQLite behavior depend on whichever `node` happens to resolve later from `PATH`.

Setup and uninstall still run private legacy-hook cleanup before touching scheduler state. That cleanup is intentionally shape-aware: it removes CodeAlmanac-owned `almanac-capture.sh` commands across provider-era event names such as `SessionEnd`, `Stop`, and `sessionEnd`, then drops empty wrapper objects and empty hook containers so historical hook files are actually healed rather than left with dead scaffolding.

One debugging lesson from the 2026-05-12 launchd smoke tests is worth preserving alongside that cleanup contract: if "scheduled automation" appears to be spawning more jobs than the configured sweep cadence should allow, check for multiple capture mechanisms before blaming launchd. The observed duplicate-job burst came from two active sources at once: scheduled sweeps plus still-installed legacy hooks.

There is one implementation wrinkle worth remembering: setup, automation, agents, config, update, doctor, and uninstall are also wired through the sqlite-free fast path in [[src/cli/sqlite-free.ts]], before the full Commander CLI and SQLite-backed query stack are initialized. That is why recovery and install-management commands still work when a local or global install cannot load `better-sqlite3`, but it also means some flag parsing is custom code in that fast path. The 2026-05-11 review originally found that a bare `almanac automation install --every` could silently fall back to the default 5h interval; the implementation now validates that case explicitly and applies the same care to the quiet-window flag path.

The 2026-05-13 merge of `v1` into `dev` preserved one extra invariant: new setup and automation flags added on `dev` must be carried into the extracted sqlite-free module, not only into Commander registration. That includes `--no-auto-commit`, `--sync-every`, `--sync-quiet`, `--garden-every`, `--garden-off`, `--auto-update`, `--auto-update-every`, positional automation task IDs such as `update`, equals-style values such as `--sync-quiet=1m`, and launcher-preserved invocation behavior for `codealmanac` setup.

## Removed public paths

`almanac bootstrap` is not part of the V1 public CLI. `capture status` and `ps` were rerouted to the jobs surface with deprecation warnings during the V1 cleanup.

`almanac hook ...` was removed from the public CLI. Automatic capture is scheduler-only: setup offers scheduled automatic capture directly, while `almanac automation ...` remains available for explicit scheduler management.
