---
title: Sync Ledger Format Reference
topics: [reference, sync]
sources:
  - id: models
    type: file
    path: src/codealmanac/workflows/sync/models.py
  - id: store
    type: file
    path: src/codealmanac/workflows/sync/store.py
---

# Sync Ledger Format Reference

This page defines the transcript sync ledger. [[sync-workflow-and-ledger]] explains how sync evaluates and updates it.

## Storage

The primary ledger path is `~/.codealmanac/jobs/<workspace-id>/sync-ledger.json`; the legacy read fallback is `<almanac-root>/jobs/sync-ledger.json` [@store]. The ledger version is `1` [@store].

## Ledger Fields

`SyncLedger` has `version`, `updated_at`, and `sessions` keyed by transcript identity [@models]. Each `SyncLedgerEntry` stores app, session id, transcript path, status, last absorbed size/line/prefix hash, last job id/error, failed attempts, and pending claim fields [@models].

Ledger statuses are `done`, `pending`, `failed`, and `needs_attention`; evaluation decisions are `skip`, `needs_attention`, and `ready` [@models].
