---
title: Operation Runner
topics: [architecture, lifecycle, runs]
sources:
  - id: operation-service
    type: file
    path: src/codealmanac/workflows/operations/service.py
    note: Shared operation execution service.
  - id: operation-harness
    type: file
    path: src/codealmanac/workflows/operations/harness.py
    note: Harness result validation and event classification.
  - id: operation-models
    type: file
    path: src/codealmanac/workflows/operations/models.py
    note: Operation context and result models.
  - id: architecture-tests
    type: file
    path: tests/test_architecture.py
    note: Tests that keep shared operation execution out of individual workflows.
---

# Operation Runner

`OperationRunner` is the shared execution path for page-writing lifecycle operations. Build, ingest, and garden prepare their own context and prompt, then delegate the common run mechanics to this service [@operation-service]. The runner owns the sequence from running-state transition through harness execution, transcript and event recording, harness success validation, index refresh, final wiki validation, and terminal run state.

This shape exists so lifecycle workflows do not reimplement harness and run plumbing. The architecture tests keep shared operation execution in the operation package and reject copied fragments such as `RunHarnessRequest`, run finishing requests, and harness event helpers inside ingest and garden services [@architecture-tests].

## Context

`begin` marks the run running and resolves the repository for that run [@operation-service]. The returned `OperationContext` carries the run id and repository [@operation-models].

`OperationContext` is intentionally small. It carries the run id and selected repository, which are the only shared facts the runner needs for recording events, invoking the harness, refreshing the index, validating the wiki, and finishing the run [@operation-models] [@operation-service].

## Harness Execution

`execute` calls `HarnessesService.run` with a `RunHarnessRequest` containing the harness kind, model, repository root, task prompt, and optional title [@operation-service]. The runner then records the harness transcript if one exists and converts normalized harness events into run log events [@operation-service].

Event classification lives beside the runner, not in individual workflows. Harness error events become run error events. Tool use, tool result, usage, provider session, warning, and helper-agent events become tool events. Other harness events become output events [@operation-harness].

If a harness returns no event stream, the harness helper creates a terminal fallback event from the harness status and output text [@operation-harness]. That keeps failed and minimal harness adapters visible in the run log.

## Safety And Completion

After recording harness output, the runner validates harness success [@operation-service] [@operation-harness]. A failed harness therefore leaves its transcript and output in the run log before the run is marked failed.

The runner then refreshes the index, validates the wiki through `HealthService.ensure_valid`, and finishes the run as `DONE` with the harness summary or operation success summary [@operation-service]. If any step raises, `fail` records a first-line error and tries to finish the run as failed [@operation-service].

## Architectural Boundary

The architecture tests enforce this ownership. They require operation service, harness, and commit modules to exist; require `workflows/operations/mutation.py` to be absent; and reject fragments such as `RunHarnessRequest`, `FinishRunRequest`, and harness event helpers inside ingest and garden workflow services [@architecture-tests].

That guardrail matters for future changes. New page-writing operation kinds should call the runner with their own prompt and context. They should not copy the lifecycle machinery that already lives here.

## Related Safety Page

The write boundary for lifecycle agents is covered in [Mutation safety](mutation-safety). That page explains the current split between prompt-level source-control policy and runtime wiki validation.
