---
title: Capture Flow
topics: [agents, flows]
files:
  - src/commands/capture.ts
  - prompts/writer.md
  - prompts/reviewer.md
  - src/agent/sdk.ts
  - src/commands/hook.ts
---

# Capture Flow

`almanac capture` is the ongoing knowledge-maintenance path. It takes a Claude Code session transcript, runs a writer agent that reads the existing wiki and drafts page changes, and invokes a reviewer subagent that critiques against the wider graph. The writer applies the final versions. It is triggered automatically by [[sessionend-hook]] after each Claude Code session.

<!-- stub: fill in writer/reviewer prompt details, transcript resolution edge cases, and notability decisions as discovered -->

## Transcript resolution

Three resolution modes (first match wins):
1. Explicit path positional arg: `almanac capture /path/to/transcript.jsonl`
2. `--session <id>`: searches `~/.claude/projects/` for a file matching the session ID
3. Auto-resolve: finds the most recent transcript under `~/.claude/projects/` whose `cwd` field matches the current repo

## Writer agent

Loads `prompts/writer.md`. Allowed tools include Read/Write/Edit/Glob/Grep/Bash plus the `Agent` tool to invoke the reviewer subagent. The writer reads existing pages via `almanac show` (Bash tool), drafts additions or edits, then calls the reviewer as a subagent. The writer decides what to incorporate from the reviewer's text critique and writes the final pages directly — no proposal JSON, no `--apply` step.

## Reviewer subagent

Defined as an `AgentDefinition` passed in the `agents: { reviewer }` map to `runAgent`. Loaded from `prompts/reviewer.md`. The reviewer reads across the graph, flags: duplicates, missing wikilinks, missing topic assignments, inference dressed as fact, cohesion problems. Returns a text critique; the writer reads it and decides.

## No-op captures

Capture writes nothing if no session content meets the notability bar. Silence is a valid outcome; the absence of a git diff is the signal.

## Log files

Raw SDK messages are written to `.almanac/.capture-<timestamp>.log` (one JSON per line, grep-able). The log file is created before the agent starts so streaming begins immediately.

## Reuses StreamingFormatter

`capture.ts` imports `StreamingFormatter` from `bootstrap.ts` and calls `formatter.setAgent("writer")` so tool-use lines display `[writer] reading ...` not `[bootstrap] reading ...`.
