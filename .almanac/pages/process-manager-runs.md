---
title: Process Manager Runs
topics: [systems, storage, cli, agents]
files:
  - src/process/manager.ts
  - src/process/background.ts
  - src/process/records.ts
  - src/process/logs.ts
  - src/process/snapshots.ts
  - src/process/spec.ts
  - src/process/types.ts
  - src/commands/jobs.ts
  - src/viewer/jobs.ts
  - viewer/jobs-view.js
  - viewer/jobs.css
---

# Process Manager Runs

The process manager owns CodeAlmanac job lifecycle for every write-capable AI operation. Build, Absorb, and Garden produce an `AgentRunSpec`; the process manager records a run, executes or spawns it, logs normalized events, snapshots wiki pages, and reindexes after successful writes.

## Storage

Runs are per wiki under `.almanac/runs/`:

```text
.almanac/runs/<run-id>.json
.almanac/runs/<run-id>.jsonl
.almanac/runs/<run-id>.cancel
```

The JSON record stores status, operation, provider, model, PID, target metadata, log path, timestamps, final summary, and errors. The JSONL file stores normalized `HarnessEvent` records from [[harness-providers]], including structured tool display details when an adapter can provide them. The optional cancel marker is a race guard so a queued cancellation cannot be overwritten during child startup. New wiki scaffolding gitignores `.almanac/runs/` and `.almanac/index.db`.

## Status lifecycle

Background starts write a `queued` record before spawning a detached child. The child rehydrates the saved spec, transitions through foreground execution, and owns the terminal status. Foreground runs write a started record immediately and stream events to the optional observer while also appending them to JSONL.

Terminal statuses are `done`, `failed`, and `cancelled`. `jobs` can display `stale` when a running PID is no longer alive. The foreground manager re-reads the record before terminal writes; if a run was cancelled, finalization returns the cancelled record instead of resurrecting it as done or failed.

## Snapshot accounting

The manager snapshots `.almanac/pages/*.md` before and after the harness run. It computes created, updated, and archived counts from page hashes and archive metadata. On success it runs the SQLite indexer; on failure it still records the event log and final error but does not claim a successful reindex.

## Jobs CLI

`almanac jobs` lists runs for the current wiki only. `jobs show <run-id>` reads one record. `jobs logs <run-id>` prints the JSONL log. `jobs attach <run-id>` tails until the run is terminal and renders structured tool events into concise status lines such as reading, searching, editing, and command execution. `jobs cancel <run-id>` sends `SIGTERM` when a PID is known and marks the record cancelled.

## Jobs viewer

`almanac serve` exposes the same run data through the local viewer API at `/api/jobs` (list) and `/api/jobs/:runId` (detail with JSONL events). See [[almanac-serve]] for the type shapes and polling design. The viewer uses `listRunRecords`, `readRunRecord`, `runRecordPath`, `runLogPath`, and `toRunView` from `src/process/index.ts` — no storage logic is duplicated. Jobs API logic (type definitions, display title/subtitle derivation, JSONL parsing, safe run-id validation) lives in `src/viewer/jobs.ts`; the frontend UI is split across `viewer/jobs-view.js` and `viewer/jobs.css`.

## Agent-thread attribution gap

Current JSONL run logs are mostly flat normalized harness events. They preserve useful `collabAgentToolCall` spawn/wait details, but ordinary messages and tool calls are not guaranteed to identify whether the root agent or a helper agent produced them. A raw Codex app-server probe confirmed that root and helper item notifications do carry `params.threadId`; CodeAlmanac currently drops that ownership when mapping to `HarnessEvent`. The same probe showed helper turns emit `turn/completed`, while the current Codex adapter finishes the whole run on any `turn/completed` without checking the root turn id. This makes subagent-heavy Codex runs hard to audit and can plausibly let a helper completion become the terminal run result.

A live Claude SDK probe confirmed a different provenance shape. Streamed Claude root messages use `parent_tool_use_id: null`; forwarded subagent messages carry `parent_tool_use_id` pointing at the parent `Agent` tool call, and the SDK can list/read concrete subagent transcripts with `listSubagents(sessionId)` and `getSubagentMessages(sessionId, agentId)`. Claude hook and permission APIs also expose subagent ids, but ordinary streamed assistant/user messages do not include `agent_id` directly. The current Claude adapter drops `uuid`, `session_id`, and `parent_tool_use_id`, so Claude also has usable ownership signals that CodeAlmanac does not currently log.

The implementation now writes new run log lines as version-2 envelopes with `version`, `sequence`, `runId`, `actor`, and normalized `event` fields while preserving backwards-compatible reading for old `{timestamp, event}` and bare event logs. Codex app-server events use provider thread ids for root/helper attribution and ignore helper `turn/completed` notifications when deciding terminal run completion. Claude events use `parent_tool_use_id` as a derived helper actor id for forwarded subagent messages.

The jobs viewer API derives an agent tree and warnings from the event stream. It reports unknown actor events, unattributed or non-root terminal results, zero-page build runs, and MCP usage. `almanac serve` renders warnings and agent traces above the transcript, while the transcript still shows raw tool cards and status events.
