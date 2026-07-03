---
title: Add A Harness Adapter Guide
topics: [guides, harnesses]
sources:
  - id: ports
    type: file
    path: src/codealmanac/services/harnesses/ports.py
  - id: results
    type: file
    path: src/codealmanac/services/harnesses/results.py
  - id: default
    type: file
    path: src/codealmanac/integrations/harnesses/__init__.py
  - id: tests
    type: file
    path: tests/test_harnesses_service.py
---

# Add A Harness Adapter Guide

Use this guide when adding an agent provider behind CodeAlmanac's harness boundary. The adapter should produce the same normalized result and event contract as [[codex-app-server-harness]] and [[claude-sdk-harness]].

## Steps

1. Add a `HarnessKind` value only when the provider is a real supported runtime.
2. Implement `HarnessAdapter.check()` for readiness and `HarnessAdapter.run()` for prompt execution [@ports].
3. Return `HarnessRunResult` with output text, status, changed files, optional transcript reference, and normalized events [@results].
4. Map provider tool/text/usage/session/error data into [[harness-event-contract-reference]] instead of storing raw provider logs as the product interface.
5. Register the adapter in `default_harness_adapters()` [@default].

## Verification

Add adapter tests for readiness, success, failure, changed-file detection, and event mapping. Keep `tests/test_harnesses_service.py` passing so selection errors stay predictable [@tests].
