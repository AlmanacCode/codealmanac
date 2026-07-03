---
page_id: guide-debug-failed-run
title: Debug A Failed Run
summary: Use this guide when an ingest, garden, sync, or background job fails and you need to find whether the cause is source resolution, harness execution, mutation safety, or index refresh.
topics: [guides, lifecycle]
sources:
  - id: runs-service
    type: file
    path: src/codealmanac/services/runs/service.py
  - id: page-run
    type: file
    path: src/codealmanac/workflows/page_run/service.py
  - id: lifecycle-mutation
    type: file
    path: src/codealmanac/workflows/lifecycle_mutation.py
---

# Debug A Failed Run

Use this guide when a lifecycle run ends as failed or cancelled. The goal is to identify which stage failed: source resolution, prompt preparation, harness readiness, harness execution, mutation safety, queue handling, sync ledger handling, or index refresh. [@runs-service] [@page-run]

## Preconditions

Have the run id from `codealmanac jobs`, `codealmanac sync`, `codealmanac ingest`, or `codealmanac garden`.

## Steps

1. Run `codealmanac jobs show <run-id>` to inspect status and summary.
2. Run `codealmanac jobs logs <run-id>` to inspect recorded messages and harness events.
3. If the failure mentions source loading, inspect `[[architecture-source-system]]`.
4. If the failure mentions provider auth or execution, inspect `[[architecture-harness-system]]`.
5. If the failure mentions changed files outside the root, inspect `[[decision-git-mutation-safety]]`.
6. If the run came from sync, inspect `[[reference-sync-ledger]]`.

## Verification

After fixing the cause, rerun the same narrow command and then run `codealmanac health`.

## Recovery

If a harness edited files outside the Almanac root, preserve the run logs, inspect the Git diff, and do not rerun until the mutation boundary is understood. The mutation policy is designed to fail after recording useful harness output. [@lifecycle-mutation]

