---
title: Services, Workflows, And Integrations Boundary
topics: [decisions, architecture]
sources:
  - id: manual
    type: file
    path: MANUAL.md
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: tests
    type: file
    path: tests/test_architecture.py
  - id: app
    type: file
    path: src/codealmanac/app.py
---

# Services, Workflows, And Integrations Boundary

CodeAlmanac keeps product logic out of provider and subprocess code. Services own product nouns, workflows own multi-service verbs, integrations implement ports, and `src/codealmanac/app.py` wires the concrete graph [@agreement] [@app].

## Context

The manual says boundaries should be separated by reason-to-change and that raw external shapes should not leak past the normalization boundary [@manual]. The architecture test enforces that `cli`, `workflows`, and `services` do not import `codealmanac.integrations` [@tests].

## Decision

New external mechanics must live in integrations behind service-owned ports or workflow-owned ports. Services and workflows may depend on typed ports and models, not subprocess, HTTP, SDK, Git, or provider modules directly.

## Consequences

This makes [[app-composition-root]] the place where concrete adapters enter the system. It also means guide pages such as [[add-a-source-runtime-guide]] and [[add-a-harness-adapter-guide]] should start by identifying the owning service contract.
