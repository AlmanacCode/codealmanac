---
title: Repository Affiliation Belongs In Repository Service
topics: [decisions, repositories, lifecycle]
sources:
  - id: affiliation-transcript
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/07/10/rollout-2026-07-10T16-35-11-019f4e62-96e5-7212-82fa-013a204a6c50.jsonl
    note: Architecture discussion that reframed Conductor/worktree support as repository affiliation.
  - id: repository-service
    type: file
    path: src/codealmanac/services/repositories/service.py
    note: Current repository selection behavior and service boundary.
  - id: repository-selection
    type: file
    path: src/codealmanac/services/repositories/selection.py
    note: Current exact path, name, and containment helpers.
  - id: sync-workflow
    type: file
    path: src/codealmanac/workflows/sync/service.py
    note: Sync workflow that discovers transcripts and queues ingest.
---

# Repository Affiliation Belongs In Repository Service

Repository affiliation is the proposed boundary for mapping an artifact created in a checkout back to the canonical registered CodeAlmanac repository. The problem first appeared as support for Conductor workspaces, but the durable design issue is broader: a transcript can be created in a temporary checkout, worktree, or nested directory that is not the exact registered repository root [@affiliation-transcript]. The repository service should own that decision because it already owns registered repository identity and selection [@repository-service].

## Status

Proposed. No `resolve_affiliation` method or checkout inspector exists in `src/codealmanac/services/repositories/` yet; sync still relies on exact-root selection [@repository-service] [@repository-selection]. This page records the intended ownership boundary and shape for that future work, not current behavior.

## Context

Current repository selection is exact. `select_for_operation(...)` uses the current directory as the repository only when it is the exact registered root, and named selection goes through the repository registry [@repository-service]. The selection helpers compare exact normalized paths and validate containment, but they do not identify two checkouts as the same underlying Git repository [@repository-selection].

That model works for ordinary runs from the registered checkout. It breaks down when sync sees a transcript whose working directory was a worktree or other temporary checkout. The transcript path is an artifact location, not necessarily the product repository identity [@affiliation-transcript].

## Decision

Treat affiliation as a repository-service operation, not as Conductor-specific logic. The intended shape is a service method such as `repositories.resolve_affiliation(path)` returning the canonical registered repository, the observed checkout path, and the match method [@affiliation-transcript].

Git should be an integration detail behind a service-owned port. The proposed first implementation uses a checkout inspector that reads Git common-dir identity, so ordinary exact-path matching remains the fast path and Git worktree matching is an additional affiliation method [@affiliation-transcript].

## Consequences

Sync should ask the repository service which registered repository owns a transcript working directory, then queue ingest against that repository. Sync should not recognize Conductor path patterns, compare remote URLs, register every worktree, or treat branch names as repository identity [@affiliation-transcript] [@sync-workflow].

Ambiguity must be explicit. If two registered roots share one Git common-dir identity, CodeAlmanac should report ambiguous affiliation rather than guess [@affiliation-transcript]. Deleted temporary checkouts are out of scope for the first version because a deleted path can no longer reveal its Git identity; caching observed checkout affiliations would need separate invalidation rules [@affiliation-transcript].

This decision does not change `repository_id_for(...)`. The transcript explicitly separates the affiliation seam from durable repository identity migration: the repository id can remain based on the registered filesystem path until relocation becomes its own design problem [@affiliation-transcript].

For the current exact-root behavior, see [Repository Selection And Root](../architecture/repositories/selection-and-root). For the queue boundary that sync feeds, see [Run Queue And Sync](../architecture/lifecycle/run-queue-and-sync).
