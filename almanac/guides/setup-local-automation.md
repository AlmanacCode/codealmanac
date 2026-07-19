---
title: Setup Local Automation
topics: [guides, setup, automation, telemetry]
sources:
  - id: readme
    type: file
    path: README.md
    note: User-facing setup, automation, sync, jobs, and runtime-state commands.
  - id: setup-parser
    type: file
    path: src/codealmanac/cli/parser/setup.py
    note: Setup and uninstall command flags.
  - id: automation-parser
    type: file
    path: src/codealmanac/cli/parser/automation.py
    note: Automation status command flags; the parser has no install or uninstall subcommand.
  - id: automation-service
    type: file
    path: src/codealmanac/services/automation/service.py
    note: reconcile_task installs or removes one scheduled task; remove_all removes every task during uninstall.
  - id: config-parser
    type: file
    path: src/codealmanac/cli/parser/config.py
    note: config set and config apply command syntax.
  - id: setup-service
    type: file
    path: src/codealmanac/services/setup/service.py
    note: Setup service behavior for instructions, config, automation, readiness, and uninstall.
  - id: setup-automation
    type: file
    path: src/codealmanac/services/setup/automation.py
    note: Default setup automation task selection and skip flags.
  - id: automation-defaults
    type: file
    path: src/codealmanac/services/automation/defaults.py
    note: Default sync, garden, and update intervals.
  - id: claude-transcripts
    type: file
    path: src/codealmanac/integrations/sources/transcripts/claude.py
    note: Discovers transcripts under ~/.claude/projects.
  - id: codex-transcripts
    type: file
    path: src/codealmanac/integrations/sources/transcripts/codex.py
    note: Discovers transcripts under ~/.codex/sessions.
  - id: opencode-transcripts
    type: file
    path: src/codealmanac/integrations/sources/transcripts/opencode.py
    note: Discovers OpenCode sessions from ~/.local/share/opencode/opencode.db.
  - id: automation-render
    type: file
    path: src/codealmanac/cli/render/automation.py
    note: Renders launchd run-health fields for automation status.
  - id: telemetry-architecture
    type: wiki
    path: architecture/telemetry
    note: Architecture page for telemetry event, opt-out, identity, and delivery boundaries.
---

# Setup Local Automation

Use this guide to install and verify CodeAlmanac's local scheduled work. Setup can install agent instructions, write the default runner and telemetry preferences, and install scheduled `sync`, `garden`, and `update` tasks [@setup-service] [@setup-automation]. Automation is local machine state, not cloud sync, and its scheduler logs live under `~/.codealmanac/logs/` [@readme]. When anonymous telemetry is enabled, scheduled entrypoints may send allowlisted command/lifecycle outcomes or sanitized unhandled exceptions, never wiki or transcript content [@telemetry-architecture].

The usual successful state is simple: setup has selected a runner, scheduled the tasks you want, `automation status` reports them installed, and `sync status` or `jobs` can show local lifecycle activity. For background, see [Automation and update](../architecture/setup/automation-and-update), [Config keys](../reference/config-keys), and [Run queue and sync](../architecture/lifecycle/run-queue-and-sync).

## Run Setup

For the default unattended setup, run:

```bash
codealmanac setup --yes
```

The README describes plain setup as installing local agent instructions plus the default local automation: sync, Garden, and daily package update [@readme]. In code, setup writes `auto_commit`, `harness.default`, and `harness.model` through the config service when config is available [@setup-service]. `auto_commit` is a prompt policy read by lifecycle operations, not a Python-side committer; see [Auto-commit is prompt policy](../decisions/auto-commit-is-prompt-policy) for what the flag actually controls.

Use flags to change the initial policy:

```bash
codealmanac setup --yes --runner claude
codealmanac setup --yes --sync-every 5h
codealmanac setup --yes --sync-off
codealmanac setup --yes --garden-off
codealmanac setup --yes --no-auto-update
codealmanac setup --yes --no-auto-commit
codealmanac setup --yes --no-telemetry
```

The setup parser exposes runner choice, auto-commit policy, instruction skipping, sync interval, sync disable, Garden interval, Garden disable, auto-update disable, and telemetry opt-out flags [@setup-parser]. Interactive setup asks about telemetry last with Yes recommended and No visible. Later, `codealmanac config set telemetry.enabled false`, `DO_NOT_TRACK=1`, or `CODEALMANAC_NO_TELEMETRY=1` disables all usage and exception capture [@telemetry-architecture]. See [Instruction installation](../architecture/setup/instruction-installation) for what gets written to a coding agent's global instructions when instructions are not skipped.

