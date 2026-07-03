---
title: Background Jobs User State Decision
topics: [decisions, runs]
sources:
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: paths
    type: file
    path: src/codealmanac/core/paths.py
  - id: runs
    type: file
    path: src/codealmanac/services/runs/service.py
---

# Background Jobs User State Decision

Lifecycle job records, queued specs, logs, worker locks, and sync ledgers are stored in user-level job state by default: `~/.codealmanac/jobs/<workspace-id>/` [@paths] [@runs].

## Context

The live agreement restored background jobs for v1 and defines queue membership as a queued run with a durable spec, not merely a run whose status is `queued` [@agreement].

## Decision

`RunsService` uses the configured jobs path when available and falls back to legacy `<almanac-root>/jobs` for reads [@runs]. Foreground lifecycle runs still create run records, but workers select only spec-backed queued runs.

## Consequences

Job behavior is documented in [[run-ledger-and-job-queue]] and exact files are in [[run-ledger-files-reference]]. New background work must write durable specs before spawning workers.
