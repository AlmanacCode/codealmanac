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
  - id: operation_mutation
    type: file
    path: src/codealmanac/workflows/operations/mutation.py
    note: Mutation preflight and validation policy.
  - id: operation-models
    type: file
    path: src/codealmanac/workflows/operations/models.py
    note: Operation context and result models.
  - id: architecture-tests
    type: file
    path: tests/test_architecture.py
    note: Tests that keep shared operation execution out of individual workflows.
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Active decision that shared page-writing execution belongs to OperationRunner.
---

# Operation Runner

`OperationRunner` is the shared execution path for page-writing lifecycle operations. Build, ingest, and garden prepare their own context and prompt, then delegate the common run mechanics to this service [@operation-service]. The runner owns the sequence from running-state transition through harness execution, mutation validation, index refresh, final wiki validation, and terminal run state.

This shape exists so lifecycle workflows do not reimplement safety and run plumbing. The live agreement states that operation workflows prepare operation-specific context, while `OperationRunner` owns running-state transition, mutation preflight, harness invocation, transcript recording, mutation validation, index refresh, terminal success, and failure recording [@live-agreement].

## Context And Preflight

`begin` marks the run running and resolves the repository for that run [@operation-service]. The returned `OperationContext` carries the run id, repository, and later the mutation preflight snapshot [@operation-models].

`preflight` asks the mutation policy to snapshot the repository before the harness runs. It records a run message saying that mutation preflight was captured, then returns a copied context with the preflight attached [@operation-service]. `execute` refuses to run without that preflight, because changed-file validation needs a before/after comparison [@operation-service].

## Harness Execution

`execute` calls `HarnessesService.run` with a `RunHarnessRequest` containing the harness kind, model, repository root, rendered prompt, and optional title [@operation-service]. The runner then records the harness transcript if one exists and converts normalized harness events into run log events [@operation-service].

Event classification lives beside the runner, not in individual workflows. Harness error events become run error events. Tool use, tool result, usage, provider session, warning, and helper-agent events become tool events. Other harness events become output events [@operation-harness].

If a harness returns no event stream, the harness helper creates a terminal fallback event from the harness status and output text [@operation-harness]. That keeps failed and minimal harness adapters visible in the run log.

## Safety And Completion

After recording harness output, the runner validates mutations before validating harness success [@operation-service] [@operation_mutation]. This order is intentional: a failed harness that also touched an unsafe file should leave its output in the log, then fail on the safety boundary if the mutation was unsafe.

The runner then validates harness success, refreshes the index, validates the wiki through `HealthService.ensure_valid`, and finishes the run as `DONE` with the harness summary or operation success summary [@operation-service]. If any step raises, `fail` records a first-line error and tries to finish the run as failed [@operation-service].

## Architectural Boundary

The architecture tests enforce this ownership. They require operation service, harness, commit, and mutation modules to exist, and they reject fragments such as `RunHarnessRequest`, `FinishRunRequest`, and harness event helpers inside ingest and garden workflow services [@architecture-tests].

That guardrail matters for future changes. New page-writing operation kinds should call the runner with their own prompt and context. They should not copy the lifecycle machinery that already lives here.

## Related Safety Page

Mutation safety is the runner's strictest boundary. The details are in [Mutation safety](mutation-safety), which explains Git snapshots, reported changed files, and the rule that lifecycle agents may only change `almanac/`.
