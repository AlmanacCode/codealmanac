---
title: Capture Flow
topics: [agents, flows]
files:
  - src/commands/operations.ts
  - src/commands/session-transcripts.ts
  - src/operations/absorb.ts
  - prompts/operations/absorb.md
  - src/commands/hook.ts
---

# Capture Flow

`almanac capture` is the session-ingest command for the V1 Absorb operation. It resolves one or more coding-session transcript files, builds command context, and calls [[wiki-lifecycle-operations]] with `targetKind: "session"`. The operation then runs through [[process-manager-runs]] and [[harness-providers]] like every other AI write path.

The old hardcoded writer/reviewer capture pipeline was removed. There is no `prompts/writer.md`, `prompts/reviewer.md`, `src/commands/capture.ts`, `src/agent/sdk.ts`, or capture-specific `StreamingFormatter` in V1. Old root-level `.capture-*.log` provider logs were replaced by [[process-manager-runs]] JSON/JSONL records; the SessionEnd hook can still write short `.capture-<session>.hook.log` sidecar files under `.almanac/runs/`.

## Transcript resolution

Resolution lives in `src/commands/session-transcripts.ts` before Absorb starts:

- Explicit transcript file args are validated and passed through.
- No-arg capture defaults to Claude transcript discovery.
- `--session <id>` finds a matching Claude `<id>.jsonl`.
- `--since`, `--limit`, and `--all` filter Claude discovery.
- Codex/Cursor discovery and `--all-apps` still fail clearly unless transcript files are provided.

## Absorb execution

Capture appends session-file context to `prompts/operations/absorb.md` through [[operation-prompts]]. `src/operations/absorb.ts` requests read, write, edit, search, and shell tools, sets `metadata.operation = "absorb"`, and defaults to background execution unless `--foreground` is passed.

Provider-specific behavior is adapter-owned. Claude may support helper agents through [[harness-providers]], but Capture no longer hardcodes a reviewer subagent or a capture-only SDK wrapper.

## No-op captures

Capture can produce no page changes if the transcript does not meet the notability bar. In V1 the observable record is a completed run with zero created, updated, and archived pages in `.almanac/runs/`.

## Log files

Raw provider events are normalized and written to `.almanac/runs/<run-id>.jsonl`. Run status, target paths, provider/model, PID, summary counts, and errors live in `.almanac/runs/<run-id>.json`.
