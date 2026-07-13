---
title: Repository Affiliation Belongs In Repository Service
topics: [decisions, repositories, lifecycle]
sources:
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
  - id: service-boundaries
    type: wiki
    path: architecture/service-boundaries
    note: Boundary rule that product verbs live in services and outside systems sit behind service-owned ports.
---

# Repository Affiliation Belongs In Repository Service

Repository affiliation is the proposed boundary for mapping an artifact created in a checkout back to the canonical registered CodeAlmanac repository. The durable design issue is broader than one workspace tool: a transcript can be created from a checkout path that is not the exact registered repository root. The repository service should own that decision because it already owns registered repository identity and selection [@repository-service] [@service-boundaries].

## Status

Proposed. No `resolve_affiliation` method or checkout inspector exists in `src/codealmanac/services/repositories/` yet; sync still relies on exact-root selection [@repository-service] [@repository-selection]. This page records the intended ownership boundary and shape for that future work, not current behavior.

## Context

Current repository selection is exact. `select_for_operation(...)` uses the current directory as the repository only when it is the exact registered root, and named selection goes through the repository registry [@repository-service]. The selection helpers compare exact normalized paths and validate containment, but they do not identify two checkouts as the same underlying repository [@repository-selection].

That model works for ordinary runs from the registered checkout. It is the wrong place to solve future transcript-checkout matching by weakening exact root selection, because selection and path containment are current repository-service mechanics [@repository-service] [@repository-selection].

## Decision

Treat affiliation as a repository-service operation, not as sync-specific or provider-specific logic. The intended shape is a repository service method that accepts an observed path and returns the canonical registered repository plus enough match information for callers to explain the result [@repository-service] [@service-boundaries].

Git or filesystem inspection should be an integration detail behind a service-owned port. Ordinary exact-path matching should remain the fast path; any richer checkout matching should add a separate affiliation path instead of changing what exact repository selection means [@repository-selection] [@service-boundaries].

## Consequences

Sync should ask the repository service which registered repository owns a transcript working directory, then queue ingest against that repository. Sync should not grow its own repository identity rules, because it is already a scanner that delegates page-writing work to ordinary ingest runs [@sync-workflow] [@service-boundaries].

Ambiguity must be explicit. If a future affiliation implementation can match more than one registered repository, CodeAlmanac should report ambiguity rather than guess. That keeps repository identity a product decision instead of a side effect of sync discovery [@repository-service] [@service-boundaries].

This decision does not change `repository_id_for(...)` or the current exact-root registry model. Repository id migration and repository relocation are separate design problems; affiliation is only the future seam for mapping observed artifact paths back to registered repositories [@repository-service] [@repository-selection].

For the current exact-root behavior, see [Repository Selection And Root](../architecture/repositories/selection-and-root). For the queue boundary that sync feeds, see [Run Queue And Sync](../architecture/lifecycle/run-queue-and-sync).
