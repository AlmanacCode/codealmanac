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
    note: Defines `codealmanac init` lifecycle command parsing.
  - id: dev-parser
    type: file
    path: src/codealmanac/cli/parser/dev.py
    note: Defines hidden developer ingest and garden lifecycle command parsing.
  - id: capture-parser
    type: file
    path: src/codealmanac/cli/parser/capture.py
    note: Defines cloud capture commands, including `capture inspect` for recent local hook events.
  - id: local-parser
    type: file
    path: src/codealmanac/cli/parser/local.py
    note: Defines local branch trigger and local runs command parsing.
  - id: lifecycle-rendering
    type: file
    path: src/codealmanac/cli/render/lifecycle.py
    note: Renders foreground and background lifecycle results with job terminology.
  - id: project-scripts
    type: file
    path: pyproject.toml
    note: Defines the installed console scripts for the public CLI and private hook/worker entrypoints.
  - id: capture-hook-script
    type: file
    path: src/codealmanac/capture_hook.py
    note: Implements the private `codealmanac-capture-hook` console script.
  - id: job-worker-script
    type: file
    path: src/codealmanac/job_worker.py
    note: Implements the private `codealmanac-job-worker` console script that drains lifecycle jobs.
  - id: wiki-parser
    type: file
    path: src/codealmanac/cli/parser/wiki.py
    note: Defines deterministic local wiki read, topic, health, reindex, serve, and tagging commands.
  - id: cli-contract-tests
    type: file
    path: tests/test_cli.py
    note: Verifies public help hides removed compatibility commands and rejects old root worker/admin names.
status: active
verified: 2026-07-04
---

# Lifecycle CLI

The public program name is `codealmanac`. The CLI is an adapter over services and workflows: parsing builds request objects, dispatch calls the app composition root, renderers print results, and product behavior stays in workflows and services. [@root-parser]

[[lifecycle-architecture]] is the reading map for the surrounding workflow, harness, job-ledger, and local-run pages. [[process-manager-runs]] owns the repo-local lifecycle job ledger that background CLI commands create and that the local viewer reads.

## Write-Capable Commands

`codealmanac init` initializes a local Almanac wiki. It accepts an optional path, configured root/name/description options, `--using`, foreground/background mode flags, `--force`, `--yes`, `--verbose`, `--guidance`, and background `--json`. Foreground init renders the finished job, wiki change count, and refreshed index summary; background init renders `job_id`, queued status, and worker PID. [@lifecycle-parser] [@lifecycle-rendering]

`codealmanac dev ingest` and `codealmanac dev garden` are hidden developer surfaces for local ingest and garden workflows. They share lifecycle options such as `--wiki`, `--using`, foreground/background mode, `--title`, `--guidance`, and background `--json`. These commands are not evidence for adding public `absorb`, `build`, or `garden` aliases outside the current runtime. [@dev-parser]

Detached lifecycle jobs are drained by the private console script `codealmanac-job-worker`, not by a root `codealmanac __run-worker` subcommand. Branch-triggered local runs use the separate private `codealmanac-local-trigger` and `codealmanac-local-worker` scripts. [@project-scripts] [@job-worker-script] [@local-parser]

## Removed Compatibility Commands

`codealmanac jobs`, `codealmanac __capture-hook`, and `codealmanac __run-worker` are no longer accepted root parser commands. The root help also hides the old `sync`, root scheduled `automation`, and developer lifecycle surfaces. Tests pin this as a public contract because a hidden-but-accepted root command still becomes user-facing once an installed package can execute it. [@root-parser] [@cli-contract-tests]

The capture hook moved to the private `codealmanac-capture-hook` console script. Capture setup writes provider hooks that invoke that script, and `codealmanac capture inspect` is the public local inspection surface for recent hook events. [@project-scripts] [@capture-hook-script] [@capture-parser]

## Read And Organization Commands

`codealmanac search`, `show`, `topics`, `health`, `reindex`, `serve`, `tag`, `untag`, and `list` are deterministic local wiki commands. They may refresh derived index state or rewrite explicit metadata through organization verbs, but they do not invoke AI or write page prose. [@wiki-parser]

`codealmanac serve` starts the local read-only viewer. It reads wiki pages, index state, topics, backlinks, and lifecycle job data; it is not a lifecycle execution command.

## Boundary Rule

When adding CLI behavior, keep the CLI as an adapter. Public command names should express product intent, while internal naming follows the owning subsystem: repo-local lifecycle records are jobs, cloud/local trigger executions are runs, and query commands remain deterministic over committed wiki files plus derived local index state.

Private process entrypoints belong in package scripts when installed hooks or detached workers need to call them directly. Do not reintroduce private worker or hook verbs as hidden root `codealmanac` subcommands unless they are meant to become part of the executable root parser contract. [@project-scripts] [@cli-contract-tests]
