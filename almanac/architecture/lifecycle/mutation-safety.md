---
title: Mutation Safety
topics: [architecture, lifecycle, safety]
sources:
  - id: mutation-policy
    type: file
    path: src/codealmanac/workflows/operations/mutation.py
    note: Operation mutation preflight and validation.
  - id: change-tracking
    type: file
    path: src/codealmanac/workflows/change_tracking.py
    note: Repository change snapshot and path change models.
  - id: git-probe
    type: file
    path: src/codealmanac/integrations/repositories/git/probe.py
    note: Git-backed repository change probe.
  - id: commit-policy
    type: file
    path: src/codealmanac/workflows/operations/commit.py
    note: Prompt-facing auto-commit permission and file boundaries.
  - id: ingest-tests
    type: file
    path: tests/test_ingest_workflow.py
    note: Ingest mutation safety behavior.
  - id: garden-tests
    type: file
    path: tests/test_garden_workflow.py
    note: Garden mutation safety behavior.
  - id: build-tests
    type: file
    path: tests/test_build_workflow.py
    note: Build Git tracking preflight behavior.
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Active lifecycle mutation safety decision.
---

# Mutation Safety

Mutation safety is the rule that lifecycle agents may only change the repo wiki source. In this codebase, that means changes during build, ingest, and garden must stay under `almanac/`; changes to application source, logs, runtime files, or unrelated repo files fail the run [@mutation-policy].

The safety model is Git-based. Before the harness runs, the operation captures a repository change snapshot. After the harness returns, it captures another snapshot, compares changed paths, verifies every new mutation is under the almanac root, refreshes the index, and lets [Operation runner](operation-runner) validate the wiki before marking the run done [@mutation-policy].

## Change Snapshots

`RepositoryChangeProbe` is the port for reading local change state. A snapshot contains the repository root, whether tracking was available, a tuple of path changes, and an unavailable reason when the probe cannot work [@change-tracking].

The Git implementation runs `git status --porcelain=v1 -z --untracked-files=all` with a timeout [@git-probe]. It parses status entries into path states such as added, deleted, modified, renamed, copied, unmerged, and untracked [@git-probe]. For files, it also records a SHA-256 fingerprint, so a pre-existing dirty file only counts as newly changed if its identity changes during the run [@git-probe].

If Git is missing, times out, or returns an error, the snapshot is unavailable [@git-probe]. Lifecycle mutation policy treats that as a validation failure because the operation cannot prove what the agent changed [@mutation-policy].

## Preflight And Validation

`OperationMutationPolicy.preflight` captures the before snapshot, checks that tracking is available, and stores the almanac path relative to the repository root [@mutation-policy]. Build also checks tracking availability before registering the repository or creating `almanac/`, so a non-Git target does not get partially initialized [@build-tests].

After the harness returns, `validate` first checks the harness-reported changed files. Any reported path outside `almanac/` fails immediately [@mutation-policy]. It then captures the after snapshot, computes changed paths by comparing before and after path identities, and rejects any mutated path outside the almanac prefix [@mutation-policy].

The returned mutation report includes the before snapshot, after snapshot, and changed files under the wiki root [@mutation-policy]. That report is part of build, ingest, and garden results, so callers can inspect what the operation actually changed.

## Dirty Working Trees

The policy allows pre-existing dirty files. It does not require the whole repository to be clean before an explicit lifecycle run starts. The live agreement records that runs snapshot current Git state, allow pre-existing wiki edits, reject files changed during the run outside `almanac/`, and validate the final wiki before marking done [@live-agreement].

The tests pin down the distinction. A pre-existing dirty application file is allowed if the harness does not change it, but the run fails if the harness mutates that dirty file [@ingest-tests]. Pre-existing dirty wiki edits are allowed, and the final changed-file report can include both the user's wiki edit and the agent's wiki page [@ingest-tests].

## Commit Permission Is Prompt Policy

Auto-commit is not a second safety mechanism. `operation_commit_policy` builds prompt instructions that say whether the agent may commit during the run, which files are allowed, which files are forbidden, and what commit message shape to use [@commit-policy].

The runtime safety boundary still comes from mutation validation. Even if the prompt allows commits, the changed-file check rejects lifecycle mutations outside `almanac/` [@mutation-policy]. Garden tests enforce the same behavior for garden runs that touch `src/app.py` [@garden-tests].

## Failure Mode

Unsafe mutation fails the run. Ingest tests show failures for harness-reported paths outside `almanac/`, newly changed app files, and missing Git tracking [@ingest-tests]. Garden has the same outside-`almanac/` failure behavior [@garden-tests].

This is the main protection that lets lifecycle agents work in a real repository. They can edit the wiki directly, but the system verifies the boundary after the fact and refuses to call the operation successful if the repository shape was harmed.
