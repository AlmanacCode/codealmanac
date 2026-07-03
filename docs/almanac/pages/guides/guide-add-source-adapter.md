---
page_id: guide-add-source-adapter
title: Add A Source Adapter
summary: Use this guide when CodeAlmanac needs to inspect a new kind of ingest source behind the existing source runtime contract.
topics: [guides, integration]
sources:
  - id: sources-service
    type: file
    path: src/codealmanac/services/sources/service.py
  - id: source-ports
    type: file
    path: src/codealmanac/services/sources/ports.py
  - id: source-init
    type: file
    path: src/codealmanac/integrations/sources/__init__.py
  - id: app
    type: file
    path: src/codealmanac/app.py
---

# Add A Source Adapter

Use this guide when ingest should support a new source type. The result should be a resolver path that produces a structured source reference, a runtime adapter that can inspect that reference, and registration in the default source adapter set. [@sources-service] [@source-ports] [@source-init]

## Preconditions

Read `[[architecture-source-system]]`, `[[architecture-source-adapters]]`, and `[[reference-source-addresses]]`.

## Steps

1. Add or extend address resolution so the raw input becomes a `SourceRef`.
2. Implement a runtime adapter with `supports()` and `inspect()`.
3. Keep external calls inside `src/codealmanac/integrations/sources/`.
4. Register the adapter in the default source runtime adapter set.
5. Add tests for address resolution, runtime inspection, and ingest prompt context if behavior changes.

If the adapter should be available in the default application, confirm it is included in the adapter set injected by `[[architecture-composition-root]]`. [@app]

## Verification

Run the focused source adapter test and a source-service test. If ingest behavior changes, add an ingest workflow test because ingest calls source runtime inspection before rendering the prompt. [@sources-service]

## Recovery

If the source cannot be inspected reliably, return a skipped or unavailable runtime snapshot instead of throwing away the source identity.
