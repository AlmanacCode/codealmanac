---
page_id: decision-spec-backed-background-queue
title: Spec Backed Background Queue
summary: Background queue membership is a queued run with a durable spec file, not just any queued run.
topics: [decisions, lifecycle, storage]
sources:
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: queue
    type: file
    path: src/codealmanac/workflows/run_queue/service.py
---

# Spec Backed Background Queue

Background work is represented as a queued run with a durable `<run-id>.spec.json` file. Workers select spec-backed queued runs so they do not accidentally execute foreground runs that have not yet been marked running. [@live-agreement] [@queue]

## Status

Accepted. [@live-agreement]

## Context

Foreground lifecycle runs also start as queued. A worker that selected every queued record would confuse foreground state with background queue membership. [@live-agreement]

## Decision

We will define queue membership as a queued run plus a durable run spec. [@live-agreement]

## Consequences

The queue owns durable specs, oldest spec-backed selection, per-wiki worker locking, stale-lock recovery, and in-process draining through ingest and garden. See `[[architecture-background-queue]]`.

