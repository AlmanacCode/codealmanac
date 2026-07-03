---
page_id: architecture-background-queue
title: Background Queue
summary: Background lifecycle work is represented as spec-backed queued runs drained by a local worker under a per-wiki lock.
topics: [architecture, lifecycle]
sources:
  - id: queue
    type: file
    path: src/codealmanac/workflows/run_queue/service.py
  - id: process
    type: file
    path: src/codealmanac/integrations/runs/process.py
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# Background Queue

The background queue treats background work as a queued run with a durable run spec. `RunQueueWorkflow` can queue ingest or garden specs, spawn a detached local worker, acquire a worker lock, select the oldest spec-backed queued run, and execute it through the same ingest or garden workflow used by foreground commands. [@queue] [@live-agreement]

## Why does the spec matter?

Foreground lifecycle runs also begin as queued, so background workers must select queued runs that have durable specs rather than every queued record. [@live-agreement]

## What is the worker command?

The hidden `__run-worker` command is a process entrypoint for draining the queue. It is not a public command and does not contain lifecycle business logic. [@live-agreement] [@process]

## What should I read next?

Read `[[architecture-run-ledger-and-jobs]]` and `[[reference-run-records]]`.

