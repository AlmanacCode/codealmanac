---
title: Lifecycle CLI
topics: [cli, flows, agents]
files:
  - src/cli/register-wiki-lifecycle-commands.ts
  - src/commands/operations.ts
  - src/commands/jobs.ts
  - src/commands/session-transcripts.ts
---

# Lifecycle CLI

The V1 lifecycle CLI routes write-capable wiki work into [[wiki-lifecycle-operations]] and [[process-manager-runs]]. Query and organization commands remain deterministic over the filesystem, [[global-registry]], and SQLite index; AI execution is limited to the lifecycle commands.

## Write-capable commands

`almanac init` maps to Build and defaults foreground. It refuses a populated wiki unless `--force` is set.

`almanac capture` maps to Absorb with coding-session transcript context and defaults background. Explicit transcript files work. Claude latest-session, `--session`, `--since`, `--limit`, and `--all` discovery are implemented; Codex/Cursor discovery and `--all-apps` still fail clearly unless transcript files are provided.

`almanac ingest <file-or-folder>` maps to Absorb with user-provided file/folder context and defaults background.

`almanac garden` maps to Garden and defaults background because it can make broad graph edits.

## Shared flags

`--using <provider[/model]>` overrides the configured provider/model for one run. Without it, command handling reads the configured default provider/model. `--foreground` keeps capture, ingest, and garden attached. `--background` detaches init. `--json` is for background start responses and cannot be combined with foreground streaming.

## Jobs commands

`almanac jobs`, `jobs show`, `jobs logs`, `jobs attach`, and `jobs cancel` are pure process-inspection commands over `.almanac/runs/`. They do not run AI and do not read or write wiki page content except through normal run records and logs.

## Removed public paths

`almanac bootstrap` is not part of the V1 public CLI. `capture status` and `ps` were rerouted to the jobs surface with deprecation warnings during the V1 cleanup.
