---
title: Harness Service Contract
topics: [architecture, harnesses]
sources:
  - id: service
    type: file
    path: src/codealmanac/services/harnesses/service.py
  - id: ports
    type: file
    path: src/codealmanac/services/harnesses/ports.py
  - id: results
    type: file
    path: src/codealmanac/services/harnesses/results.py
  - id: default
    type: file
    path: src/codealmanac/integrations/harnesses/__init__.py
---

# Harness Service Contract

The harness service is the provider-neutral boundary for running AI agents. A harness adapter must report readiness and run a prompt into a `HarnessRunResult` with status, output text, optional summary, changed files, optional transcript reference, and normalized events [@ports] [@results].

`HarnessesService` selects adapters by `HarnessKind`, exposes readiness for all adapters, and raises when a requested adapter is unavailable from the configured adapter list [@service]. The default app graph registers Claude SDK and Codex app-server adapters [@default].

Provider-specific behavior belongs in [[codex-app-server-harness]] or [[claude-sdk-harness]]. The event shape is exact in [[harness-event-contract-reference]].
