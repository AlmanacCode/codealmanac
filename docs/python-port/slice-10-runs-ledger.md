# Slice 10: Runs Ledger And Jobs Read Surface

## Scope

Add the first lifecycle state seam without running AI:

```text
codealmanac jobs [--limit N] [--json]
codealmanac jobs show <run-id> [--json]
codealmanac jobs logs <run-id> [--json]
```

The public command stays `jobs` because users inspect jobs. The Python service
is `runs` because it owns execution records, events, outputs, and lifecycle
state for future `ingest`, `sync`, `garden`, and AI-backed `build` work.

## Product Semantics

`jobs` is a local read surface over `.almanac/jobs/`. It does not start agents,
edit pages, discover sources, schedule work, or shell out to the CLI.

`RunsService` exposes write methods for future workflows: start a run, append a
run event, and finish a run. Those methods are not public CLI commands in this
slice; they are the service seam future workflows will call directly.

## Architecture

Cosmic Python chapter 10 separates commands from events. In CodeAlmanac:

- a future lifecycle start is a command: `start ingest`, `start sync`,
  `start garden`
- a run log entry is an event: `queued`, `read note`, `done`, `failed`

```text
codealmanac jobs
  -> cli/main.py
  -> services/runs/service.py
  -> services/runs/store.py
  -> .almanac/jobs/*.json + *.jsonl
```

`RunStore` owns JSON/JSONL persistence. `RunsService` owns workspace selection
and run verbs. CLI only renders typed results.

## Out Of Scope

- harness execution
- background workers
- process locks and cancellation
- snapshots and page-change accounting
- provider event normalization
- jobs viewer routes
- automation

## Tests

- service test for start/event/finish/list/show/log
- service test for targeting another registered wiki through `--wiki`
- request validation for terminal finish statuses
- CLI test for `jobs`, `jobs show`, `jobs logs`, and JSON list output

## Remaining Risk

The store does not implement single-writer locking yet. That belongs with
foreground/background execution because this slice only creates the ledger seam
and read surface.
