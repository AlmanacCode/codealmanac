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
