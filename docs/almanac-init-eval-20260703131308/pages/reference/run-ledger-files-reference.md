---
title: Run Ledger Files Reference
topics: [reference, runs]
sources:
  - id: models
    type: file
    path: src/codealmanac/services/runs/models.py
  - id: paths
    type: file
    path: src/codealmanac/services/runs/paths.py
  - id: io
    type: file
    path: src/codealmanac/services/runs/io.py
---

# Run Ledger Files Reference

This page defines lifecycle run files. [[run-ledger-and-job-queue]] explains the queue behavior around these files.

## File Names

- `<run-id>.json`: `RunRecord` [@paths].
- `<run-id>.spec.json`: `RunSpec` for queued background work [@paths].
- `<run-id>.jsonl`: append-only `RunLogEvent` stream [@paths].
- `worker.lock/owner.json`: worker lock owner metadata [@paths].

## Main Models

Run operations are `init`, `ingest`, `sync`, and `garden`. Run statuses are `queued`, `running`, `done`, `failed`, and `cancelled` [@models].

`RunSpec` version is `1`; init specs reject inputs/wiki selector, ingest specs require inputs and reject init-only fields, and garden specs reject inputs and init-only fields [@models].

JSON records are written atomically through temporary files, and log events append one JSON object per line [@io].
