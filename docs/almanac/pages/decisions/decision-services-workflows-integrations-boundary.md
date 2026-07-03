---
page_id: decision-services-workflows-integrations-boundary
title: Services Workflows Integrations Boundary
summary: Services own product verbs, workflows compose services, and integrations implement outside-world ports.
topics: [decisions]
sources:
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: architecture-tests
    type: file
    path: tests/test_architecture.py
  - id: app
    type: file
    path: src/codealmanac/app.py
---

# Services Workflows Integrations Boundary

The Python rewrite separates services, workflows, and integrations. Services own product verbs, workflows compose services for multi-step operations, integrations speak to external systems, and architecture tests prevent CLI, workflows, and services from importing integration modules directly. [@live-agreement] [@architecture-tests] [@app]

## Status

Accepted. [@live-agreement]

## Context

The product talks to Git, GitHub, web pages, local transcript stores, Codex, Claude, launchd, subprocesses, and package managers. Those edges change for different reasons than product rules.

## Decision

We will keep product behavior in services and workflows, and keep provider, scheduler, command, source, workspace-probe, setup, and package-manager mechanics under integrations. [@live-agreement]

## Consequences

New outside-world behavior should enter through a port and adapter, then be injected by `[[architecture-composition-root]]`. New product verbs belong in services or workflows, not integrations.

