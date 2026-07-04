---
title: Lifecycle CLI
summary: The `codealmanac` CLI routes local wiki lifecycle work through foreground workflows, background lifecycle jobs, and deterministic query/admin commands.
topics:
  - cli
  - flows
  - agents
sources:
  - id: pyproject
    type: file
    path: pyproject.toml
    note: Defines the public `codealmanac` console script and private local trigger/worker console scripts.
  - id: root-parser
    type: file
    path: src/codealmanac/cli/parser/root.py
    note: Defines the public `codealmanac` program name and root command registration.
  - id: lifecycle-parser
    type: file
    path: src/codealmanac/cli/parser/lifecycle.py
    note: Defines public init and hidden worker command parsing.
  - id: dev-parser
    type: file
    path: src/codealmanac/cli/parser/dev.py
    note: Defines hidden developer ingest and garden lifecycle command parsing.
  - id: local-parser
    type: file
    path: src/codealmanac/cli/parser/local.py
    note: Defines local setup, trigger-policy, delivery-policy, and local runs command parsing.
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
  - id: capture-parser
    type: file
    path: src/codealmanac/cli/parser/capture.py
    note: Defines cloud conversation capture commands and the hidden capture-hook entrypoint.
  - id: release-verification
    type: file
    path: docs/codealmanac-launch/verification-matrix.md
    note: Records the Slice 89 and Slice 90 evidence that stale launch-facing sync, automation, local update, and local jobs commands are absent from the published 0.1.10 CLI.
status: active
verified: 2026-07-04
---

# Lifecycle CLI

The public program name is `codealmanac`. The CLI is an adapter over services and workflows: parsing builds request objects, dispatch calls the app composition root, renderers print results, and product behavior stays in workflows and services. The PyPI package also ships private `codealmanac-local-trigger` and `codealmanac-local-worker` console scripts for local branch-control plumbing; those names are executable integration points, not user-facing root subcommands. [@root-parser] [@pyproject]

[[lifecycle-architecture]] is the reading map for the surrounding workflow, harness, and job-ledger pages. [[process-manager-runs]] owns the repo-local lifecycle job ledger that background CLI commands create and that hidden jobs inspection commands read. [[pypi-package-surface]] records the published package and release-smoke contract for this command surface.

## Write-Capable Commands

`codealmanac init` initializes a local Almanac wiki. It accepts an optional path, configured root/name/description options, `--using`, foreground/background mode flags, `--force`, `--yes`, `--verbose`, `--guidance`, and background `--json`. Foreground init renders the finished job, wiki change count, and refreshed index summary; background init renders `job_id`, queued status, and worker PID. [@lifecycle-parser] [@lifecycle-rendering]

`codealmanac dev ingest` and `codealmanac dev garden` are hidden developer surfaces for local ingest and garden workflows. They share lifecycle options such as `--wiki`, `--using`, foreground/background mode, `--title`, `--guidance`, and background `--json`. These commands are not evidence for adding public `absorb`, `build`, or `garden` aliases outside the current runtime. [@dev-parser]

The hidden worker command `codealmanac __run-worker` drains the repo-local lifecycle job queue. Branch-triggered local runs use the private package scripts `codealmanac-local-trigger` and `codealmanac-local-worker` instead of hidden root CLI subcommands. [@lifecycle-parser] [@pyproject] [@release-verification]

`codealmanac capture status|enable|repair|disable` manages cloud conversation capture. It is not the old repo-local scheduled `sync` command surface; launch release verification requires root help to omit stale `sync` and root scheduled `automation` language. [@capture-parser] [@release-verification]

`codealmanac local setup`, `local triggers`, `local delivery`, and `local runs` manage branch-triggered local execution for this checkout. Current local execution/history lives under `local runs`; `local update` and `local jobs` are stale launch-era spellings and must not reappear in launch-facing help. [@local-parser] [@release-verification]

## Jobs Commands

`codealmanac jobs`, `jobs show <job-id>`, `jobs logs <job-id>`, `jobs attach <job-id>`, and `jobs cancel <job-id>` are hidden admin inspection commands over lifecycle job records. They dispatch to `app.jobs`, render `job_id`, and do not run AI or write wiki page prose. [@jobs-parser] [@jobs-dispatch] [@jobs-rendering]

`jobs attach` streams job log events until a job reaches a terminal status. `jobs cancel` marks queued or running lifecycle jobs cancelled through the job ledger; it is not the cancellation surface for hosted/cloud runs. [@jobs-dispatch] [@jobs-rendering]

## Read And Organization Commands

`codealmanac search`, `show`, `topics`, `health`, `reindex`, `serve`, `tag`, `untag`, and `list` are deterministic local wiki commands. They may refresh derived index state or rewrite explicit metadata through organization verbs, but they do not invoke AI or write page prose. [@wiki-parser]

`codealmanac serve` starts the local read-only viewer. It reads wiki pages, index state, topics, backlinks, and lifecycle job data; it is not a lifecycle execution command.

## Boundary Rule

When adding CLI behavior, keep the CLI as an adapter. Public command names should express product intent, while internal naming follows the owning subsystem: repo-local lifecycle records are jobs, cloud/local trigger executions are runs, and query commands remain deterministic over committed wiki files plus derived local index state. Release verification should exercise the installed package whenever command names, console scripts, or launch-facing help change. [@release-verification]
