---
title: Process Manager Runs
summary: The process manager is the durable run-recording layer for Build, Absorb, and Garden, including background spawn, event logs, page snapshots, and jobs inspection.
topics: [systems, storage, cli, agents]
files:
  - src/process/manager.ts
  - src/process/background.ts
  - src/process/records.ts
  - src/process/logs.ts
  - src/process/snapshots.ts
  - src/process/spec.ts
  - src/process/types.ts
  - src/harness/providers/claude.ts
  - src/commands/jobs.ts
  - src/viewer/jobs.ts
  - viewer/jobs-view.js
  - viewer/jobs.css
sources:
  - /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T18-27-05-019e70e9-b7d7-7900-9fc0-da2a6f0b532d.jsonl
verified: 2026-05-29
---

# Process Manager Runs

The process manager owns Almanac job lifecycle for every write-capable AI operation. Build, Absorb, and Garden produce an `AgentRunSpec`; the process manager records a run, executes or spawns it, logs normalized events, snapshots wiki pages, and reindexes after successful writes.

## Storage

Runs are per wiki under `.almanac/runs/`:

```text
.almanac/runs/<run-id>.json
.almanac/runs/<run-id>.jsonl
.almanac/runs/<run-id>.spec.json
.almanac/runs/<run-id>.cancel
```

The JSON record stores status, operation, provider, model, PID, target metadata, log path, timestamps, final summary counts, page changes, and errors. The JSONL file stores normalized `HarnessEvent` records from [[harness-providers]], including structured tool display details when an adapter can provide them. The spec file stores the serialized `AgentRunSpec` that the child process rehydrates, including the exact prompt string, cwd, provider/model selection, targets, and operation metadata. For capture debugging this file is the inspectable answer to "what prompt and transcript context were actually sent for this run." The optional cancel marker is a race guard so a queued cancellation cannot be overwritten during child startup. New wiki scaffolding gitignores `.almanac/runs/` and `.almanac/index.db`.

These run records are CodeAlmanac's canonical job transcript and audit record. Provider-owned Claude or Codex session history is secondary debug material and may be non-persistent for Almanac maintenance runs. The user-visible transcript feature belongs to `.almanac/runs/<run-id>.jsonl`, `almanac jobs logs <run-id>`, and the `almanac serve` jobs UI, not to the provider's own session store.

## Status lifecycle

Background starts write a `queued` record, initialize the JSONL log, persist the `AgentRunSpec`, and wake the repo-local worker with `__run-worker`. The worker owns the transition from `queued` to `running`: it acquires `.almanac/runs/worker.lock`, chooses the oldest queued run, rehydrates the saved spec, writes a running record with its PID, executes the provider, finalizes the record, and then drains the next queued run before releasing the lock. Duplicate worker wakeups are harmless because only the lock holder can claim queued runs.

Foreground runs do not bypass the single-writer invariant. They acquire the same worker lock before writing a started record and fail clearly if another operation is already running for the wiki. That keeps attached debugging runs from racing queued Build, Absorb, or Garden work.

Terminal statuses are `done`, `failed`, and `cancelled`. `jobs` can display `stale` when a running PID is no longer alive. The foreground manager re-reads the record before terminal writes; if a run was cancelled, finalization returns the cancelled record instead of resurrecting it as done or failed.

Maintenance operation specs set `providerSession.persistence = "ephemeral"`. Claude maps that to SDK `persistSession: false`, Codex app-server maps it to `thread/start.ephemeral`, and Codex exec maps it to `--ephemeral`. CodeAlmanac no longer injects internal transcript marker environment variables or scans provider transcript contents for those markers; the durable audit path is `.almanac/runs/`.

Claude harness runs install `SIGINT`, `SIGTERM`, and `SIGHUP` handlers around the SDK query and abort its `AbortController` when the job process is asked to stop. This is a normal-termination cleanup path for the Claude CLI and MCP children; `SIGKILL` can still leave no JavaScript cleanup opportunity.

