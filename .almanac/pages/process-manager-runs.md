---
title: Job Runs
summary: >-
  The jobs layer is the durable run-recording layer for Build, Absorb, and Garden, including
  background spawn, event logs, page snapshots, and jobs inspection.
topics:
  - systems
  - storage
  - cli
  - agents
sources:
  - id: github-issue-11
    type: web
    url: https://github.com/AlmanacCode/codealmanac/issues/11
    retrieved_at: 2026-05-31T00:00:00.000Z
    note: >-
      Distinguishes the capture-sweep recursion incident from the provider child-process cascade
      tracked in issue #10.
  - id: hosted-summary-contract-session
    type: conversation
    path: >-
      /Users/rohan/.codex/sessions/2026/05/31/rollout-2026-05-31T23-31-46-019e8173-bc02-7503-a102-e9de99d6bb9c.jsonl
    note: >-
      Records the 2026-06-07 hosted GitHub App discussion that rejected first-line result scraping
      as the PR-summary contract.
  - id: jobs-refactor-session
    type: conversation
    path: >-
      /Users/rohan/.codex/sessions/2026/06/07/rollout-2026-06-07T17-38-44-019ea4aa-e76e-7841-94a0-b00f3c24ccf8.jsonl
    note: >-
      Records the 2026-06-08 discussion that collapsed the process/run vocabulary into jobs,
      kept legacy storage readable, and split the lifecycle file by responsibility.
  - id: manager
    type: file
    path: src/jobs/executor.ts
    note: Executes started jobs through the harness and records terminal results.
  - id: background
    type: file
    path: src/jobs/start.ts
    note: Starts foreground, background, and queued jobs.
  - id: worker
    type: file
    path: src/jobs/worker.ts
    note: Drains queued jobs under the per-wiki worker lock.
  - id: queue
    type: file
    path: src/jobs/queue.ts
    note: Acquires the current worker lock and treats live legacy worker locks as blocking.
  - id: managed-child
    type: file
    path: src/harness/process/managed-child.ts
    note: Owns provider child process group spawning and termination.
  - id: wiki-effects
    type: file
    path: src/jobs/wiki-effects.ts
    note: Collects page snapshot deltas, structured operation output, and post-success reindexing.
  - id: records
    type: file
    path: src/stores/jobs/records.ts
    note: Migrated from legacy files.
  - id: logs
    type: file
    path: src/jobs/logs.ts
    note: Migrated from legacy files.
  - id: snapshots
    type: file
    path: src/jobs/snapshots.ts
    note: Migrated from legacy files.
  - id: spec
    type: file
    path: src/jobs/spec.ts
    note: Migrated from legacy files.
  - id: types
    type: file
    path: src/jobs/types.ts
    note: Migrated from legacy files.
  - id: claude
    type: file
    path: src/harness/providers/claude.ts
    note: Migrated from legacy files.
  - id: jobs
    type: file
    path: src/cli/commands/jobs.ts
    note: Migrated from legacy files.
  - id: job-projections
    type: file
    path: src/jobs/projections/view.ts
    note: Migrated from legacy files.
  - id: job-types
    type: file
    path: src/viewer/job-types.ts
    note: Migrated from legacy files.
  - id: jobs-2
    type: file
    path: src/viewer/jobs.ts
    note: Migrated from legacy files.
  - id: jobs-view
    type: file
    path: viewer/jobs-view.js
    note: Migrated from legacy files.
  - id: jobs-3
    type: file
    path: viewer/jobs.css
    note: Migrated from legacy files.
  - >-
    /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T18-27-05-019e70e9-b7d7-7900-9fc0-da2a6f0b532d.jsonl
verified: 2026-06-07T00:00:00.000Z

---

# Job Runs

The `src/jobs/` layer owns Almanac job lifecycle for every write-capable AI operation. Build, Absorb, and Garden produce an `OperationSpec`; the jobs layer records a job, executes or spawns it, logs normalized events, snapshots wiki pages, and reindexes after successful writes.

## Storage

Current job records are per wiki under `.almanac/jobs/`; `src/stores/jobs/records.ts` still reads legacy `.almanac/runs/` records when an older wiki has them:

```text
.almanac/jobs/<job-id>.json
.almanac/jobs/<job-id>.jsonl
.almanac/jobs/<job-id>.spec.json
.almanac/jobs/<job-id>.cancel
```

