---
title: Ingest Operation
summary: "`almanac ingest` runs Absorb over user-supplied files or folders after a wiki already exists."
topics: [agents, flows, cli]
files:
  - src/commands/operations.ts
  - src/operations/absorb.ts
  - prompts/operations/absorb.md
status: active
verified: 2026-05-11
---

# Ingest Operation

`almanac ingest <file-or-folder>` is the manual entry point for running [[wiki-lifecycle-operations]] Absorb over bounded user-provided context. It is not a separate operation kind in the runtime layer; `src/commands/operations.ts` resolves the supplied paths to absolute paths, builds ingest-specific context text, and then calls `runAbsorbOperation(...)` with `targetKind: "path"`.

## What it is for

Ingest exists for "digest this specific context into the wiki" work:

- a doc, note, proposal, or ADR
- a folder of supporting materials
- non-session external artifacts that should inform project memory

This keeps the user-intent surface distinct:

- `almanac init` creates the first wiki from the repo as a whole.
- `almanac capture` absorbs coding-session transcripts.
- `almanac ingest` absorbs explicitly pointed-at files or folders.

## Current contract

Unlike Build, ingest requires an existing `.almanac/`. `runAbsorbOperation` calls `findNearestAlmanacDir(options.cwd)` and throws `no .almanac/ found in this directory or any parent` if the wiki has not been initialized yet.

The command also requires at least one path. `runIngestCommand` returns `ingest requires at least one file or folder` before contacting any provider when `options.paths.length === 0`.

By default ingest backgrounds the run, matching capture rather than init. `--foreground` keeps the agent attached, and `--json` is only valid for background start responses.

## Relationship to Build

The 2026-05-10 spreadsheet-corpus session clarified the product boundary between [[build-operation]] and ingest-like use cases. Build/init is framed as first-pass project memory for the current repository. That means a successful read of arbitrary files is not enough to guarantee page creation if the material does not naturally fit the "project memory" brief.

When the user's real intent is "absorb this bounded external corpus into an already-existing project wiki," ingest is the closer semantic fit because it explicitly routes through Absorb rather than Build.
