---
title: Lifecycle CLI
summary: The `codealmanac` CLI routes local wiki lifecycle work through foreground workflows, background lifecycle jobs, and deterministic query/admin commands.
topics:
  - cli
  - flows
  - agents
sources:
  - id: root-parser
    type: file
    path: src/codealmanac/cli/parser/root.py
    note: Defines the public `codealmanac` program name and root command registration.
  - id: lifecycle-parser
    type: file
    path: src/codealmanac/cli/parser/lifecycle.py
    note: Defines public init, hidden sync, hidden worker, and hidden local-trigger command parsing.
  - id: dev-parser
    type: file
    path: src/codealmanac/cli/parser/dev.py
    note: Defines hidden developer ingest and garden lifecycle command parsing.
  - id: jobs-parser
    type: file
    path: src/codealmanac/cli/parser/jobs.py
    note: Defines hidden jobs inspection commands with `job_id` arguments.
  - id: jobs-dispatch
    type: file
    path: src/codealmanac/cli/dispatch/jobs.py
    note: Dispatches jobs inspection commands to `app.jobs`.
  - id: lifecycle-rendering
    type: file
    path: src/codealmanac/cli/render/lifecycle.py
    note: Renders foreground and background lifecycle results with job terminology.
  - id: jobs-rendering
    type: file
    path: src/codealmanac/cli/render/jobs.py
    note: Renders job records, logs, attach streams, and cancellation results.
  - id: wiki-parser
    type: file
    path: src/codealmanac/cli/parser/wiki.py
    note: Defines deterministic local wiki read, topic, health, reindex, serve, and tagging commands.
  - id: automation-parser
    type: file
    path: src/codealmanac/cli/parser/automation.py
    note: Defines local scheduled automation install, status, and uninstall commands.
status: active
verified: 2026-07-03
---

# Lifecycle CLI

The public program name is `codealmanac`. The CLI is an adapter over services and workflows: parsing builds request objects, dispatch calls the app composition root, renderers print results, and product behavior stays in workflows and services. [@root-parser]

[[lifecycle-architecture]] is the reading map for the surrounding workflow, harness, job-ledger, and automation pages. [[process-manager-runs]] owns the repo-local lifecycle job ledger that background CLI commands create and that jobs inspection commands read.

## Write-Capable Commands

`codealmanac init` initializes a local Almanac wiki. It accepts an optional path, configured root/name/description options, `--using`, foreground/background mode flags, `--force`, `--yes`, `--verbose`, `--guidance`, and background `--json`. Foreground init renders the finished job, wiki change count, and refreshed index summary; background init renders `job_id`, queued status, and worker PID. [@lifecycle-parser] [@lifecycle-rendering]

`codealmanac sync` is hidden but remains the scheduler-facing transcript sync entry point. Its status subcommand is read-only; its syncing path can queue lifecycle ingest jobs and renders started work by `job_id`. [@lifecycle-parser] [@lifecycle-rendering]

`codealmanac dev ingest` and `codealmanac dev garden` are hidden developer surfaces for local ingest and garden workflows. They share lifecycle options such as `--wiki`, `--using`, foreground/background mode, `--title`, `--guidance`, and background `--json`. These commands are not evidence for adding public `absorb`, `build`, or `garden` aliases outside the current runtime. [@dev-parser]

The hidden worker command `codealmanac __run-worker` drains the repo-local lifecycle job queue. The hidden local-worker and local-trigger commands belong to branch-triggered local runs, not to the lifecycle job ledger. [@lifecycle-parser]

## Jobs Commands

`codealmanac jobs`, `jobs show <job-id>`, `jobs logs <job-id>`, `jobs attach <job-id>`, and `jobs cancel <job-id>` are hidden admin inspection commands over lifecycle job records. They dispatch to `app.jobs`, render `job_id`, and do not run AI or write wiki page prose. [@jobs-parser] [@jobs-dispatch] [@jobs-rendering]

`jobs attach` streams job log events until a job reaches a terminal status. `jobs cancel` marks queued or running lifecycle jobs cancelled through the job ledger; it is not the cancellation surface for hosted/cloud runs. [@jobs-dispatch] [@jobs-rendering]

## Read And Organization Commands

`codealmanac search`, `show`, `topics`, `health`, `reindex`, `serve`, `tag`, `untag`, and `list` are deterministic local wiki commands. They may refresh derived index state or rewrite explicit metadata through organization verbs, but they do not invoke AI or write page prose. [@wiki-parser]

`codealmanac serve` starts the local read-only viewer. It reads wiki pages, index state, topics, backlinks, and lifecycle job data; it is not a lifecycle execution command.

## Automation Commands

`codealmanac automation install|status|uninstall` manages scheduled local sync and garden tasks. Automation owns scheduled invocation; it does not own transcript eligibility, lifecycle job storage, provider execution, or wiki-writing judgment. [@automation-parser]

## Boundary Rule

When adding CLI behavior, keep the CLI as an adapter. Public command names should express product intent, while internal naming follows the owning subsystem: repo-local lifecycle records are jobs, cloud/local trigger executions are runs, and query commands remain deterministic over committed wiki files plus derived local index state.