The JSON record stores status, operation, provider, model, PID, target metadata, log path, timestamps, final summary counts, page changes, optional structured operation output, and errors. The JSONL file stores normalized `HarnessEvent` records from [[harness-providers]], including structured tool display details and final output when an adapter can provide them. The spec file stores the serialized `OperationSpec` that the child process rehydrates, including the exact prompt string, cwd, provider/model selection, targets, output contract, and operation metadata. For sync debugging this file is the inspectable answer to "what prompt, output schema, and transcript context were actually sent for this job." The optional cancel marker is a race guard so a queued cancellation cannot be overwritten during child startup. New wiki scaffolding gitignores `.almanac/jobs/` and `.almanac/index.db`.

These job records are CodeAlmanac's canonical job transcript and audit record. Provider-owned Claude or Codex session history is secondary debug material and may be non-persistent for Almanac maintenance jobs. The user-visible transcript feature belongs to `.almanac/jobs/<job-id>.jsonl`, `almanac jobs logs <job-id>`, and the `almanac serve` jobs UI, not to the provider's own session store.

The jobs rename deliberately did not add a read-time storage migration. `[[src/stores/jobs/records.ts]]` resolves current `.almanac/jobs/` records, logs, and cancel markers first, then falls back to legacy `.almanac/runs/` paths when the current artifact is absent. It lists legacy records without moving `.almanac/runs/`, and callers that need a log path use `resolveJobLogPath()` instead of trusting an old `record.logPath` field. That compatibility keeps old job history readable without making read-only commands mutate runtime state. [@records] [@jobs-refactor-session]

## Status lifecycle

Background starts write a `queued` record, initialize the JSONL log, persist the `OperationSpec`, and wake the repo-local worker with `__run-worker`. The worker owns the transition from `queued` to `running`: it acquires `.almanac/jobs/worker.lock`, chooses the oldest queued job, rehydrates the saved spec, writes a running record with its PID, executes the provider, finalizes the record, and then drains the next queued job before releasing the lock. Duplicate worker wakeups are harmless because only the lock holder can claim queued jobs.

`[[src/jobs/queue.ts]]` also checks `.almanac/runs/worker.lock` before taking the current lock. A live legacy lock blocks new work, while a stale legacy lock is removed and the current `.almanac/jobs/worker.lock` is acquired. This protects users who upgraded while an old worker was still running, and it avoids a migration subsystem for a transient lock file. [@queue] [@jobs-refactor-session]

Foreground jobs do not bypass the single-writer invariant. They acquire the same worker lock before writing a started record and fail clearly if another operation is already running for the wiki. That keeps attached debugging jobs from racing queued Build, Absorb, or Garden work.

Terminal statuses are `done`, `failed`, and `cancelled`. `jobs` can display `stale` when a running PID is no longer alive. Job finalization re-reads the record before terminal writes; if a job was cancelled, finalization returns the cancelled record instead of resurrecting it as done or failed.

Maintenance operation specs set `providerSession.persistence = "ephemeral"`. Claude maps that to SDK `persistSession: false`, Codex app-server maps it to `thread/start.ephemeral`, and Codex exec maps it to `--ephemeral`. CodeAlmanac no longer injects internal transcript marker environment variables or scans provider transcript contents for those markers; the durable audit path is `.almanac/jobs/`.

Claude harness runs install `SIGINT`, `SIGTERM`, and `SIGHUP` handlers around the SDK query and abort its `AbortController` when the job process is asked to stop. This is a normal-termination cleanup path for the Claude CLI and MCP children; `SIGKILL` can still leave no JavaScript cleanup opportunity.

Issue #10 remains a separate provider-process ownership risk from the single-writer queue. The queue reduces fan-out by serializing write-capable jobs per wiki, but it does not by itself prove that a killed CodeAlmanac job will terminate a provider CLI and any MCP children that the provider started. The hardening boundary is now `[[src/harness/process/managed-child.ts]]`: provider adapters receive a managed child process and invoke `terminate()` on completion, timeout, cancellation, or signal handling. On POSIX systems the managed child uses an owned process group and escalates from `SIGTERM` to `SIGKILL`. A process-probe `EPERM` is treated as still alive but not currently signalable, not as proof that the group exited. Windows provider-process cleanup is intentionally unsupported until there is a tested implementation; the managed helper fails clearly on Windows instead of claiming unverified process-tree behavior. [@managed-child]

## Single-writer queue

The 2026-05-28 capture-sweep incident exposed a broader run-lifecycle invariant than "one sweep should not enqueue duplicate Absorb work." Issue #11 records this as distinct from issue #10's killed-provider-process risk: the sweep incident was repeated successful work over the wrong source category, so process-tree cleanup alone would not have fixed the cost spike. [@github-issue-11]

