---
page_id: decision-sync-ledger-claims
title: Sync Ledger Claims
summary: Sync writes pending ledger claims before starting ingest so transcript work has durable ownership and recovery state.
topics: [decisions, lifecycle, storage]
sources:
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: sync-execution
    type: file
    path: src/codealmanac/workflows/sync/execution.py
  - id: sync-evaluation
    type: file
    path: src/codealmanac/workflows/sync/evaluation.py
---

# Sync Ledger Claims

Sync records pending ledger ownership before invoking or queueing ingest. Active pending claims skip the transcript, stale pending claims surface as needs-attention, and terminal run state can be reconciled before new transcript bytes are considered. [@live-agreement] [@sync-execution] [@sync-evaluation]

## Status

Accepted. [@live-agreement]

## Context

Local transcripts can be scanned repeatedly, and background ingest may outlive the sync command that enqueued it. The system needs durable state that says which transcript bytes are already claimed. [@live-agreement]

## Decision

We will write a pending ledger claim with run ownership before starting ingest work. [@live-agreement]

## Consequences

Sync can recover from failed foreground runs, failed worker spawns, stale pending claims, and terminal linked runs. See `[[architecture-sync-workflow]]` and `[[reference-sync-ledger]]`.