Issue #10 remains a separate provider-process ownership risk from the single-writer queue. The queue reduces fan-out by serializing write-capable jobs per wiki, but it does not by itself prove that a killed CodeAlmanac job will terminate a provider CLI and any MCP children that the provider started. The hardening boundary is now `[[src/process/managed-child.ts]]`: provider adapters receive a managed child process and invoke `terminate()` on completion, timeout, cancellation, or signal handling. On POSIX systems the managed child uses an owned process group and escalates from `SIGTERM` to `SIGKILL`. A process-probe `EPERM` is treated as still alive but not currently signalable, not as proof that the group exited. Windows provider-process cleanup is intentionally unsupported until there is a tested implementation; the managed helper fails clearly on Windows instead of claiming unverified process-tree behavior.

## Single-writer queue

The 2026-05-28 capture-sweep incident exposed a broader run-lifecycle invariant than "one sweep should not enqueue duplicate Absorb work." The accepted architecture is a per-wiki single-writer queue for all write-capable Almanac jobs. Build, Absorb, and Garden enter the same repo-local queue, and a worker guarded by a wiki-local lock runs at most one job against that `.almanac/` directory at a time.

The queue boundary should be per wiki, not global to the machine. The shared correctness boundary is the wiki source tree, run records, index, review state, and git history under one repo; two unrelated repos do not need to block each other's maintenance jobs. A global machine lock would reduce concurrency for no correctness gain when repositories have separate `.almanac/` directories.

That decision generalizes the scheduled-capture guardrails. It prevents Absorb-vs-Absorb duplicate page creation, Absorb-vs-Garden file races, and scheduler bursts that start several write-capable LLM jobs for the same wiki. It also removes the need for `capture sweep --max-starts` as a race-prevention mechanism, because the sweep enqueues eligible work and lets the per-wiki worker serialize execution. If the product later needs a backlog cap, it should be explicit queue policy rather than a capture-specific concurrency flag.

The queue should reuse the existing process vocabulary instead of adding a parallel job taxonomy. `OperationKind` already names the semantic work type (`build`, `absorb`, `garden`), `AgentRunSpec` already serializes one executable operation run, and `RunRecord` already stores the durable lifecycle state (`queued`, `running`, `done`, `failed`, `cancelled`). New code in this area should extend names such as operation run, run record, queued run, and worker lock rather than introduce `WikiJobKind`, `WikiJobSpec`, or another synonym for the same concept.

The single-writer queue does not replace source provenance. Provider sessions for Almanac maintenance are non-persistent where providers support it, and `.almanac/runs/` remains the canonical user-visible audit record. The project deliberately removed old marker-based transcript exclusion instead of preserving hidden content heuristics for already-persisted provider transcripts.

## Snapshot accounting

The manager snapshots `.almanac/pages/*.md` before and after the harness run. `src/process/snapshots.ts` computes created, updated, archived, and deleted slug lists from page hashes and archive metadata. `src/process/manager.ts` writes those lists into `RunRecord.pageChanges` and derives the numeric `RunSummary` counts from the same delta. On success the manager runs the SQLite indexer; on failure it still records the event log, final error, summary counts, and page changes observed before finalization.

## Wiki-effect artifact design

A 2026-05-14 design discussion treated per-run page changes as a process-manager concern, not as special `jobs show` behavior. The current snapshot layer already has the right boundary because every write-capable Build, Absorb, and Garden run passes through it before terminal record finalization.

The implemented shape is a first-class run metadata contract that records the wiki effect of a run: created, updated, archived, and deleted page slugs, with optional richer summary or diff data later. The stable product question is "what did this run do to my wiki?", and page-level slugs answer that without forcing the CLI or viewer to recompute changes from live page files after the run.

The 2026-05-14 review tightened the storage boundary: store slug-level page changes in the JSON run record first, not in a sibling `.almanac/runs/<run-id>.changes.json` file. The JSON record is already the lifecycle source of truth, and a sibling changes file would need atomic coordination with terminal status, cancellation, cleanup, JSON output, and viewer detail loading. A later `changesPath` artifact is still plausible for full diffs or larger payloads, but the run record should carry the summary and artifact pointer if that layer appears.

