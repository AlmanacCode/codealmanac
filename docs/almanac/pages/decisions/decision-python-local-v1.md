---
page_id: decision-python-local-v1
title: Python Local V1
summary: Python v1 is a local product, not a hosted service or compatibility layer for the archived TypeScript CLI.
topics: [decisions]
sources:
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: readme
    type: file
    path: README.md
---

# Python Local V1

Python v1 is the current local CodeAlmanac product. It uses the public `codealmanac` command, stores repo wiki files locally, keeps global user state under `~/.codealmanac/`, and excludes hosted login, connect, upload, SDK, MCP, and legacy `almanac` or `alm` aliases. [@live-agreement] [@readme]

## Status

Accepted. [@live-agreement]

## Context

The branch contains archived TypeScript code and some historical hosted-product work, but the active rewrite lives under `src/codealmanac/`. The live agreement says old TypeScript code is behavior reference, not code to preserve. [@live-agreement]

## Decision

We will build the Python rewrite as a local-only product. We will not add hosted shipping, hosted CLI, login, connect, upload, SDK, MCP, public `almanac` aliases, or old root migrations unless that decision is reopened. [@live-agreement]

## Consequences

Public docs, command tests, setup behavior, sync behavior, and update behavior must describe the Python local surface. Architecture pages should treat hosted material as historical unless the live agreement changes. See `[[architecture-testing-contracts]]` and `[[decision-codealmanac-command-only]]`.

