---
page_id: architecture-sync-workflow
title: Sync Workflow
summary: Sync discovers quiet local transcripts, evaluates ledger state, and starts foreground or background ingest for eligible transcript ranges.
topics: [architecture, lifecycle]
sources:
  - id: sync-service
    type: file
    path: src/codealmanac/workflows/sync/service.py
  - id: sync-evaluation
    type: file
    path: src/codealmanac/workflows/sync/evaluation.py
  - id: sync-execution
    type: file
    path: src/codealmanac/workflows/sync/execution.py
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# Sync Workflow

Sync scans local Codex and Claude transcript stores, filters candidates by workspace and quiet-window policy, checks ledger state, and starts ingest for eligible transcript ranges. Foreground sync runs ingest immediately; background sync queues ingest and records pending ledger ownership before spawning a worker. [@sync-service] [@sync-evaluation] [@sync-execution]

## What does evaluation decide?

Evaluation discovers transcript candidates, scopes them to a selected wiki when requested, skips internal lifecycle transcripts, loads the sync ledger, reconciles pending runs, checks cursor progress, and marks candidates ready, skipped, or needing attention. [@sync-evaluation]

## What does execution change?

Execution writes pending ledger entries before ingest work starts. It records absorbed or failed ledger entries after foreground runs and records worker-spawn failures for background runs. [@sync-execution]

The live agreement requires sync to scan local transcripts, run local ingest, write durable pending ledger claims, and keep plain scheduled automation on foreground sync until unattended background policy is reopened. [@live-agreement]

## What decision constrains it?

See `[[decision-sync-ledger-claims]]` and `[[reference-sync-ledger]]`.
