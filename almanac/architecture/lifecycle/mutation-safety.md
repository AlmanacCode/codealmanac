---
title: Mutation Safety
topics: [architecture, lifecycle, safety]
sources:
  - id: operation-service
    type: file
    path: src/codealmanac/workflows/operations/service.py
    note: Current operation execution and completion path.
  - id: commit-policy
    type: file
    path: src/codealmanac/workflows/operations/commit.py
    note: Prompt-facing source-control policy and allowed files.
  - id: kernel-prompt
    type: file
    path: src/codealmanac/agents/build/instructions.md
    note: Base instruction that operation agents follow source_control policy.
  - id: architecture-tests
    type: file
    path: tests/test_architecture.py
    note: Tests that keep OperationRunner free of the removed mutation policy module.
  - id: ingest-tests
    type: file
    path: tests/test_ingest_workflow.py
    note: Ingest tests for changed_files, outside-file mutations, and validation.
  - id: garden-tests
    type: file
    path: tests/test_garden_workflow.py
    note: Garden tests for outside-file mutations and validation.
  - id: validate-tests
    type: file
    path: tests/test_validate.py
    note: Validation behavior after lifecycle agents write wiki pages.
---

# Mutation Safety

Mutation safety is currently an agent-facing write boundary plus final wiki validation. CodeAlmanac renders a `source_control` policy that tells lifecycle agents which wiki source files they may edit or commit, and the base kernel tells agents to follow that policy [@commit-policy] [@kernel-prompt]. The current Python operation runner does not perform a Git-diff mutation preflight or reject files outside `almanac/` after the harness returns [@operation-service] [@architecture-tests].

This page describes the runtime boundary. The policy decision behind prompt-level committing is recorded separately in [Auto-commit is prompt policy](../../decisions/auto-commit-is-prompt-policy).

That distinction matters for future changes. The prompt policy is still strict: operation agents must edit wiki source under `almanac/` unless the operation explicitly says otherwise [@kernel-prompt]. Runtime success, however, is decided by harness status, index refresh, and wiki validation, not by comparing before-and-after Git status [@operation-service] [@validate-tests].

## Prompt Boundary

`operation_commit_policy` is the source-control contract lifecycle prompts receive. When auto-commit is enabled, it allows committing only `almanac/**/*.md` and `almanac/topics.yaml`; it forbids user config, runtime state, application source, logs, and unrelated files [@commit-policy]. The product decision behind this prompt-facing policy is [Auto-commit is prompt policy](../../decisions/auto-commit-is-prompt-policy).

When auto-commit is disabled, the same policy tells the agent not to stage files and not to run `git commit` [@commit-policy]. This is policy rendered into the prompt. It is not a Python committer or a Python-side file mutation checker.

## Runner Boundary

`OperationRunner.execute` runs the harness, records a harness transcript when one exists, records normalized harness events, validates harness success, refreshes the index, calls `HealthService.ensure_valid`, and marks the run done [@operation-service]. `OperationContext` carries the run id and repository; it does not carry a mutation preflight snapshot [@operation-service].

The architecture tests make that absence explicit. They require `workflows/operations/service.py`, `commit.py`, and `harness.py`, require `workflows/operations/mutation.py` to be absent, and reject `OperationMutationPolicy` or `validate_reported_changes` inside the operation service [@architecture-tests].

## Changed Files

`HarnessRunResult.changed_files` still exists as result metadata, but the operation runner no longer treats it as a safety gate. Ingest tests assert that a harness-reported `README.md` change does not fail the run, and Garden tests assert that a harness that mutates `src/app.py` can still leave the run done [@ingest-tests] [@garden-tests].

Those tests describe current runtime behavior, not permission for agents to edit application source during real operations. The permission boundary remains the prompt policy, and the validation boundary remains the wiki tree.

## Failure Mode

Unsafe edits outside `almanac/` do not currently produce a dedicated mutation-safety failure. A lifecycle run fails when the harness reports a failed status, when index refresh fails, or when validation rejects the wiki source [@operation-service] [@validate-tests].

If runtime mutation enforcement returns, it needs code and tests that reintroduce that responsibility deliberately. A future implementation should update this page at the same time, because old claims about Git snapshots are wrong for the current operation runner.

For the shared lifecycle execution path that calls validation after harness completion, see [Operation runner](operation-runner).
