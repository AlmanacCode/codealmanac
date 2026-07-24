---
title: Setup Local Automation
topics: [guides, setup, automation]
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
    note: Automation status command and task filters.
  - id: config-parser
    type: file
    path: src/codealmanac/cli/parser/config.py
    note: Config set and apply command flags.
  - id: config-service
    type: file
    path: src/codealmanac/services/config/service.py
    note: User config writes and automation reconciliation behavior.
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
---

# Setup Local Automation

Use this guide to install and verify CodeAlmanac's local scheduled work. Setup can install agent instructions, write the default runner config, and install scheduled `sync`, `garden`, and `update` tasks [@setup-service] [@setup-automation]. Automation is local machine state, not cloud sync, and its scheduler logs live under `~/.codealmanac/logs/` [@readme].

The usual successful state is simple: setup has selected a runner, scheduled the tasks you want, `automation status` reports them installed, and `sync status` or `jobs` can show local lifecycle activity. For background, see [Automation and update](../architecture/setup/automation-and-update), [Config keys](../reference/config-keys), and [Run queue and sync](../architecture/lifecycle/run-queue-and-sync).

## Run Setup

For the default unattended setup, run:

```bash
codealmanac setup --yes
```

The README describes plain setup as installing local agent instructions plus the default local automation: sync, Garden, and daily package update [@readme]. In code, setup writes `auto_commit`, `harness.default`, and `harness.model` through the config service when config is available [@setup-service].

Use flags to change the initial policy:

```bash
codealmanac setup --yes --runner claude
codealmanac setup --yes --sync-every 5h
codealmanac setup --yes --sync-off
codealmanac setup --yes --garden-off
codealmanac setup --yes --no-auto-update
```

The setup parser exposes runner choice, auto-commit policy, instruction skipping, sync interval, sync disable, Garden interval, Garden disable, and auto-update disable flags [@setup-parser].

## Understand The Default Tasks

Setup's default automation task list is `sync`, `garden`, and `update` [@setup-automation]. Sync scans recent local agent transcripts, Garden improves wiki structure and graph hygiene, and update keeps the local CodeAlmanac CLI package updated [@setup-automation].

The default intervals are 5 hours for sync, 4 hours for Garden, and 1 day for update [@automation-defaults]. Setup removes tasks from the default list when `--sync-off`, `--garden-off`, or `--no-auto-update` is set [@setup-automation].

## Manage Automation Directly

Use config commands when setup is already done and you want to change scheduled tasks:

```bash
codealmanac config set automation.sync.every 5h
codealmanac config set automation.garden.every 4h
codealmanac config set automation.update.every 24h
codealmanac config set automation.garden.enabled false
```

The automation command is status-only. It accepts `status`, optional task filters from `sync`, `garden`, and `update`, and `--json` [@automation-parser]. Scheduled task changes belong to the config surface: `config set` accepts `automation.<task>.enabled` and `automation.<task>.every` keys, while `config apply` reconciles the saved user config with machine automation [@config-parser] [@config-service].

`ConfigService.set` immediately reconciles the touched automation task when the changed key belongs to `automation.sync`, `automation.garden`, or `automation.update` [@config-service]. Use `codealmanac config apply` when you want to reconcile all saved automation settings without changing a key [@config-service].

## Verify It Worked

Check the scheduler state:

```bash
codealmanac automation status
```

Then check sync and run activity:

```bash
codealmanac sync status --from codex
codealmanac jobs
```

The README presents `sync status`, `sync`, `automation status`, and `jobs` as the daily local surfaces for automation and lifecycle work [@readme]. If a scheduled run fails, inspect it with `codealmanac jobs show <run-id>` and `codealmanac jobs logs <run-id>`.

## Uninstall Local Artifacts

To remove CodeAlmanac-owned local artifacts, run:

```bash
codealmanac uninstall --yes
```

`SetupService.uninstall` removes installed instructions, scheduled automation, global state, and the package when the package uninstaller is available [@setup-service]. Use direct automation removal when you only want to remove scheduled jobs:

```bash
codealmanac config set automation.sync.enabled false
codealmanac config set automation.garden.enabled false
codealmanac config set automation.update.enabled false
```

Those config writes reconcile the affected tasks through the automation service without removing instructions, global state, or the installed package [@config-service].
