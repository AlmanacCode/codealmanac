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
    note: Automation install, uninstall, and status command flags.
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

Use the automation command when setup is already done or when you want to change scheduled tasks:

```bash
codealmanac automation install sync --every 5h
codealmanac automation install garden --garden-every 4h
codealmanac automation install update --every 24h
codealmanac automation status
```

The automation parser supports `install`, `uninstall`, and `status`. Each command can take zero or more task names from `sync`, `garden`, and `update`; install also accepts `--every`, `--garden-every`, and `--garden-off` [@automation-parser].

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
codealmanac automation uninstall sync garden update
```

The automation parser exposes task-scoped uninstall for that narrower cleanup [@automation-parser].
