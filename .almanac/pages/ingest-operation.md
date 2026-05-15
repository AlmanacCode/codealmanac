---
title: Ingest Operation
summary: "`almanac ingest` runs Absorb over user-supplied files or folders after a wiki already exists."
topics: [agents, flows, cli]
files:
  - src/commands/operations.ts
  - src/operations/absorb.ts
  - prompts/operations/absorb.md
sources:
  - /Users/kushagrachitkara/.codex/sessions/2026/05/12/rollout-2026-05-12T23-28-12-019e2005-80c2-71e3-9dd2-564acda0410a.jsonl
status: active
verified: 2026-05-13
---

# Ingest Operation

`almanac ingest <file-or-folder>` is the manual entry point for running [[wiki-lifecycle-operations]] Absorb over bounded user-provided context. It is not a separate operation kind in the runtime layer; `src/commands/operations.ts` either resolves supplied filesystem paths to absolute paths and calls `runAbsorbOperation(...)` with `targetKind: "path"`, or routes connected Notion ingest with `targetKind: "connector:notion"`.

## What it is for

Ingest exists for "digest this specific context into the wiki" work:

- a doc, note, proposal, or ADR
- a folder of supporting materials
- non-session external artifacts that should inform project memory

This keeps the user-intent surface distinct:

- `almanac init` creates the first wiki from the repo as a whole.
- `almanac capture` absorbs coding-session transcripts.
- `almanac ingest` absorbs explicitly pointed-at files, folders, or connected-source material.

## Current contract

Unlike Build, ingest requires an existing `.almanac/`. `runAbsorbOperation` calls `findNearestAlmanacDir(options.cwd)` and throws `no .almanac/ found in this directory or any parent` if the wiki has not been initialized yet.

The command also requires at least one path. `runIngestCommand` returns `ingest requires at least one file or folder` before contacting any provider when `options.paths.length === 0`.

`runIngestCommand` resolves every supplied path against `options.cwd` before handing control to Absorb. The prompt context therefore names concrete absolute files or folders rather than preserving the user's original relative spellings.

The Notion path keeps the same Absorb boundary while changing the source shape. `runNotionIngestCommand()` builds a connector-specific source bundle, adds Notion guidance to the prompt context, and starts Absorb against the bundle's document URLs or ids instead of local filesystem paths. The public CLI still spells this as `almanac ingest notion ...`, not as a separate operation name.

By default ingest backgrounds the run, matching capture rather than init. `--foreground` keeps the agent attached, and `--json` is only valid for background start responses.

## Relationship to Build

The 2026-05-10 spreadsheet-corpus session clarified the product boundary between [[build-operation]] and ingest-like use cases. Build/init is framed as first-pass project memory for the current repository. That means a successful read of arbitrary files is not enough to guarantee page creation if the material does not naturally fit the "project memory" brief.

When the user's real intent is "absorb this bounded external corpus into an already-existing project wiki," ingest is the closer semantic fit because it explicitly routes through Absorb rather than Build.

## Verified smoke behavior

A 2026-05-13 Codex smoke test used a fresh external corpus folder with five menopause-related spreadsheets. `almanac init` first built an 11-page wiki from four Q&A workbooks. A second run then ingested the held-out fifth workbook, `Supplements for menopausal women.xlsx`, into that existing wiki.

The ingest run created one new entity page, `supplements-for-menopausal-women.md`, and also updated surrounding synthesis pages including corpus overview, inventory, schema/risk notes, taxonomy guidance, and the medical-versus-brand content boundary. The same run added a `supplement-content` topic and left `almanac health` at zero issues.

The same test also confirmed that ingest rewires retrieval surfaces, not just page counts. `almanac search --mentions './Supplements for menopausal women.xlsx'` returned zero pages before ingest and eight pages after ingest because the new page plus related synthesis pages now carried that file in their evidence trail.
