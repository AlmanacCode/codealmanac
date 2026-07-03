---
page_id: reference-sync-ledger
title: Sync Ledger
summary: This page describes the durable ledger sync uses to track transcript ingestion progress and pending claims.
topics: [reference, lifecycle, storage]
sources:
  - id: sync-models
    type: file
    path: src/codealmanac/workflows/sync/models.py
  - id: sync-store
    type: file
    path: src/codealmanac/workflows/sync/store.py
  - id: sync-execution
    type: file
    path: src/codealmanac/workflows/sync/execution.py
---

# Sync Ledger

The sync ledger tracks transcript ingestion state for each discovered local transcript. It stores cursor progress, status, failed attempts, pending ownership, linked run ids, and timestamps so repeated sync scans can skip unchanged work or recover pending work. [@sync-models] [@sync-store]

## Status values

| Status | Meaning |
|---|---|
| `absorbed` | Transcript bytes were ingested. |
| `failed` | Ingest failed for this transcript range. |
| `pending` | Work is claimed by a foreground or background run. |

These values are modeled by sync ledger types. [@sync-models]

## Where is it written?

Sync execution writes pending entries before starting ingest, then records absorbed or failed entries after execution. [@sync-execution]

## Related pages

Read `[[architecture-sync-workflow]]` and `[[decision-sync-ledger-claims]]`.

