---
title: Lifecycle
topics: [architecture, lifecycle, overview]
sources:
  - id: topics
    type: file
    path: almanac/topics.yaml
    note: Topic graph entry for the lifecycle neighborhood.
  - id: workflows
    type: wiki
    path: architecture/lifecycle/workflows
    note: Architecture page for build, ingest, garden, and sync boundaries.
  - id: operation-runner
    type: wiki
    path: architecture/lifecycle/operation-runner
    note: Architecture page for shared lifecycle operation execution.
  - id: run-queue-sync
    type: wiki
    path: architecture/lifecycle/run-queue-and-sync
    note: Architecture page for durable queueing, worker drain, and sync enqueueing.
  - id: mutation-safety
    type: wiki
    path: architecture/lifecycle/mutation-safety
    note: Architecture page for prompt policy and runtime validation boundaries.
  - id: lifecycle-concept
    type: wiki
    path: concepts/lifecycle-operation
    note: Concept page that defines page-writing lifecycle operations.
  - id: run-states
    type: wiki
    path: reference/runs/run-states-and-events
    note: Reference page for run kinds, statuses, specs, events, and logs.
---

# Lifecycle

The lifecycle architecture is the part of CodeAlmanac that creates, improves, queues, and validates wiki-writing work. The lifecycle topic covers build, ingest, garden, sync, queued runs, operation execution, and mutation safety [@topics]. Read this hub when changing how CodeAlmanac turns local inputs and scheduled triggers into durable wiki changes.

Build, ingest, and garden are lifecycle operations because they bind packaged Yoke agents to typed tasks for wiki source under `almanac/` [@workflows] [@lifecycle-concept]. Sync is nearby but separate: it scans local transcripts and queues ingest work instead of writing pages itself [@workflows] [@run-queue-sync].

## Reading Order

Start with [Lifecycle workflows](workflows). It explains what build, ingest, garden, and sync each own, and it states the boundary between operation-specific context and shared execution [@workflows].

Then read [Operation runner](operation-runner) when the change touches harness invocation, run events, final validation, or terminal run state. The runner is the shared path used after a page-writing workflow has prepared its context and prompt [@operation-runner].

Use [Run queue and sync](run-queue-and-sync) when changing queued ingest, scheduled Garden, worker drain, or transcript sync. That page connects lifecycle work to durable run specs and the worker that drains queued records [@run-queue-sync].

Use [Mutation safety](mutation-safety) when changing allowed files, auto-commit instructions, final validation, or any future runtime enforcement for out-of-tree edits [@mutation-safety].

## Neighboring Pages

[Run states and events](../../reference/runs/run-states-and-events) is the exact reference for run kinds, statuses, queued specs, cancellation, attach, and logs [@run-states]. [Lifecycle operation](../../concepts/lifecycle-operation) is the concept page for the page-writing operation family [@lifecycle-concept].