The accepted architecture is a per-wiki single-writer queue for all write-capable Almanac jobs. Build, Absorb, and Garden enter the same repo-local queue, and a worker guarded by a wiki-local lock runs at most one job against that `.almanac/` directory at a time.

The queue boundary should be per wiki, not global to the machine. The shared correctness boundary is the wiki source tree, job records, index, review state, and git history under one repo; two unrelated repos do not need to block each other's maintenance jobs. A global machine lock would reduce concurrency for no correctness gain when repositories have separate `.almanac/` directories.

That decision generalizes the scheduled-sync guardrails. It prevents Absorb-vs-Absorb duplicate page creation, Absorb-vs-Garden file races, and scheduler bursts that start several write-capable LLM jobs for the same wiki. It also removes the need for a sync-specific max-starts flag as a race-prevention mechanism, because sync enqueues eligible work and lets the per-wiki worker serialize execution. If the product later needs a backlog cap, it should be explicit queue policy rather than a sync-specific concurrency flag.

The queue should reuse the existing job vocabulary instead of adding a parallel taxonomy. `OperationKind` names the semantic work type (`build`, `absorb`, `garden`), `OperationSpec` serializes one executable operation job, and `JobRecord` stores the durable lifecycle state (`queued`, `running`, `done`, `failed`, `cancelled`). New code in this area should extend names such as operation, job record, queued job, and worker lock rather than introduce another synonym for the same concept.

The 2026-06-08 refactor rejected a separate public `job` versus internal `run` split for the current product. CodeAlmanac mostly has a 1:1 model today: one queued thing is one execution attempt and one durable record. Recurring scheduled intent already belongs to [[automation]] as a scheduled task, so adding another run entity inside the lifecycle layer would name future possibilities that the current code does not need. If a future product introduces one durable job with several execution attempts, the concept can live inside `src/jobs/`; it does not justify reviving a top-level `src/process/` vocabulary now. [@jobs-refactor-session]

The single-writer queue does not replace source provenance. Provider sessions for Almanac maintenance are non-persistent where providers support it, and `.almanac/jobs/` remains the canonical user-visible audit record. The project deliberately removed old marker-based transcript exclusion instead of preserving hidden content heuristics for already-persisted provider transcripts.

## Snapshot accounting

The job executor snapshots `.almanac/pages/*.md` before and after the harness run. `[[src/jobs/snapshots.ts]]` computes created, updated, archived, and deleted slug lists from page hashes and archive metadata. `[[src/jobs/wiki-effects.ts]]` writes those lists into `JobRecord.pageChanges` and derives the numeric `JobSummary` counts from the same delta. On success the executor runs the SQLite indexer; on failure it still records the event log, final error, summary counts, and page changes observed before finalization.

## Wiki-effect artifact design

A 2026-05-14 design discussion treated per-job page changes as a job-manager concern, not as special `jobs show` behavior. The current snapshot layer already has the right boundary because every write-capable Build, Absorb, and Garden job passes through it before terminal record finalization.

The implemented shape is a first-class run metadata contract that records the wiki effect of a run: created, updated, archived, and deleted page slugs, with optional richer summary or diff data later. The stable product question is "what did this run do to my wiki?", and page-level slugs answer that without forcing the CLI or viewer to recompute changes from live page files after the run.

The 2026-05-14 review tightened the storage boundary: store slug-level page changes in the JSON job record first, not in a sibling `.almanac/jobs/<job-id>.changes.json` file. The JSON record is already the lifecycle source of truth, and a sibling changes file would need atomic coordination with terminal status, cancellation, cleanup, JSON output, and viewer detail loading. A later `changesPath` artifact is still plausible for full diffs or larger payloads, but the job record should carry the summary and artifact pointer if that layer appears.

The recommended contract is versioned run metadata:

```ts
pageChanges?: {
  version: 1;
  jobId: string;
  created: string[];
  updated: string[];
  archived: string[];
  deleted: string[];
  summary?: string;
}
```

`summary` is now compatibility display metadata, not the product boundary for final-output meaning. When the provider returns the `almanac_operation_report_v1` structured final output, the job-effects layer validates that named contract and copies its `summary` into `pageChanges.summary`; otherwise it falls back to the old first-meaningful-line summary capped at 500 characters. The typed result itself is stored separately as `operationOutput: { version: 1, contract, value }`. Counts for `jobs show`, JSON output, capture automation, and the viewer are derived from the same snapshot delta that produces `pageChanges`, rather than from a second comparison path. Computing old changed slug sets on demand from current page files is not reliable because later runs can rewrite, archive, or delete the same pages after the before/after snapshots for the older run are gone.