The recommended contract is versioned run metadata:

```ts
pageChanges?: {
  version: 1;
  runId: string;
  created: string[];
  updated: string[];
  archived: string[];
  deleted: string[];
  summary?: string;
}
```

`summary` is the first meaningful line of the harness result, capped at 500 characters. Counts for `jobs show`, JSON output, capture automation, and the viewer are derived from the same snapshot delta that produces `pageChanges`, rather than from a second comparison path. Computing old changed slug sets on demand from current page files is not reliable because later runs can rewrite, archive, or delete the same pages after the before/after snapshots for the older run are gone.

Two review constraints protect that contract. If post-harness finalization fails after the page delta has been computed, the failed terminal record should still preserve `summary` and `pageChanges`; failed runs are one of the cases where operators most need to know what changed before the failure. Readers also need to validate `pageChanges` when present, including `version === 1`, `runId`, and all four slug arrays, because old records omit the field and malformed persisted metadata should not crash `jobs show` or the viewer.

## Jobs CLI

`almanac jobs` lists runs for the current wiki only. `jobs show <run-id>` reads one record. `jobs logs <run-id>` prints the JSONL log. `jobs attach <run-id>` tails until the run is terminal and renders structured tool events into concise status lines such as reading, searching, editing, and command execution. `jobs cancel <run-id>` sends `SIGTERM` when a PID is known and marks the record cancelled.

## Jobs viewer

`almanac serve` exposes the same run data through the local viewer API at `/api/jobs` (list) and `/api/jobs/:runId` (detail with JSONL events). See [[almanac-serve]] for the type shapes and polling design. The viewer uses `listRunRecords`, `readRunRecord`, `runRecordPath`, `runLogPath`, and `toRunView` from `src/process/index.ts` — no storage logic is duplicated. Jobs API logic (type definitions, display title/subtitle derivation, JSONL parsing, safe run-id validation) lives in `src/viewer/jobs.ts`; the frontend UI is split across `viewer/jobs-view.js` and `viewer/jobs.css`.

## Agent-thread attribution gap

Current JSONL run logs are mostly flat normalized harness events. They preserve useful `collabAgentToolCall` spawn/wait details, but ordinary messages and tool calls are not guaranteed to identify whether the root agent or a helper agent produced them. A raw Codex app-server probe confirmed that root and helper item notifications do carry `params.threadId`; Almanac currently drops that ownership when mapping to `HarnessEvent`. The same probe showed helper turns emit `turn/completed`, while the current Codex adapter finishes the whole run on any `turn/completed` without checking the root turn id. This makes subagent-heavy Codex runs hard to audit and can plausibly let a helper completion become the terminal run result.

A live Claude SDK probe confirmed a different provenance shape. Streamed Claude root messages use `parent_tool_use_id: null`; forwarded subagent messages carry `parent_tool_use_id` pointing at the parent `Agent` tool call, and the SDK can list/read concrete subagent transcripts with `listSubagents(sessionId)` and `getSubagentMessages(sessionId, agentId)`. Claude hook and permission APIs also expose subagent ids, but ordinary streamed assistant/user messages do not include `agent_id` directly. The current Claude adapter drops `uuid`, `session_id`, and `parent_tool_use_id`, so Claude also has usable ownership signals that Almanac does not currently log.

The implementation now writes new run log lines as version-2 envelopes with `version`, `sequence`, `runId`, `actor`, and normalized `event` fields while preserving backwards-compatible reading for old `{timestamp, event}` and bare event logs. Codex app-server events use provider thread ids for root/helper attribution and ignore helper `turn/completed` notifications when deciding terminal run completion. Claude events use `parent_tool_use_id` as a derived helper actor id for forwarded subagent messages.

The jobs viewer API derives an agent tree and warnings from the event stream. It reports unknown actor events, unattributed or non-root terminal results, zero-page build runs, and MCP usage. `almanac serve` renders warnings and agent traces above the transcript, while the transcript still shows raw tool cards and status events.