## Understand The Default Tasks

Setup's default automation task list is `sync`, `garden`, and `update` [@setup-automation]. Sync scans recent local agent transcripts, Garden improves wiki structure and graph hygiene, and update keeps the local CodeAlmanac CLI package updated [@setup-automation].

The default intervals are 5 hours for sync, 24 hours for Garden, and 1 day for update [@automation-defaults]. Setup removes tasks from the default list when `--sync-off`, `--garden-off`, or `--no-auto-update` is set [@setup-automation].

## Manage Automation Directly

The `automation` command is read-only: its only subcommand is `status`, optionally filtered to specific task names, with `--json` [@automation-parser]. There is no `automation install` or `automation uninstall` subcommand. To change scheduled tasks after setup, write config keys and reconcile:

```bash
codealmanac config set automation.sync.every 5h
codealmanac config set automation.garden.every 24h
codealmanac config set automation.update.every 24h
codealmanac automation status
```

`config set` writes one value to `~/.codealmanac/config.toml` and immediately reconciles that task's scheduled job through `AutomationService.reconcile_task`, which installs or removes the task's scheduler entry [@config-parser] [@automation-service]. Edit the file directly for multiple keys at once, then run `codealmanac config apply` to reconcile all three tasks against the file [@config-parser]. See [Config keys](../reference/config-keys) for the full `automation.<task>.enabled` and `automation.<task>.every` key set, defaults, and validation.

## Verify It Worked

Check the scheduler state:

```bash
codealmanac automation status
```

Each installed task reports whether launchd loaded it, whether it is currently
running or idle, how many times it has run, and the last exit result
[@automation-render]. See [Automation and update](../architecture/setup/automation-and-update)
for what each `ScheduledJobState` field means and when a nonzero exit code
warrants inspecting the task log under `~/.codealmanac/logs/`.

Then check sync and run activity:

```bash
codealmanac sync status --from codex
codealmanac sync status --from opencode
codealmanac jobs
```

The README presents `sync status`, `sync`, `automation status`, and `jobs` as the daily local surfaces for automation and lifecycle work [@readme]. If a scheduled run fails, inspect it with `codealmanac jobs show <run-id>` and `codealmanac jobs logs <run-id>`. Default `sync` / `sync status` without `--from` scans every registered transcript app (`claude`, `codex`, and `opencode`).

## Troubleshoot macOS Full Disk Access Prompts

Sync reads transcripts from `~/.claude/projects`, `~/.codex/sessions`, and OpenCode's SQLite store under `~/.local/share/opencode/opencode.db` [@claude-transcripts] [@codex-transcripts] [@opencode-transcripts], which macOS may treat as data owned by other apps. On macOS Sonoma and later, this can trigger a repeating "would like to access data from other apps" prompt for the launchd-scheduled `sync` job, because the prompt targets the exact executable that opened the files rather than CodeAlmanac as a concept.

Granting Full Disk Access to Codex, Terminal, or another parent app does not stop the prompt, because the scheduled job runs as its own process under the Python interpreter tied to the current install. Grant Full Disk Access (System Settings > Privacy & Security > Full Disk Access) to that specific interpreter or `codealmanac` executable, then re-apply automation:

```bash
codealmanac config apply
```

The tradeoff is that Full Disk Access applies to the whole interpreter, not narrowly to CodeAlmanac, since there is no dedicated signed CodeAlmanac binary that macOS can authorize on its own.

## Uninstall Local Artifacts

To remove CodeAlmanac-owned local artifacts, run:

```bash
codealmanac uninstall --yes
```

`SetupService.uninstall` removes installed instructions, scheduled automation, global state, and the package when the package uninstaller is available [@setup-service]. That call goes through `AutomationService.remove_all`, which uninstalls every task's scheduler entry [@automation-service]. To remove or disable scheduled jobs individually without a full uninstall, set the task's `enabled` key to `false` and let `config set` reconcile it immediately:

```bash
codealmanac config set automation.sync.enabled false
codealmanac config set automation.garden.enabled false
codealmanac config set automation.update.enabled false
```