The 2026-06-07 hosted GitHub App discussion exposed first-line harness-result scraping as the wrong boundary for PR-ready human messages. The current compatibility path in `[[src/jobs/wiki-effects.ts]]` may derive a display summary from the final assistant result, but that is acceptable only as a best-effort jobs-list snippet, not as the contract for a sticky GitHub comment or hosted product summary. When a downstream feature needs a formatted explanation, changed-file list, action label, or other shaped output, the agent run should produce that shape through an explicit prompt or structured output contract and the host should validate it, rather than relying on first-line markdown scraping. [@hosted-summary-contract-session]

Two review constraints protect that contract. If post-harness finalization fails after the page delta has been computed, the failed terminal record should still preserve `summary` and `pageChanges`; failed jobs are one of the cases where operators most need to know what changed before the failure. Readers also need to validate `pageChanges` when present, including `version === 1`, `jobId`, and all four slug arrays, because old records omit the field and malformed persisted metadata should not crash `jobs show` or the viewer.

## Jobs CLI

`almanac jobs` lists jobs for the current wiki only. `jobs show <job-id>` reads one record. `jobs logs <job-id>` prints the JSONL log. `jobs attach <job-id>` tails until the job is terminal and renders structured tool events into concise status lines such as reading, searching, editing, and command execution. `jobs cancel <job-id>` sends `SIGTERM` when a PID is known and marks the record cancelled.

## Jobs viewer

`almanac serve` exposes the same job data through the local viewer API at `/api/jobs` (list) and `/api/jobs/:jobId` (detail with JSONL events). See [[almanac-serve]] for the type shapes and polling design. The viewer uses `listJobRecords`, `readJobRecord`, `resolveJobRecordPath`, `resolveJobLogPath`, and `toJobView` from `[[src/jobs/index.ts]]` — no storage logic is duplicated. Jobs storage/API logic lives in `src/viewer/jobs.ts`; JSONL parsing and derived display title/subtitle, transcript-source inference, agent traces, and run warnings live under `[[src/jobs/projections/]]`. Viewer job response types live in `src/viewer/job-types.ts`. The frontend UI is split across `viewer/jobs-view.js` and `viewer/jobs.css`.

## Agent-thread attribution gap

Current JSONL run logs are mostly flat normalized harness events. They preserve useful `collabAgentToolCall` spawn/wait details, but ordinary messages and tool calls are not guaranteed to identify whether the root agent or a helper agent produced them. A raw Codex app-server probe confirmed that root and helper item notifications do carry `params.threadId`; Almanac currently drops that ownership when mapping to `HarnessEvent`. The same probe showed helper turns emit `turn/completed`, while the current Codex adapter finishes the whole run on any `turn/completed` without checking the root turn id. This makes subagent-heavy Codex runs hard to audit and can plausibly let a helper completion become the terminal run result.

A live Claude SDK probe confirmed a different provenance shape. Streamed Claude root messages use `parent_tool_use_id: null`; forwarded subagent messages carry `parent_tool_use_id` pointing at the parent `Agent` tool call, and the SDK can list/read concrete subagent transcripts with `listSubagents(sessionId)` and `getSubagentMessages(sessionId, agentId)`. Claude hook and permission APIs also expose subagent ids, but ordinary streamed assistant/user messages do not include `agent_id` directly. The current Claude adapter drops `uuid`, `session_id`, and `parent_tool_use_id`, so Claude also has usable ownership signals that Almanac does not currently log.

The implementation now writes new job log lines as version-2 envelopes with `version`, `sequence`, `jobId`, `actor`, and normalized `event` fields while preserving backwards-compatible reading for old `{timestamp, event}` and bare event logs. Codex app-server events use provider thread ids for root/helper attribution and ignore helper `turn/completed` notifications when deciding terminal job completion. Claude events use `parent_tool_use_id` as a derived helper actor id for forwarded subagent messages.

The jobs viewer API derives an agent tree and warnings from the event stream. It reports unknown actor events, unattributed or non-root terminal results, zero-page build runs, and MCP usage. `almanac serve` renders warnings and agent traces above the transcript, while the transcript still shows raw tool cards and status events.
