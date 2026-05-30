---
title: Ingest Operation
summary: "`almanac ingest` runs Absorb over bounded user-supplied context, with source-address ingest planned as the local GitHub validation path."
topics: [agents, flows, cli]
sources:
  - id: operations-command
    type: file
    path: src/commands/operations.ts
    note: Implements `runIngestCommand`, path resolution, ingest prompt context, and Absorb invocation.
  - id: absorb-operation
    type: file
    path: src/operations/absorb.ts
    note: Defines the Absorb operation execution path used by ingest.
  - id: absorb-prompt
    type: file
    path: prompts/operations/absorb.md
    note: Defines the wiki-writing contract that ingest routes through.
  - id: spreadsheet-session
    type: conversation
    path: /Users/kushagrachitkara/.codex/sessions/2026/05/12/rollout-2026-05-12T23-28-12-019e2005-80c2-71e3-9dd2-564acda0410a.jsonl
    note: Records the spreadsheet-corpus smoke test that verified ingest updates retrieval surfaces.
  - id: connector-session
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T18-27-05-019e70e9-b7d7-7900-9fc0-da2a6f0b532d.jsonl
    note: Records the source-address ingest discussion that chose local GitHub ingest before a hosted GitHub App and `gh` before Composio for the local MVP.
status: active
verified: 2026-05-13
---

# Ingest Operation

`almanac ingest <file-or-folder>` is the manual entry point for running [[wiki-lifecycle-operations]] Absorb over bounded user-provided context. It is not a separate operation kind in the runtime layer; `src/commands/operations.ts` resolves the supplied paths to absolute paths, builds ingest-specific context text, and then calls `runAbsorbOperation(...)` with `targetKind: "path"` and the normal Absorb writing prompt. [@operations-command] [@absorb-operation] [@absorb-prompt]

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

`runIngestCommand` resolves every supplied path against `options.cwd` before handing control to Absorb. The prompt context therefore names concrete absolute files or folders rather than preserving the user's original relative spellings.

By default ingest backgrounds the run, matching capture rather than init. `--foreground` keeps the agent attached, and `--json` is only valid for background start responses. [@operations-command]

## Source-Aware Direction

The connector-facing direction is to extend `ingest` for addressable external sources rather than introduce `absorb` as a public command. The local v1 form `almanac ingest github:pr:123` parses a stable `SourceRef`, lets a GitHub resolver produce a small `Source` fact object, renders source-specific prompt guidance in `ingestContext()`, and then runs the same Absorb operation against the current working tree. [@connector-session]

That direction belongs to [[evidence-bundles]]. Path ingest remains the right shape for files, folders, transcripts, research notes, and local exports that already exist on disk. Source-aware ingest is for pull requests, issues, git ranges, and future connector objects whose useful context comes from an addressable external system rather than a path the user already has on disk. [@connector-session]

The first local GitHub plan is intentionally narrower than the hosted connector architecture. It supports `github:pr:123`, infers the repository from the current git remote, checks that the GitHub CLI exists, and renders a GitHub PR command-context block for Absorb. The agent then uses `gh` during the run to inspect the pull request, diff, comments, linked issues, code, and existing wiki pages. That v1 path does not require issue ingest, a hosted GitHub App, webhooks, cloud queue, Composio account, Almanac-managed OAuth app, PAT storage inside Almanac, Octokit dependency, run-local source artifact, or source dedupe key. [@connector-session]

The local `gh` choice is a product boundary, not a rejection of connector runtimes. GitHub is common enough in developer environments that `gh auth login` is the lightest local setup; Composio remains a candidate runtime for non-GitHub connectors, advanced bring-your-own-key local experiments, and hosted or paid team products where Almanac owns the connector account and can cover the cost. [@connector-session]

The v1 source split is deliberately small: `SourceRef` is syntax, and `Source` is resolved fact data for prompt rendering. `SourceRef` parses the user's string, for example `github:pr:123`, into provider, kind, and id without doing repository lookup, authentication, prompt construction, shell commands, or wiki judgment. The GitHub resolver takes that ref, detects owner and repo from the local git remote, checks `gh` availability, and builds a `Source` with kind, raw ref, repository, URL, and PR number. `ingestContext()` renders those facts into Absorb command context; the `Source` itself does not carry a pre-rendered prompt, fetch PR content, or decide whether the source is notable. [@connector-session]

Missing or unauthenticated `gh` should be a clear setup error rather than an auto-install path. The preferred missing-binary message is a short set of steps: install GitHub CLI from `https://cli.github.com/`, run `gh auth login`, then rerun the same `almanac ingest github:pr:123` command. If `gh` exists but auth fails, the error should tell the user to run `gh auth login` and retry. [@connector-session]

## Relationship to Build

The 2026-05-10 spreadsheet-corpus session clarified the product boundary between [[build-operation]] and ingest-like use cases. Build/init is framed as first-pass project memory for the current repository. That means a successful read of arbitrary files is not enough to guarantee page creation if the material does not naturally fit the "project memory" brief.

When the user's real intent is "absorb this bounded external corpus into an already-existing project wiki," ingest is the closer semantic fit because it explicitly routes through Absorb rather than Build. [@spreadsheet-session]

## Verified smoke behavior

A 2026-05-13 Codex smoke test used a fresh external corpus folder with five menopause-related spreadsheets. `almanac init` first built an 11-page wiki from four Q&A workbooks. A second run then ingested the held-out fifth workbook, `Supplements for menopausal women.xlsx`, into that existing wiki. [@spreadsheet-session]

The ingest run created one new entity page, `supplements-for-menopausal-women.md`, and also updated surrounding synthesis pages including corpus overview, inventory, schema/risk notes, taxonomy guidance, and the medical-versus-brand content boundary. The same run added a `supplement-content` topic and left `almanac health` at zero issues.

The same test also confirmed that ingest rewires retrieval surfaces, not just page counts. `almanac search --mentions './Supplements for menopausal women.xlsx'` returned zero pages before ingest and eight pages after ingest because the new page plus related synthesis pages now carried that file in their evidence trail. [@spreadsheet-session]
