---
title: Sync Workflow And Ledger
topics: [architecture, sync, runs]
sources:
  - id: service
    type: file
    path: src/codealmanac/workflows/sync/service.py
  - id: evaluation
    type: file
    path: src/codealmanac/workflows/sync/evaluation.py
  - id: execution
    type: file
    path: src/codealmanac/workflows/sync/execution.py
  - id: store
    type: file
    path: src/codealmanac/workflows/sync/store.py
---

# Sync Workflow And Ledger

`sync` discovers quiet local Codex and Claude transcripts and starts ingest runs for transcript ranges that have not already been absorbed. The public `SyncWorkflow` is a facade over evaluation and execution helpers [@service].

Evaluation discovers transcript candidates, scopes them to an optional wiki, skips non-quiet or internal lifecycle transcripts, loads the per-wiki ledger, reconciles pending entries against run records, evaluates cursors, and returns ready work items [@evaluation]. Execution writes pending ledger claims before foreground ingest or background queueing, then marks absorbed or failed outcomes [@execution].

The primary ledger path is under `~/.codealmanac/jobs/<workspace-id>/sync-ledger.json`, with a legacy read fallback under `<almanac-root>/jobs/sync-ledger.json` [@store]. Exact fields are in [[sync-ledger-format-reference]].
